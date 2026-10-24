#!/usr/bin/env python3
"""
===================================================================
ExamShield AI — Camera AI Inference & Candidate Verification Worker
===================================================================
Role:
- Executes real Ultralytics YOLO inference against live webcam frames.
- In 'device_detection' mode:
    Runs new_device_latest.pt for prohibited devices (phone, earbuds, smartwatch).
    Reports real observed detections and measured FPS.
- In 'face_verification' mode:
    Runs ExamShield_face_detector_best.pt for live face detection.
    Performs real-time candidate QR code reading and enrolled student matching.
    Captures live face image and requests 512-D FaceNet embeddings from the
    local embedding microserver (embedding_server.py).
    Computes cosine similarity against enrolled database embeddings (threshold: 0.65).
    Persists verification results directly via the backend API.
- Never invents detections, matches, or FPS.
===================================================================
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import signal
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import requests
from ultralytics import YOLO


# --- AUTO-DISCOVER & LOAD ENVIRONMENT CONFIGURATION ---
def load_dotenv_config():
    """Loads configuration from client/.env or root .env if not already set."""
    candidates = [
        Path(__file__).resolve().parent.parent / "client" / ".env",
        Path(__file__).resolve().parent.parent / ".env",
        Path.cwd() / "client" / ".env",
        Path.cwd() / ".env",
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip('"').strip("'")
                            if k and k not in os.environ:
                                os.environ[k] = v
                break
            except Exception:
                pass


load_dotenv_config()

MATCH_THRESHOLD = 0.70  # Threshold used by the supplied QR-verification reference notebook
REQUIRED_CONSECUTIVE_MATCHES = 3  # Require stable identity matches before marking verified
QR_SCAN_RETRY_SECONDS = 0.75
FACE_VERIFY_RETRY_SECONDS = 0.8
CANDIDATE_VERIFY_TIMEOUT_SECONDS = 30.0
running = True


def _shutdown(_signum, _frame):
    global running
    running = False


signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


def emit(event: dict) -> None:
    """Write machine-readable events to stdout for the supervisor."""
    print(json.dumps(event, separators=(",", ":")), flush=True)


def parse_detections(result, names) -> list[dict]:
    detections = []
    boxes = getattr(result, "boxes", None)
    if boxes is None:
        return detections
    for box in boxes:
        try:
            cls_id = int(box.cls.item())
            confidence = float(box.conf.item())
            xyxy = [int(v) for v in box.xyxy[0].tolist()]
            label = names.get(cls_id, str(cls_id)) if isinstance(names, dict) else str(cls_id)
            detections.append({
                "class_id": cls_id,
                "label": str(label),
                "confidence": round(confidence, 4),
                "box": xyxy,
            })
        except (AttributeError, TypeError, ValueError, IndexError):
            continue
    return detections


def cosine_similarity(vec_a: np.ndarray, vec_b: np.ndarray) -> float:
    norm_a = np.linalg.norm(vec_a)
    norm_b = np.linalg.norm(vec_b)
    if norm_a == 0 or norm_b == 0 or not np.isfinite(norm_a) or not np.isfinite(norm_b):
        return 0.0
    return float(np.dot(vec_a, vec_b) / (norm_a * norm_b))


def fetch_assigned_students(backend_url: str, exam_id: str, bridge_key: str) -> dict:
    """Fetches assigned candidates for this exam from the backend API."""
    if not exam_id or exam_id == "local-test":
        return {}
    headers = {"x-pi-bridge-key": bridge_key}
    try:
        url = f"{backend_url.rstrip('/')}/api/exams/{exam_id}/students"
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.ok:
            try:
                data = resp.json()
            except ValueError as exc:
                print(f"[WORKER ERROR] Candidate API returned invalid JSON (HTTP {resp.status_code}): {exc}", file=sys.stderr, flush=True)
                return {}
            students = {}
            if not isinstance(data, list):
                print(f"[WORKER ERROR] Candidate API returned {type(data).__name__}, expected a list (HTTP {resp.status_code}).", file=sys.stderr, flush=True)
                return {}
            skipped_rows = 0
            for item in data:
                if not isinstance(item, dict):
                    skipped_rows += 1
                    continue
                student_data = item.get("student") or item
                if not isinstance(student_data, dict):
                    skipped_rows += 1
                    continue
                s_id = str(student_data.get("id") or item.get("student_id") or "").strip()
                if not s_id:
                    skipped_rows += 1
                    continue
                students[s_id] = {
                    "id": s_id,
                    "name": student_data.get("name") or s_id,
                    "hallTicket": str(student_data.get("hallTicket") or student_data.get("hall_ticket") or student_data.get("hallticket") or "").strip(),
                    "faceEmbedding": student_data.get("faceEmbedding") if student_data.get("faceEmbedding") is not None else student_data.get("face_embedding"),
                    "verification_status": item.get("verification_status") or "unverified",
                }
            if not students:
                print(f"[WORKER WARNING] Candidate API returned HTTP {resp.status_code} with 0 candidates (rows={len(data)}, skipped={skipped_rows}) for exam {exam_id}. Check exam assignment records and database permissions.", file=sys.stderr, flush=True)
            else:
                print(f"[WORKER] Candidate API returned {len(data)} assignment row(s); loaded {len(students)} candidate(s) (skipped={skipped_rows}).", file=sys.stderr, flush=True)
            return students
        else:
            detail = (resp.text or "").strip().replace("\\n", " ")[:300]
            print(f"[WORKER ERROR] Candidate API returned HTTP {resp.status_code} for exam {exam_id}: {detail or '(empty response body)'}", file=sys.stderr, flush=True)
    except Exception as exc:
        print(f"[WORKER INFO] Could not load assigned candidates from backend: {exc}", file=sys.stderr)
    return {}


def normalize_qr_identifier(decoded: str) -> str:
    """Normalize supported QR payloads to a student identifier without guessing."""
    value = str(decoded or "").strip()
    if not value:
        return ""
    # Accept the current plain database ID, plus common structured QR payloads.
    try:
        payload = json.loads(value)
        if isinstance(payload, dict):
            for key in ("id", "student_id", "studentId", "hallTicket", "hall_ticket", "hallticket"):
                candidate = payload.get(key)
                if candidate is not None and str(candidate).strip():
                    return str(candidate).strip()
    except (json.JSONDecodeError, TypeError, ValueError):
        pass
    return value


def match_assigned_student(decoded: str, assigned_students: dict):
    """Match QR payloads against exact enrolled IDs or hall-ticket numbers."""
    normalized = normalize_qr_identifier(decoded)
    if not normalized:
        return None
    for sid, info in assigned_students.items():
        ticket = str(info.get("hallTicket") or "").strip()
        if normalized == str(sid).strip() or (ticket and normalized.casefold() == ticket.casefold()):
            return info
    return None


def scan_qr_code(frame, detector):
    """Decode a QR code using the reference workflow's original/upscaled/enhanced passes."""
    data, points, _ = detector.detectAndDecode(frame)
    if data and data.strip():
        return data.strip(), points

    enlarged = cv2.resize(frame, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    data, points, _ = detector.detectAndDecode(enlarged)
    if data and data.strip():
        return data.strip(), points

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    enlarged_gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    data, points, _ = detector.detectAndDecode(enlarged_gray)
    if data and data.strip():
        return data.strip(), points
    return None, None


def parse_face_embedding(value):
    """Parse and L2-normalize a stored or live 512-D FaceNet embedding."""
    if isinstance(value, str):
        value = json.loads(value)
    vector = np.asarray(value, dtype=np.float32).reshape(-1)
    if vector.shape != (512,) or not np.all(np.isfinite(vector)):
        raise ValueError(f"Expected a finite 512-D embedding, got shape {vector.shape}")
    norm = float(np.linalg.norm(vector))
    if norm <= 0:
        raise ValueError("Embedding has zero norm")
    return vector / norm


def persist_student_verification(backend_url: str, exam_id: str, student_id: str, status: str, bridge_key: str):
    """Persists verification decision to backend API."""
    if not exam_id or exam_id == "local-test":
        return
    headers = {"Content-Type": "application/json", "x-pi-bridge-key": bridge_key}
    try:
        url = f"{backend_url.rstrip('/')}/api/exams/{exam_id}/students/{student_id}"
        resp = requests.put(url, json={"verification_status": status}, headers=headers, timeout=6)
        if not resp.ok:
            print(f"[WORKER WARNING] Failed to persist verification status ({resp.status_code})", file=sys.stderr)
    except Exception as exc:
        print(f"[WORKER WARNING] Could not persist candidate verification: {exc}", file=sys.stderr)


def main() -> int:
    parser = argparse.ArgumentParser(description="Run real ExamShield AI camera & verification inference")
    parser.add_argument("--mode", required=True, choices=["face_verification", "device_detection"])
    parser.add_argument("--weights", required=True, help="Path to an existing Ultralytics .pt model")
    parser.add_argument("--exam-id", default="local-test", help="Exam ID or local-test")
    parser.add_argument("--camera", type=int, default=0, help="OpenCV camera index")
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--headless", action="store_true", help="Do not open an OpenCV preview window")
    parser.add_argument("--check-only", action="store_true", help="Load model, open camera, run 1 frame, then exit")
    parser.add_argument("--window-title", default=None)
    parser.add_argument("--backend-url", default=os.environ.get("EXAMSHIELD_API_BASE", "http://127.0.0.1:3000"))
    parser.add_argument("--embed-url", default=os.environ.get("VITE_EMBED_SERVER_URL", "http://127.0.0.1:5005"))
    parser.add_argument("--bridge-key", default=os.environ.get("PI_BRIDGE_KEY", ""))
    args = parser.parse_args()

    weights = Path(args.weights).expanduser().resolve()
    if not weights.is_file():
        print(f"[WORKER ERROR] Model weights not found: {weights}", file=sys.stderr, flush=True)
        return 2
    if not 0.0 < args.confidence < 1.0:
        print("[WORKER ERROR] --confidence must be between 0 and 1", file=sys.stderr, flush=True)
        return 2

    try:
        model = YOLO(str(weights))
    except Exception as exc:
        print(f"[WORKER ERROR] Failed to load model '{weights}': {exc}", file=sys.stderr, flush=True)
        return 3

    # On Windows DirectShow CAP_DSHOW ensures fast hardware connection; fallback to default if needed
    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_ANY)
    if not cap.isOpened() and sys.platform == "win32":
        cap.release()
        cap = cv2.VideoCapture(args.camera)

    if not cap.isOpened():
        cap.release()
        print(f"[WORKER ERROR] Could not open camera index {args.camera}. Check permissions and ensure no other application is using it.", file=sys.stderr, flush=True)
        return 4

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    names = model.names

    # Preflight check: verify weights, open camera, run one real inference frame, release cleanly
    if args.check_only:
        try:
            ok, frame = cap.read()
            if not ok or frame is None:
                print("[WORKER ERROR] Preflight could not read a camera frame.", file=sys.stderr, flush=True)
                return 5
            result = model.predict(frame, conf=args.confidence, imgsz=args.imgsz, verbose=False)[0]
            detections = parse_detections(result, names)
            emit({
                "event": "preflight_ok",
                "mode": args.mode,
                "exam_id": args.exam_id,
                "weights": str(weights),
                "camera": args.camera,
                "inference_ran": True,
                "detection_count": len(detections),
                "message": "Model loaded, camera opened, and real inference verified successfully."
            })
            return 0
        except Exception as exc:
            print(f"[WORKER ERROR] Preflight inference failed: {exc}", file=sys.stderr, flush=True)
            return 6
        finally:
            cap.release()

    # Load assigned candidates for face verification
    assigned_students = {}
    qr_detector = None
    if args.mode == "face_verification":
        assigned_students = fetch_assigned_students(args.backend_url, args.exam_id, args.bridge_key)
        qr_detector = cv2.QRCodeDetector()
        print(f"[WORKER] Loaded {len(assigned_students)} candidate(s) for exam {args.exam_id}")

    default_title = "ExamShield Laptop Pi — " + ("Candidate Face Verification" if args.mode == "face_verification" else "Prohibited Device Detection")
    window_name = args.window_title or default_title

    emit({
        "event": "worker_ready",
        "mode": args.mode,
        "exam_id": args.exam_id,
        "weights": str(weights),
        "camera": args.camera,
        "class_names": names,
        "candidate_count": len(assigned_students) if args.mode == "face_verification" else None,
        "message": "Face verification runtime active (QR + FaceNet)" if args.mode == "face_verification" else "Device detection active."
    })

    frame_count = 0
    fps_started = time.perf_counter()
    measured_fps = 0.0
    last_verify_attempt_time = {}
    last_qr_scan_time = 0.0
    last_student_refresh_time = time.time()
    active_candidate = None  # QR identifies one candidate; keep them selected while face is checked.
    candidate_started_at = 0.0
    consecutive_matches = 0
    last_similarity = None
    active_verification_feedback = None  # { text, color, expiry }

    try:
        if not args.headless:
            try:
                cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
                emit({"event": "preview_enabled", "mode": args.mode, "window": window_name,
                      "message": "Live preview window initialized. Press Q or Esc in the window to stop."})
            except cv2.error as exc:
                print(f"[WORKER ERROR] Could not create camera preview window: {exc}", file=sys.stderr, flush=True)
                return 7
        else:
            emit({"event": "preview_disabled", "mode": args.mode, "message": "Worker is running in headless mode."})

        while running:
            # Recover assigned candidates if the backend was briefly unavailable at startup.
            if args.mode == "face_verification" and time.time() - last_student_refresh_time >= 10:
                last_student_refresh_time = time.time()
                if not assigned_students:
                    refreshed = fetch_assigned_students(args.backend_url, args.exam_id, args.bridge_key)
                    if refreshed:
                        assigned_students.update(refreshed)
                        emit({
                            "event": "assigned_students_loaded",
                            "exam_id": args.exam_id,
                            "candidate_count": len(assigned_students)
                        })
            ok, frame = cap.read()
            if not ok or frame is None:
                emit({"event": "camera_read_error", "mode": args.mode, "message": "Camera frame could not be read."})
                time.sleep(0.1)
                continue

            try:
                result = model.predict(frame, conf=args.confidence, imgsz=args.imgsz, verbose=False)[0]
            except Exception as exc:
                emit({"event": "inference_error", "mode": args.mode, "message": str(exc)})
                time.sleep(0.25)
                continue

            detections = parse_detections(result, names)
            frame_count += 1
            elapsed = time.perf_counter() - fps_started
            if elapsed >= 1.0:
                measured_fps = frame_count / elapsed
                frame_count = 0
                fps_started = time.perf_counter()

            annotated = frame.copy()

            # -----------------------------------------------------------------
            # FACE VERIFICATION WORKFLOW
            # QR identification is a separate phase. Once a QR is accepted, keep
            # that candidate selected while later frames are used for face matching.
            # -----------------------------------------------------------------
            if args.mode == "face_verification":
                for det in detections:
                    x1, y1, x2, y2 = det["box"]
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 180, 0), 2)
                    cv2.putText(annotated, f"Face {det['confidence']:.2f}", (x1, max(22, y1 - 8)),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 180, 0), 2)

                now_sec = time.time()

                # Phase 1: scan a QR only when no candidate is currently selected.
                if active_candidate is None and qr_detector is not None and now_sec - last_qr_scan_time >= QR_SCAN_RETRY_SECONDS:
                    last_qr_scan_time = now_sec
                    try:
                        decoded, qr_points = scan_qr_code(frame, qr_detector)
                        if decoded:
                            matched_student = match_assigned_student(decoded, assigned_students)
                            if qr_points is not None and len(qr_points) > 0:
                                pts = qr_points[0].astype(int)
                                cv2.polylines(annotated, [pts], True, (0, 255, 255), 2)

                            if not matched_student:
                                active_verification_feedback = {
                                    "text": f"QR NOT ASSIGNED TO THIS EXAM: {decoded[:24]}",
                                    "color": (0, 140, 255),
                                    "expiry": now_sec + 2.5
                                }
                            elif str(matched_student.get("verification_status", "unverified")).lower() == "verified":
                                active_verification_feedback = {
                                    "text": f"{matched_student['name']} ({matched_student['id']}): ALREADY VERIFIED",
                                    "color": (0, 220, 80),
                                    "expiry": now_sec + 2.5
                                }
                            elif not matched_student.get("faceEmbedding"):
                                active_verification_feedback = {
                                    "text": f"{matched_student['name']}: NO REGISTERED FACE EMBEDDING",
                                    "color": (0, 140, 255),
                                    "expiry": now_sec + 3.0
                                }
                            else:
                                # Lock the QR-selected candidate. The QR does NOT need to
                                # remain visible while the person presents their face.
                                active_candidate = matched_student
                                candidate_started_at = now_sec
                                consecutive_matches = 0
                                last_similarity = None
                                last_verify_attempt_time.pop(str(matched_student["id"]), None)
                                active_verification_feedback = {
                                    "text": f"QR ACCEPTED: {matched_student['name']} — LOOK AT CAMERA",
                                    "color": (0, 220, 255),
                                    "expiry": now_sec + 5.0
                                }
                                emit({
                                    "event": "candidate_identified",
                                    "exam_id": args.exam_id,
                                    "student_id": str(matched_student["id"]),
                                    "student_name": str(matched_student["name"]),
                                    "message": "QR accepted; now checking the live face against this candidate's enrolled embedding."
                                })
                    except Exception as qr_err:
                        emit({
                            "event": "qr_scan_error",
                            "exam_id": args.exam_id,
                            "message": f"{type(qr_err).__name__}: {qr_err}"
                        })
                        active_verification_feedback = {
                            "text": f"QR scanner error: {type(qr_err).__name__}",
                            "color": (0, 0, 255),
                            "expiry": now_sec + 2.0
                        }

                # Phase 2: candidate remains selected while we inspect the face.
                if active_candidate is not None:
                    sid = str(active_candidate["id"])
                    sname = str(active_candidate.get("name") or sid)
                    elapsed_candidate = now_sec - candidate_started_at

                    if elapsed_candidate >= CANDIDATE_VERIFY_TIMEOUT_SECONDS:
                        active_verification_feedback = {
                            "text": f"{sname}: VERIFICATION TIMED OUT — SCAN QR AGAIN",
                            "color": (0, 140, 255),
                            "expiry": now_sec + 4.0
                        }
                        emit({"event": "verification_timeout", "exam_id": args.exam_id, "student_id": sid})
                        active_candidate = None
                        consecutive_matches = 0
                        last_similarity = None
                    elif now_sec - last_verify_attempt_time.get(sid, 0.0) >= FACE_VERIFY_RETRY_SECONDS:
                        if len(detections) == 0:
                            consecutive_matches = 0
                            last_similarity = None
                            active_verification_feedback = {
                                "text": f"{sname}: SHOW ONE FACE TO THE CAMERA",
                                "color": (0, 200, 255),
                                "expiry": now_sec + 1.5
                            }
                        elif len(detections) > 1:
                            consecutive_matches = 0
                            last_similarity = None
                            active_verification_feedback = {
                                "text": f"{sname}: MULTIPLE FACES — ONLY ONE PERSON ALLOWED",
                                "color": (0, 0, 255),
                                "expiry": now_sec + 2.0
                            }
                        else:
                            last_verify_attempt_time[sid] = now_sec
                            # Use the YOLO face box to crop the actual face before asking
                            # the existing FaceNet microservice for a 512-D embedding.
                            x1, y1, x2, y2 = detections[0]["box"]
                            h, w = frame.shape[:2]
                            # Add a small margin so the embedding service gets context
                            # around the face instead of a tightly clipped forehead/chin.
                            margin_x = int(max(0, x2 - x1) * 0.20)
                            margin_y = int(max(0, y2 - y1) * 0.20)
                            x1, x2 = max(0, x1 - margin_x), min(w, x2 + margin_x)
                            y1, y2 = max(0, y1 - margin_y), min(h, y2 + margin_y)
                            face_crop = frame[y1:y2, x1:x2] if x2 > x1 and y2 > y1 else None

                            if face_crop is None or face_crop.size == 0:
                                active_verification_feedback = {
                                    "text": f"{sname}: FACE CROP INVALID — REPOSITION",
                                    "color": (0, 140, 255),
                                    "expiry": now_sec + 2.0
                                }
                            else:
                                try:
                                    _, buf = cv2.imencode(".jpg", face_crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
                                    b64_image = base64.b64encode(buf).decode("utf-8")
                                    embed_endpoint = args.embed_url.rstrip("/")
                                    if not embed_endpoint.endswith("/embed"):
                                        embed_endpoint += "/embed"
                                    resp = requests.post(embed_endpoint, json={"image_b64": b64_image}, timeout=6)

                                    if resp.ok:
                                        emb_body = resp.json()
                                        live_raw = emb_body.get("embedding")
                                        stored_raw = active_candidate.get("faceEmbedding")
                                        if live_raw is None or stored_raw is None:
                                            raise ValueError("Live or enrolled FaceNet embedding is missing")
                                        live_vec = parse_face_embedding(live_raw)
                                        stored_vec = parse_face_embedding(stored_raw)
                                        sim = cosine_similarity(live_vec, stored_vec)
                                        last_similarity = sim

                                        if sim >= MATCH_THRESHOLD:
                                            consecutive_matches += 1
                                            active_verification_feedback = {
                                                "text": f"MATCH {consecutive_matches}/{REQUIRED_CONSECUTIVE_MATCHES}: {sname} ({sim*100:.1f}%)",
                                                "color": (0, 220, 80),
                                                "expiry": now_sec + 2.0
                                            }
                                            if consecutive_matches >= REQUIRED_CONSECUTIVE_MATCHES:
                                                active_candidate["verification_status"] = "verified"
                                                persist_student_verification(args.backend_url, args.exam_id, sid, "verified", args.bridge_key)
                                                emit({
                                                    "event": "verification_result",
                                                    "student_id": sid,
                                                    "student_name": sname,
                                                    "status": "verified",
                                                    "similarity": round(sim, 4),
                                                    "threshold": MATCH_THRESHOLD,
                                                    "consecutive_matches": consecutive_matches
                                                })
                                                active_verification_feedback = {
                                                    "text": f"VERIFIED: {sname} ({sim*100:.1f}%) — SCAN NEXT QR",
                                                    "color": (0, 255, 0),
                                                    "expiry": now_sec + 4.0
                                                }
                                                active_candidate = None
                                                consecutive_matches = 0
                                                last_similarity = None
                                                if assigned_students and all(str(student.get("verification_status", "")).lower() == "verified" for student in assigned_students.values()):
                                                    emit({"event": "all_students_verified", "exam_id": args.exam_id})
                                        else:
                                            consecutive_matches = 0
                                            emit({
                                                "event": "verification_result",
                                                "student_id": sid,
                                                "student_name": sname,
                                                "status": "failed",
                                                "similarity": round(sim, 4),
                                                "threshold": MATCH_THRESHOLD,
                                                "consecutive_matches": 0
                                            })
                                            persist_student_verification(args.backend_url, args.exam_id, sid, "failed", args.bridge_key)
                                            active_verification_feedback = {
                                                "text": f"MISMATCH: {sname} ({sim*100:.1f}%) — TRY AGAIN",
                                                "color": (0, 0, 255),
                                                "expiry": now_sec + 2.0
                                            }
                                    elif resp.status_code == 400:
                                        err_json = {}
                                        try:
                                            err_json = resp.json()
                                        except Exception:
                                            pass
                                        face_count = err_json.get("face_count", 0)
                                        consecutive_matches = 0
                                        message = "NO FACE FOUND — LOOK AT CAMERA" if face_count == 0 else f"MULTIPLE FACES ({face_count}) — ONLY ONE PERSON ALLOWED"
                                        active_verification_feedback = {
                                            "text": f"{sname}: {message}",
                                            "color": (0, 140, 255),
                                            "expiry": now_sec + 2.0
                                        }
                                    else:
                                        active_verification_feedback = {
                                            "text": f"FaceNet error ({resp.status_code}): {(resp.text or '')[:60]}",
                                            "color": (0, 0, 255),
                                            "expiry": now_sec + 2.0
                                        }
                                except (ValueError, TypeError, json.JSONDecodeError) as emb_err:
                                    consecutive_matches = 0
                                    active_verification_feedback = {
                                        "text": f"{sname}: EMBEDDING ERROR — {str(emb_err)[:45]}",
                                        "color": (0, 0, 255),
                                        "expiry": now_sec + 2.5
                                    }
                                except Exception as net_err:
                                    active_verification_feedback = {
                                        "text": f"FaceNet service error: {str(net_err)[:55]}",
                                        "color": (0, 0, 255),
                                        "expiry": now_sec + 2.5
                                    }

                # Draw top status bar
                cv2.rectangle(annotated, (0, 0), (annotated.shape[1], 44), (20, 20, 25), -1)
                stage_text = f"VERIFYING: {active_candidate.get('name', active_candidate.get('id'))}" if active_candidate else "SCAN STUDENT QR CODE"
                cv2.putText(annotated, f"QR → FACE MATCH | {stage_text} | FPS: {measured_fps:.1f}", (14, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 220, 255), 2)

                # Show feedback banner if active
                if args.mode == "face_verification" and not assigned_students:
                    cv2.putText(
                        annotated,
                        "WARNING: No assigned students loaded; check backend/API connection",
                        (14, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (0, 0, 255), 2
                    )
                if active_verification_feedback and time.time() < active_verification_feedback["expiry"]:
                    fb_text = active_verification_feedback["text"]
                    fb_color = active_verification_feedback["color"]
                    cv2.rectangle(annotated, (0, annotated.shape[0] - 50), (annotated.shape[1], annotated.shape[0]), (15, 15, 20), -1)
                    cv2.putText(annotated, fb_text, (16, annotated.shape[0] - 18),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.75, fb_color, 2)

                emit({
                    "event": "inference_frame",
                    "mode": args.mode,
                    "exam_id": args.exam_id,
                    "fps": round(measured_fps, 2),
                    "detection_count": len(detections),
                    "timestamp": time.time(),
                })

            # -----------------------------------------------------------------
            # DEVICE DETECTION WORKFLOW (Prohibited Devices: phone, earbuds, etc.)
            # -----------------------------------------------------------------
            else:
                for det in detections:
                    x1, y1, x2, y2 = det["box"]
                    label = f"{det['label'].upper()} {det['confidence']:.2f}"
                    cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(annotated, label, (x1, max(22, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 0, 255), 2)

                cv2.rectangle(annotated, (0, 0), (annotated.shape[1], 44), (20, 20, 25), -1)
                cv2.putText(annotated, f"PROHIBITED DEVICE DETECTION | FPS: {measured_fps:.1f}", (14, 28),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 140), 2)

                emit({
                    "event": "inference_frame",
                    "mode": args.mode,
                    "exam_id": args.exam_id,
                    "fps": round(measured_fps, 2),
                    "detection_count": len(detections),
                    "detections": detections,
                    "timestamp": time.time(),
                })

            if not args.headless:
                cv2.imshow(window_name, annotated)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), 27):
                    break
    finally:
        cap.release()
        if not args.headless:
            cv2.destroyAllWindows()
        emit({"event": "worker_stopped", "mode": args.mode, "exam_id": args.exam_id, "camera_released": True})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
