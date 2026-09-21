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

def generate_facenet_embedding(image_arg):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    mtcnn = MTCNN(
        image_size=160, margin=20, min_face_size=40,
        thresholds=[0.6, 0.7, 0.7], factor=0.709,
        keep_all=True, post_process=True, device=device
    )
    model = InceptionResnetV1(pretrained="vggface2").eval().to(device)

    if image_arg.startswith(("http://", "https://")):
        url = image_arg
    else:
        clean = image_arg.replace("student-photos/", "").lstrip("/")
        url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{clean}"

    response = requests.get(url, timeout=15)
    response.raise_for_status()
    image = ImageOps.exif_transpose(Image.open(BytesIO(response.content)).convert("RGB"))

    faces, _ = mtcnn(image, return_prob=True)
    if faces is None:
        raise ValueError("No face detected.")
    if faces.ndim == 3:
        faces = faces.unsqueeze(0)
    if faces.shape[0] != 1:
        raise ValueError(f"Exactly one face is required; detected {faces.shape[0]}.")

    with torch.no_grad():
        emb = torch.nn.functional.normalize(model(faces.to(device)), p=2, dim=1)

    values = emb.squeeze(0).cpu().numpy().astype(np.float32)
    if values.shape != (512,) or not np.isfinite(values).all():
        raise ValueError("Invalid 512-D FaceNet embedding.")
    values /= np.linalg.norm(values)
    return values.tolist()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("Usage: python generate_facenet_single.py <image-url-or-storage-path>")
    try:
        print(json.dumps(generate_facenet_embedding(sys.argv[1])))
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
