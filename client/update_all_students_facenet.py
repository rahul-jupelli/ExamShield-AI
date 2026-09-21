import json
import os
from io import BytesIO

import numpy as np
import requests
import torch
from PIL import Image, ImageOps
from facenet_pytorch import MTCNN, InceptionResnetV1

SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://ylhryvakpswdgapooica.supabase.co")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "")
BUCKET_NAME = "student-photos"
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

if not SUPABASE_KEY:
    raise RuntimeError("Set VITE_SUPABASE_ANON_KEY before running this maintenance script.")

mtcnn = MTCNN(
    image_size=160,
    margin=20,
    min_face_size=40,
    thresholds=[0.6, 0.7, 0.7],
    factor=0.709,
    keep_all=True,
    post_process=True,
    device=DEVICE,
)
face_model = InceptionResnetV1(pretrained="vggface2").eval().to(DEVICE)

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

def clean_photo_path(photo):
    if not photo:
        return ""
    prefix = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/"
    value = str(photo).strip()
    return value[len(prefix):] if value.startswith(prefix) else value

def get_embedding(photo_source):
    value = clean_photo_path(photo_source)
    if value.startswith(("http://", "https://")):
        url = value
    else:
        url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{value.lstrip('/')}"

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
        emb = torch.nn.functional.normalize(face_model(faces.to(DEVICE)), p=2, dim=1)

    values = emb.squeeze(0).cpu().numpy().astype(np.float32)
    if values.shape != (512,) or not np.isfinite(values).all():
        raise ValueError("Invalid 512-D embedding.")
    values /= np.linalg.norm(values)
    return values.tolist()

def process_all_students():
    url = f"{SUPABASE_URL}/rest/v1/students?select=id,name,photo"
    response = requests.get(url, headers=headers, timeout=20)
    response.raise_for_status()
    students = response.json()

    updated = 0
    failed = 0
    for student in students:
        sid = student.get("id")
        try:
            embedding = get_embedding(student.get("photo", ""))
            patch_url = f"{SUPABASE_URL}/rest/v1/students?id=eq.{requests.utils.quote(str(sid), safe='')}"
            patch = requests.patch(
                patch_url,
                json={"faceEmbedding": embedding},
                headers=headers,
                timeout=20,
            )
            patch.raise_for_status()
            updated += 1
            print(f"[SUCCESS] {sid} -> 512-D real FaceNet embedding")
        except Exception as exc:
            failed += 1
            print(f"[FAILED] {sid}: {exc}")

    print(f"Finished: {updated} updated, {failed} failed, {len(students)} total.")

if __name__ == "__main__":
    process_all_students()
