"""Face detection and embedding that matches family_facial_recognition's InsightFace buffalo_l.

The same two models (det_10g SCRFD detector, w600k_r50 ArcFace recognizer), the same 640px detection
size, 0.5 detection floor, 0.4 NMS and 112px ArcFace alignment, run straight on onnxruntime so it
fits in a serverless function (no insightface, scipy or scikit-image). tests/embedder_parity.py
checks it against the real library. Embeddings are L2-normalised 512-d float32, like `normed_embedding`.
"""

import os
import threading

import cv2
import numpy as np
import onnxruntime as ort

DET_SIZE = 640
DET_THRESH = 0.5
NMS_THRESH = 0.4
STRIDES = (8, 16, 32)
ARCFACE_DST = np.array(
    [[38.2946, 51.6963], [73.5318, 51.5014], [56.0252, 71.7366], [41.5493, 92.3655], [70.7299, 92.2041]],
    dtype=np.float32,
)

_lock = threading.Lock()
_sessions = {}


def _session(model_dir, name):
    with _lock:
        if name not in _sessions:
            opts = ort.SessionOptions()
            opts.log_severity_level = 3
            _sessions[name] = ort.InferenceSession(
                os.path.join(model_dir, name), opts, providers=["CPUExecutionProvider"]
            )
        return _sessions[name]


def _nms(dets):
    x1, y1, x2, y2, scores = (dets[:, i] for i in range(5))
    areas = (x2 - x1 + 1) * (y2 - y1 + 1)
    order = np.argsort(-scores, kind="stable")
    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0.0, xx2 - xx1 + 1) * np.maximum(0.0, yy2 - yy1 + 1)
        ovr = inter / (areas[i] + areas[order[1:]] - inter)
        order = order[np.where(ovr <= NMS_THRESH)[0] + 1]
    return keep


def detect(model_dir, img):
    """BGR image -> (boxes Nx5 [x1,y1,x2,y2,score], landmarks Nx5x2)."""
    det = _session(model_dir, "det_10g.onnx")
    ratio = img.shape[0] / img.shape[1]
    if ratio > 1.0:
        new_h, new_w = DET_SIZE, int(DET_SIZE / ratio)
    else:
        new_w, new_h = DET_SIZE, int(DET_SIZE * ratio)
    scale = new_h / img.shape[0]
    canvas = np.zeros((DET_SIZE, DET_SIZE, 3), dtype=np.uint8)
    canvas[:new_h, :new_w] = cv2.resize(img, (new_w, new_h))
    blob = cv2.dnn.blobFromImage(canvas, 1 / 128.0, (DET_SIZE, DET_SIZE), (127.5,) * 3, swapRB=True)
    outs = det.run(None, {det.get_inputs()[0].name: blob.astype(np.float32)})

    scores_l, boxes_l, kps_l = [], [], []
    for idx, stride in enumerate(STRIDES):
        scores = outs[idx]
        boxes = outs[idx + 3] * stride
        kps = outs[idx + 6] * stride
        n = DET_SIZE // stride
        centers = (np.stack(np.mgrid[:n, :n][::-1], axis=-1).astype(np.float32) * stride).reshape(-1, 2)
        centers = np.stack([centers] * 2, axis=1).reshape(-1, 2)
        keep = np.where(scores.ravel() >= DET_THRESH)[0]
        b = np.stack([centers[:, 0] - boxes[:, 0], centers[:, 1] - boxes[:, 1],
                      centers[:, 0] + boxes[:, 2], centers[:, 1] + boxes[:, 3]], axis=-1)
        k = np.stack([(centers[:, 0] if i % 2 == 0 else centers[:, 1]) + kps[:, i] for i in range(10)], axis=-1)
        scores_l.append(scores[keep])
        boxes_l.append(b[keep])
        kps_l.append(k.reshape(-1, 5, 2)[keep])
    if not sum(s.size for s in scores_l):
        return np.empty((0, 5), np.float32), np.empty((0, 5, 2), np.float32)
    scores = np.vstack(scores_l)
    order = np.argsort(-scores.ravel(), kind="stable")
    pre = np.hstack((np.vstack(boxes_l) / scale, scores)).astype(np.float32)[order]
    kpss = (np.vstack(kps_l).reshape(-1, 5, 2) / scale)[order]
    keep = _nms(pre)
    return pre[keep], kpss[keep]


def _similarity(src, dst):
    """Least-squares similarity transform (the skimage `SimilarityTransform.estimate` result), 2x3."""
    n = src.shape[0]
    sm, dm = src.mean(0), dst.mean(0)
    s, d = src - sm, dst - dm
    cov = d.T @ s / n
    var = s.var(0).sum()
    u, sv, vt = np.linalg.svd(cov)
    sign = np.ones(2)
    if np.linalg.det(cov) < 0:
        sign[1] = -1
    r = u @ np.diag(sign) @ vt
    scale = (sv * sign).sum() / var
    m = np.zeros((2, 3))
    m[:, :2] = scale * r
    m[:, 2] = dm - scale * r @ sm
    return m


def embed_faces(model_dir, img):
    """BGR image -> list of {bbox:[x,y,w,h], score, embedding:[512]} in detection order."""
    rec = _session(model_dir, "w600k_r50.onnx")
    boxes, kpss = detect(model_dir, img)
    faces = []
    for box, kps in zip(boxes, kpss):
        m = _similarity(kps.astype(np.float64), ARCFACE_DST.astype(np.float64))
        aligned = cv2.warpAffine(img, m, (112, 112), borderValue=0.0)
        blob = cv2.dnn.blobFromImages([aligned], 1 / 127.5, (112, 112), (127.5,) * 3, swapRB=True)
        vec = rec.run(None, {rec.get_inputs()[0].name: blob.astype(np.float32)})[0].flatten()
        vec = (vec / np.linalg.norm(vec)).astype(np.float32)
        x1, y1, x2, y2 = (float(v) for v in box[:4])
        faces.append({"bbox": [x1, y1, x2 - x1, y2 - y1], "score": float(box[4]), "embedding": vec.tolist()})
    return faces
