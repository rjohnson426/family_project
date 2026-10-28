"""Compares embedder/faces.py with the real InsightFace pipeline on a few library photos.
Run from family_facial_recognition's venv: .venv/bin/python ../family_photos/tests/embedder_parity.py"""
import glob, os, sys
import cv2, numpy as np
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "embedder"))
import faces
from insightface.app import FaceAnalysis

model_dir = os.path.expanduser("~/.insightface/models/buffalo_l")
app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=-1, det_size=(640, 640))
paths = sorted(glob.glob(sys.argv[1] if len(sys.argv) > 1 else "../family_facial_recognition/data/web_export/photos/*/large.jpg"))[:: int(os.environ.get("STEP", 400))][:12]
worst, total = 1.0, 0
for p in paths:
    img = cv2.imread(p)
    ref = app.get(img)
    mine = faces.embed_faces(model_dir, img)
    ok = len(ref) == len(mine)
    sims = []
    for r in ref:
        sims.append(max((float(np.dot(r.normed_embedding, m["embedding"])) for m in mine), default=0))
    total += len(ref)
    if sims: worst = min(worst, min(sims))
    print(os.path.basename(os.path.dirname(p)), "faces", len(ref), len(mine), "OK" if ok else "COUNT DIFFERS", [round(s, 4) for s in sims])
print("worst cosine", round(worst, 4), "over", total, "faces")
