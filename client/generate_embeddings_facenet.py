import json
import os
import sys
from io import BytesIO

import numpy as np
import requests
import torch
from PIL import Image, ImageOps
from facenet_pytorch import MTCNN, InceptionResnetV1

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://ylhryvakpswdgapooica.supabase.co")
BUCKET_NAME = "student-photos"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

mtcnn = MTCNN(
    image_size=160,
    margin=20,
    min_face_size=40,
    thresholds=[0.6, 0.7, 0.7],
    factor=0.709,
    post_process=True,
    keep_all=True,
    device=DEVICE,
)
face_model = InceptionResnetV1(pretrained="vggface2").eval().to(DEVICE)

def load_image(source):
    if source.startswith(("http://", "https://")):
        response = requests.get(source, timeout=15)
        response.raise_for_status()
        raw = response.content
    else:
        clean = source.replace("student-photos/", "").lstrip("/")
        url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{clean}"
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        raw = response.content
    return ImageOps.exif_transpose(Image.open(BytesIO(raw)).convert("RGB"))

def generate_embedding(source):
    image = load_image(source)
    faces, _ = mtcnn(image, return_prob=True)
    if faces is None:
        raise ValueError("No face detected.")
    if faces.ndim == 3:
        faces = faces.unsqueeze(0)
    if faces.shape[0] != 1:
        raise ValueError(f"Exactly one face is required; detected {faces.shape[0]}.")
    with torch.no_grad():
        emb = face_model(faces.to(DEVICE))
        emb = torch.nn.functional.normalize(emb, p=2, dim=1)
    values = emb.squeeze(0).cpu().numpy().astype(np.float32)
    if values.shape != (512,) or not np.isfinite(values).all():
        raise ValueError("Invalid 512-D FaceNet embedding.")
    values /= np.linalg.norm(values)
    return values.tolist()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate_embeddings_facenet.py <image-url-or-storage-path>")
        sys.exit(1)
    try:
        embedding = generate_embedding(sys.argv[1])
        print(json.dumps(embedding))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
