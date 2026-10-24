#!/usr/bin/env python3
"""
==============================================================
ExamShield AI — Face Embedding Microserver
==============================================================
Runs locally on http://localhost:5005

Provides HTTP endpoints so the web registration UI can generate
REAL FaceNet 512-D embeddings — identical to the verification
pipeline — when enrolling new students.

Pipeline (mirrors verification exactly):
  Image → MTCNN (face detect + crop) → InceptionResnetV1 (FaceNet)
        → L2-Normalize → 512-D float vector → JSON

Endpoints
---------
GET  /health          Health check
POST /embed           Embed a face image

    Accepts (multipart/form-data):
        file    - image file upload

    Accepts (application/json):
        image_url  - HTTP/HTTPS image URL
        image_b64  - base64 data URL  (data:image/...;base64,...)

    Returns:
        200  { "embedding": [0.0123, ...], "face_count": 1 }
        400  { "error": "No face detected" }
        500  { "error": "..." }

Usage
-----
    pip install flask flask-cors facenet-pytorch torch pillow requests numpy
    python embedding_server.py
==============================================================
"""

import base64
import io
import json
import logging
import os
import sys
import traceback
from io import BytesIO

import numpy as np
import requests
import torch
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageOps

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [EmbeddingServer] %(levelname)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("embedding_server")

# ── Flask App ──────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})  # Allow browser requests

PORT = int(os.environ.get("EMBED_SERVER_PORT", 5005))

# ── Device ─────────────────────────────────────────────────────────────────────
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
log.info("Using device: %s", device)

# ── Models (loaded once at startup) ────────────────────────────────────────────
try:
    from facenet_pytorch import MTCNN, InceptionResnetV1

    mtcnn = MTCNN(
        image_size=160,
        margin=20,
        min_face_size=40,
        thresholds=[0.6, 0.7, 0.7],
        factor=0.709,
        post_process=True,
        keep_all=True,
        device=device,
    )

    resnet = InceptionResnetV1(pretrained="vggface2").eval().to(device)

    log.info("MTCNN + FaceNet (InceptionResnetV1/vggface2) loaded successfully.")

except ImportError as e:
    log.critical(
        "facenet-pytorch is not installed. Run: pip install facenet-pytorch torch pillow"
    )
    log.critical("Error: %s", e)
    sys.exit(1)

# ── Device Detection Model (Ultralytics YOLO) ───────────────────────────────────
device_model = None
device_model_path = os.environ.get(
    "DEVICE_MODEL_PATH",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "new_device_latest.pt")
)
try:
    from ultralytics import YOLO
    if os.path.isfile(device_model_path):
        device_model = YOLO(device_model_path)
        log.info("YOLO device detector loaded from %s (classes: %s)", device_model_path, device_model.names)
    else:
        log.warning("Device model weight file not found at %s", device_model_path)
except Exception as e:
    log.warning("Could not load YOLO device detector: %s", e)



# ── Helpers ────────────────────────────────────────────────────────────────────

def load_image_from_bytes(data: bytes) -> Image.Image:
    """Load a PIL Image from raw bytes, auto-correcting EXIF orientation."""
    img = Image.open(BytesIO(data)).convert("RGB")
    img = ImageOps.exif_transpose(img)
    return img


def load_image_from_b64(b64_str: str) -> Image.Image:
    """
    Accept either a plain base64 string or a data URL like
    'data:image/jpeg;base64,/9j/4AAQ...'
    """
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    data = base64.b64decode(b64_str)
    return load_image_from_bytes(data)


def load_image_from_url(url: str) -> Image.Image:
    """Download and load a PIL Image from a URL."""
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    return load_image_from_bytes(resp.content)


def get_embedding(img: Image.Image):
    """
    Generate a real FaceNet embedding only when exactly one face is detected.

    Returns
    -------
    (embedding_list, face_count)
        embedding_list : list[float] | None
        face_count     : int
    """
    face_tensors, probs = mtcnn(img, return_prob=True)

    if face_tensors is None:
        return None, 0

    if not isinstance(face_tensors, torch.Tensor):
        return None, 0

    # keep_all=True returns [N, 3, 160, 160].
    if face_tensors.ndim == 3:
        face_tensors = face_tensors.unsqueeze(0)

    if face_tensors.ndim != 4:
        return None, 0

    face_count = int(face_tensors.shape[0])

    if face_count != 1:
        log.warning(
            "Exactly one face is required; detected %d.",
            face_count,
        )
        return None, face_count

    face_batch = face_tensors.to(device)

    with torch.no_grad():
        embedding_tensor = resnet(face_batch)

    # L2 normalization is required for consistent cosine similarity.
    embedding_tensor = torch.nn.functional.normalize(
        embedding_tensor,
        p=2,
        dim=1,
    )

    embedding_np = (
        embedding_tensor
        .squeeze(0)
        .cpu()
        .numpy()
    )

    if embedding_np.shape != (512,):
        raise ValueError(
            f"Expected 512-D embedding, got {embedding_np.shape}"
        )

    if not np.isfinite(embedding_np).all():
        raise ValueError("Embedding contains NaN or Inf.")

    norm = float(np.linalg.norm(embedding_np))
    if norm == 0 or not np.isfinite(norm):
        raise ValueError("Invalid embedding norm.")

    embedding_np = embedding_np / norm

    return [round(float(v), 8) for v in embedding_np], 1


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "device": str(device),
        "port": PORT,
        "models": {
            "facenet": True,
            "device_detector": device_model is not None,
            "device_model_path": device_model_path if device_model else None,
            "device_classes": device_model.names if device_model else None
        }
    })


