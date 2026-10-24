#!/usr/bin/env python3
"""Standalone laptop runtime for simulating the Raspberry Pi camera/AI loop.

Run from the project root:
  python hardware/laptop_pi_runtime.py --mode device_detection
  python hardware/laptop_pi_runtime.py --mode face_verification

This launches the same model worker used by the bridge, but directly and with
an OpenCV preview window. It is intentionally separate from the Admin Exams UI.
Only one runtime process should own the webcam at a time.
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HARDWARE_DIR = Path(__file__).resolve().parent
DEFAULT_MODELS = {
    "device_detection": ROOT / "models" / "new_device_latest.pt",
    "face_verification": ROOT / "models" / "ExamShield_face_detector_best.pt",
}


def main() -> int:
    parser = argparse.ArgumentParser(description="Run ExamShield's standalone laptop-as-Pi camera runtime")
    parser.add_argument("--mode", choices=sorted(DEFAULT_MODELS), default="device_detection")
    parser.add_argument("--camera", type=int, default=int(os.environ.get("EXAMSHIELD_CAMERA_INDEX", "0")))
    parser.add_argument("--weights", help="Override the model path; defaults to the existing project model")
    parser.add_argument("--exam-id", default="local-test", help="Exam identifier for event logs; no database update is made by this standalone mode")
    parser.add_argument("--confidence", type=float, default=0.35)
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()

    weights = Path(args.weights).expanduser() if args.weights else DEFAULT_MODELS[args.mode]
    if not weights.is_absolute():
        weights = (Path.cwd() / weights).resolve()
    if not weights.is_file():
        print(f"ERROR: model file not found: {weights}", file=sys.stderr)
        print("Expected existing model files under the project's models/ directory.", file=sys.stderr)
        return 2

    worker = HARDWARE_DIR / "model_worker.py"
    command = [
        sys.executable, str(worker),
        "--mode", args.mode,
        "--weights", str(weights),
        "--exam-id", args.exam_id,
        "--camera", str(args.camera),
        "--confidence", str(args.confidence),
        "--imgsz", str(args.imgsz),
        "--window-title", f"ExamShield Laptop Pi — {args.mode}",
    ]
    print("=" * 68)
    print("EXAMSHIELD — STANDALONE LAPTOP PI RUNTIME")
    print("Real webcam + existing .pt model; not launched from the website.")
    print(f"Mode   : {args.mode}")
    print(f"Camera : {args.camera}")
    print(f"Model  : {weights}")
    if args.mode == "face_verification":
        print("NOTE   : This .pt model detects face locations only; it does not identify students.")
    print("Close the preview with Q or Esc, or press Ctrl+C in this terminal.")
    print("=" * 68, flush=True)
    try:
        completed = subprocess.run(command, cwd=str(ROOT), check=False)
        return int(completed.returncode)
    except KeyboardInterrupt:
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
