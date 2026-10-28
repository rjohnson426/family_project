"""Shared request logic for the face embedder: the Vercel function (api/embed.py) and the local dev
server (embedder/server.py) both call `handle`."""

import hmac
import io
import json
import os
import urllib.request
import zipfile

import cv2
import numpy as np

import faces

NEEDED = ("det_10g.onnx", "w600k_r50.onnx")
MODEL_ZIP = os.environ.get(
    "FACE_MODEL_ZIP_URL", "https://github.com/deepinsight/insightface/releases/download/v0.7/buffalo_l.zip"
)


def model_dir():
    """Local buffalo_l folder if there is one (dev); otherwise the two models are fetched once per
    warm function instance from the official InsightFace release into /tmp."""
    for d in (os.environ.get("FACE_MODEL_DIR", ""), os.path.expanduser("~/.insightface/models/buffalo_l"), "/tmp/buffalo_l"):
        if d and all(os.path.exists(os.path.join(d, n)) for n in NEEDED):
            return d
    os.makedirs("/tmp/buffalo_l", exist_ok=True)
    with urllib.request.urlopen(MODEL_ZIP, timeout=120) as res:
        archive = zipfile.ZipFile(io.BytesIO(res.read()))
    for name in NEEDED:
        with open(f"/tmp/buffalo_l/{name}", "wb") as f:
            f.write(archive.read(name))
    return "/tmp/buffalo_l"


def handle(body: bytes, secret_header: str):
    """-> (status, json-able). The caller must send AUTH_SECRET so only the site can use this."""
    secret = os.environ.get("AUTH_SECRET", "")
    if not secret or not hmac.compare_digest(secret_header or "", secret):
        return 401, {"error": "unauthorized"}
    img = cv2.imdecode(np.frombuffer(body, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return 400, {"error": "not an image"}
    return 200, {"width": int(img.shape[1]), "height": int(img.shape[0]), "faces": faces.embed_faces(model_dir(), img)}


def respond(handler, status, payload):
    out = json.dumps(payload).encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(out)))
    handler.end_headers()
    handler.wfile.write(out)
