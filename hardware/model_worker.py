#!/usr/bin/env python3
"""
===================================================================
ExamShield AI — Pi 4 Model Worker
===================================================================
Launched / terminated by raspberry_pi_bridge.py. One worker process runs
exactly ONE .pt model (face_verification OR device_detection) and releases
the camera cleanly on SIGTERM so the other model can start afterwards.

Usage (normally invoked by the bridge):
    python3 model_worker.py --mode device_detection \
        --weights models/device_detection.pt --exam-id <uuid>

NOTE: This is a thin runner (camera -> model -> hook). Plug your own
post-processing into `handle_face_verification` / `handle_device_detection`
(e.g. match faces against enrolled students and update exam_students,
or POST confirmed device incidents to the server).
===================================================================
"""

import argparse
import signal
import sys
import time

import cv2
from ultralytics import YOLO

running = True


def _shutdown(signum, frame):
    global running
    running = False


signal.signal(signal.SIGTERM, _shutdown)
signal.signal(signal.SIGINT, _shutdown)


def handle_face_verification(results, exam_id):
    """Hook: compare detected faces with enrolled students of `exam_id`."""
    pass


def handle_device_detection(results, exam_id):
    """Hook: raise incidents for unauthorized devices (see trigger_ai_cheating_alert in the bridge)."""
    pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=["face_verification", "device_detection"])
    parser.add_argument("--weights", required=True)
    parser.add_argument("--exam-id", required=True)
    parser.add_argument("--camera", type=int, default=0)
    args = parser.parse_args()

    model = YOLO(args.weights)
    cap = cv2.VideoCapture(args.camera)
    if not cap.isOpened():
        print(f"[WORKER] Could not open camera {args.camera}", file=sys.stderr)
        sys.exit(2)

    handler = handle_face_verification if args.mode == "face_verification" else handle_device_detection
    print(f"[WORKER] {args.mode} running for exam {args.exam_id}")

    try:
        while running:
            ok, frame = cap.read()
            if not ok:
                time.sleep(0.05)
                continue
            results = model(frame, verbose=False)
            handler(results, args.exam_id)
    finally:
        cap.release()
        print(f"[WORKER] {args.mode} stopped, camera released")


if __name__ == "__main__":
    main()