@app.post("/detect-devices")
def detect_devices():
    """
    Accepts image via file upload or JSON base64 / URL.
    Runs real inference with models/new_device_latest.pt (Ultralytics YOLOv8).
    Returns real bounding boxes, classes, and confidence scores.
    """
    if device_model is None:
        return jsonify({
            "error": "Device detection model (new_device_latest.pt) is not loaded.",
            "success": False
        }), 503

    try:
        import time
        img: Image.Image | None = None

        if "file" in request.files:
            file = request.files["file"]
            img = load_image_from_bytes(file.read())
        elif request.is_json:
            body = request.get_json(force=True, silent=True) or {}
            if "image_b64" in body:
                img = load_image_from_b64(body["image_b64"])
            elif "image_url" in body:
                img = load_image_from_url(body["image_url"])

        if img is None:
            return jsonify({"error": "No image provided. Send 'file' (multipart) or 'image_b64'/'image_url' (JSON)."}), 400

        t0 = time.time()
        results = device_model(img, conf=0.30, verbose=False)
        inference_time_ms = round((time.time() - t0) * 1000.0, 2)

        detections = []
        for r in results:
            for box in r.boxes:
                cls_id = int(box.cls[0].item())
                cls_name = r.names.get(cls_id, str(cls_id))
                conf = round(float(box.conf[0].item()), 4)
                xyxy = [round(float(v), 2) for v in box.xyxy[0].tolist()]
                detections.append({
                    "class": cls_name,
                    "class_id": cls_id,
                    "confidence": conf,
                    "box": xyxy
                })

        return jsonify({
            "success": True,
            "detections": detections,
            "count": len(detections),
            "inference_time_ms": inference_time_ms,
            "model": "new_device_latest.pt",
            "image_size": [img.width, img.height]
        })
    except Exception as exc:
        log.error("Device detection error: %s\n%s", exc, traceback.format_exc())
        return jsonify({"error": str(exc), "success": False}), 500


@app.post("/embed")
def embed():
    """
    Accept image via:
      - multipart/form-data  (file field named 'file')
      - application/json     (image_url or image_b64 field)
    """
    try:
        img: Image.Image | None = None

        # ── 1. Multipart file upload ───────────────────────────────────────────
        if "file" in request.files:
            file = request.files["file"]
            img = load_image_from_bytes(file.read())
            log.info("Received file upload: %s", file.filename)

        # ── 2. JSON payload ───────────────────────────────────────────────────
        elif request.is_json:
            body = request.get_json(force=True, silent=True) or {}

            if "image_b64" in body:
                img = load_image_from_b64(body["image_b64"])
                log.info("Received base64 image (%d chars)", len(body["image_b64"]))

            elif "image_url" in body:
                img = load_image_from_url(body["image_url"])
                log.info("Received image URL: %s", body["image_url"])

        if img is None:
            return jsonify({"error": "No image provided. Send 'file' (multipart) or 'image_b64'/'image_url' (JSON)."}), 400

        # ── 3. Generate embedding ─────────────────────────────────────────────
        embedding, face_count = get_embedding(img)

        if embedding is None or face_count != 1:
            log.warning("No face detected in the provided image.")
            return jsonify({
                "error": "Exactly one face must be visible in the image.",
                "face_count": face_count,
            }), 400

        log.info("Face detected and embedded successfully. Vector dim: %d", len(embedding))

        return jsonify({
            "embedding": embedding,
            "face_count": face_count,
            "dims": len(embedding),
        })

    except Exception as exc:
        log.error("Embedding error: %s\n%s", exc, traceback.format_exc())
        return jsonify({"error": str(exc)}), 500


# ── Entry Point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    log.info("=" * 60)
    log.info("ExamShield AI — Face Embedding Microserver")
    log.info("Listening on http://localhost:%d", PORT)
    log.info("Endpoints:")
    log.info("  GET  /health")
    log.info("  POST /embed   (file upload | image_b64 | image_url)")
    log.info("=" * 60)

    app.run(host="0.0.0.0", port=PORT, debug=False, threaded=True)
