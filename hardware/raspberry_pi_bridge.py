#!/usr/bin/env python3
"""
===================================================================
ExamShield AI — Raspberry Pi Master Hardware Bridge
===================================================================
Role:
- Connects to ExamShield Express Backend via WebSocket & REST API
- Communicates with ESP32 Motor Controller over UART Serial (or laptop fallback)
- Manages AI camera model worker subprocess lifecycle
- Enforces single-model mutual exclusivity and camera ownership
- Relays real detections, measured inference FPS, and candidate verification
- Reports live hardware/rover telemetry
===================================================================
"""

import time
import json
import threading
import serial
import requests
import websocket
import os
import sys
import signal
import subprocess
from pathlib import Path


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


# --- CONFIGURATION ---
EXAMSHIELD_SERVER_HOST = os.environ.get("EXAMSHIELD_SERVER_HOST", "127.0.0.1")
EXAMSHIELD_PORT = int(os.environ.get("EXAMSHIELD_SERVER_PORT", "3000"))
EXAMSHIELD_SCHEME = os.environ.get("EXAMSHIELD_WS_SCHEME", "ws")
WS_URL = os.environ.get("EXAMSHIELD_WS_URL", f"{EXAMSHIELD_SCHEME}://{EXAMSHIELD_SERVER_HOST}:{EXAMSHIELD_PORT}/ws")
ALERT_API = os.environ.get("EXAMSHIELD_ALERT_API", f"http://{EXAMSHIELD_SERVER_HOST}:{EXAMSHIELD_PORT}/api/alerts/trigger")
API_BASE_URL = os.environ.get("EXAMSHIELD_API_BASE", f"http://{EXAMSHIELD_SERVER_HOST}:{EXAMSHIELD_PORT}")

# ESP32 Serial Port Configuration
SERIAL_PORT = os.environ.get("EXAMSHIELD_SERIAL_PORT", "/dev/ttyUSB0" if os.name != "nt" else "COM3")
BAUD_RATE = 115200

# Shared secret so the server accepts this Pi (must match PI_BRIDGE_KEY in the server .env)
PI_BRIDGE_KEY = os.environ.get("PI_BRIDGE_KEY", "").strip()
CAMERA_INDEX = int(os.environ.get("EXAMSHIELD_CAMERA_INDEX", "0"))


def is_headless():
    val = os.environ.get("EXAMSHIELD_HEADLESS_WORKER")
    if val is not None:
        return val.strip().lower() in ("1", "true", "yes")
    # Windows laptop runtime: show OpenCV live preview window by default
    # Linux / Raspberry Pi: run headless by default unless explicitly configured
    return os.name != "nt"


# --- AI MODEL WORKERS (.pt files deployed on this Pi) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
DEFAULT_MODEL_DIR = os.path.join(PROJECT_ROOT, "models")
MODEL_DIR = os.path.abspath(os.environ.get("EXAMSHIELD_MODEL_DIR", DEFAULT_MODEL_DIR))
MODEL_CONFIG = {
    "face_verification": {
        "weights": os.path.join(MODEL_DIR, "ExamShield_face_detector_best.pt"),
        "worker_args": ["--mode", "face_verification"],
    },
    "device_detection": {
        "weights": os.path.join(MODEL_DIR, "new_device_latest.pt"),
        "worker_args": ["--mode", "device_detection"],
    },
}
WORKER_SCRIPT = os.path.join(BASE_DIR, "model_worker.py")
STOP_TIMEOUT_SEC = 6

# Global Hardware State
rover_state = {
    "battery": 95.0,
    "speed": 0.0,
    "posX": 50,
    "posY": 50,
    "temperature": 40.0,
    "motorStatus": "Operational",
    "wifiStatus": "-52 dBm (Strong)"
}

ser = None

# Model supervisor state: only ONE model process may exist at any time
model_lock = threading.RLock()
model_proc = None          # subprocess.Popen of the running worker
active_model = "none"      # "face_verification" | "device_detection" | "none"
active_exam_id = None
active_exam_end_time = None  # UNIX timestamp (seconds) for local scheduled-end enforcement
model_lifecycle_state = "stopped"  # "stopped" | "running" | "paused"
current_measured_fps = None
last_model_error = None
last_device_alert_times = {}  # device_label -> timestamp (seconds)
ws_ref = None

# Telemetry thread tracking to prevent thread accumulation on reconnects
telemetry_thread = None
telemetry_stop_event = threading.Event()


def parse_timestamp_seconds(raw):
    """Safely converts ISO timestamp or millisecond/second epoch to POSIX seconds."""
    if raw is None or raw == "":
        return None
    if isinstance(raw, (int, float)):
        return raw / 1000.0 if raw > 1e11 else float(raw)
    try:
        val = float(raw)
        return val / 1000.0 if val > 1e11 else val
    except (ValueError, TypeError):
        pass
    try:
        from datetime import datetime
        raw_str = str(raw).strip()
        if raw_str.endswith("Z"):
            raw_str = raw_str[:-1] + "+00:00"
        return datetime.fromisoformat(raw_str).timestamp()
    except Exception:
        return None


def init_serial():
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"[SERIAL] Connected to ESP32 on {SERIAL_PORT} @ {BAUD_RATE}")
    except Exception as e:
        print(f"[SERIAL INFO] Hardware serial port {SERIAL_PORT} unavailable: {e}")
        print("[SERIAL INFO] Running in Windows laptop simulation / software relay mode.")


def send_to_esp32(cmd_str):
    """Sends raw movement string command to ESP32 over UART"""
    if ser and ser.is_open:
        try:
            full_cmd = f"{cmd_str}\n"
            ser.write(full_cmd.encode('utf-8'))
            print(f"[UART -> ESP32] Sent: {cmd_str}")
        except Exception as e:
            print(f"[UART ERROR] Failed to send command to ESP32: {e}")
    else:
        print(f"[LAPTOP RELAY] Motor command: {cmd_str}")


def read_cpu_temperature():
    """Return measured Linux thermal-zone temperature, or None when unavailable."""
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r", encoding="utf-8") as f:
            temp = float(f.read().strip()) / 1000.0
            return round(temp, 1)
    except (OSError, ValueError):
        # Windows/macOS/laptops may not expose the Pi thermal-zone file.
        return None


def listen_esp32_serial():
    """Reads telemetry responses from ESP32 in background thread"""
    global rover_state
    while True:
        if ser and ser.is_open:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if line.startswith("TELEMETRY:BATT:"):
                    batt_val = float(line.split("TELEMETRY:BATT:")[1])
                    rover_state["battery"] = round(batt_val, 1)
                elif line.startswith("STATUS:"):
                    status_msg = line.split("STATUS:")[1]
                    print(f"[ESP32 STATUS] {status_msg}")
            except Exception:
                pass
        time.sleep(0.1)


def map_command_to_esp32(command):
    """Maps ExamShield Web Dashboard commands to ESP32 hardware UART protocol"""
    mapping = {
        "fwd": "FWD",
        "bwd": "BWD",
        "left": "LEFT",
        "right": "RIGHT",
        "stop": "STOP",
        "estop": "ESTOP"
    }
    esp_cmd = mapping.get(command, "STOP")
    send_to_esp32(esp_cmd)


def _ws_send(payload):
    try:
        if ws_ref:
            ws_ref.send(json.dumps(payload))
    except Exception as e:
        print(f"[WS SEND ERROR] {e}")


def report_model_status():
    _ws_send({
        "type": "MODEL_STATUS",
        "activeModel": active_model,
        "examId": active_exam_id,
        "status": model_lifecycle_state,
        "error": last_model_error,
        "fps": current_measured_fps if model_lifecycle_state == "running" else None,
        "localEndTime": active_exam_end_time
    })


def _stop_model_locked():
    """Terminates the running worker and waits until the process (and camera) is released."""
    global model_proc, active_model, active_exam_id, active_exam_end_time, model_lifecycle_state, current_measured_fps
    if model_proc is not None:
        if model_proc.poll() is None:
            model_proc.terminate()
            try:
                model_proc.wait(timeout=STOP_TIMEOUT_SEC)
            except subprocess.TimeoutExpired:
                print("[MODEL] Worker did not exit on SIGTERM, killing...")
                model_proc.kill()
                model_proc.wait()
        print(f"[MODEL] Stopped {active_model}")
    model_proc = None
    active_model = "none"
    active_exam_id = None
    active_exam_end_time = None
    model_lifecycle_state = "stopped"
    current_measured_fps = None


def read_worker_stderr(proc, model, exam_id):
    """Drain worker stderr continuously so diagnostic output cannot block the process."""
    if proc.stderr is None:
        return
    try:
        for line in iter(proc.stderr.readline, ""):
            message = line.strip()
            if message:
                print(f"[{model.upper()} WORKER STDERR] {message}")
    except Exception as exc:
        print(f"[{model.upper()} WORKER STDERR] Reader ended for exam {exam_id}: {exc}")


def read_worker_events(proc, model, exam_id):
    """Background reader that parses machine-readable JSON events from the model worker."""
    global current_measured_fps, last_model_error, model_proc, active_model, active_exam_id, active_exam_end_time, model_lifecycle_state
    if proc.stdout is None:
        return

    try:
        for line in iter(proc.stdout.readline, ""):
            line_str = line.strip()
            if not line_str:
                continue
            try:
                event = json.loads(line_str)
            except Exception:
                print(f"[{model.upper()} WORKER LOG] {line_str}")
                continue

            ev_type = event.get("event")
            if ev_type == "worker_ready":
                with model_lock:
                    if model_proc is proc:
                        model_lifecycle_state = "running"
                        last_model_error = None
                report_model_status()
            elif ev_type == "camera_read_error":
                last_model_error = event.get("message", "Camera frame read error")
                report_model_status()
            elif ev_type == "inference_error":
                last_model_error = event.get("message", "Inference error")
                report_model_status()
            elif ev_type == "inference_frame":
                fps = event.get("fps")
                if isinstance(fps, (int, float)):
                    current_measured_fps = round(float(fps), 2)

                if model == "device_detection":
                    dets = event.get("detections", [])
                    for d in dets:
                        label = str(d.get("label", "prohibited_device")).lower()
                        conf = float(d.get("confidence", 0.0))
                        now_ts = time.time()
                        last_alert_ts = last_device_alert_times.get(label, 0)
                        if now_ts - last_alert_ts > 8:  # Throttle alerts per device class
                            last_device_alert_times[label] = now_ts
                            trigger_ai_cheating_alert(
                                f"Prohibited Device Detected: {label.upper()}",
                                "HIGH" if label in ("phone", "smartwatch") else "MEDIUM",
                                "Exam Hall Camera",
                                f"Live YOLO detection: {label} (confidence: {conf:.2f}) during Exam {exam_id}"
                            )
            elif ev_type == "verification_result":
                student_id = event.get("student_id")
                student_name = event.get("student_name")
                status = event.get("status")
                similarity = event.get("similarity")
                print(f"[BIOMETRIC RESULT] Student: {student_name} ({student_id}) -> {status.upper()} (Similarity: {similarity})")
                _ws_send({
                    "type": "CANDIDATE_VERIFIED",
                    "examId": exam_id,
                    "studentId": student_id,
                    "studentName": student_name,
                    "status": status,
                    "similarity": similarity
                })
            elif ev_type == "all_students_verified":
                print(f"[BIOMETRIC] All enrolled candidates verified for exam {exam_id}. Stopping face verification cleanly.")
                with model_lock:
                    _stop_model_locked()
                report_model_status()
                _ws_send({
                    "type": "ALL_STUDENTS_VERIFIED",
                    "examId": exam_id
                })
            elif ev_type == "worker_stopped":
                print(f"[MODEL] Worker for {model} confirmed camera released.")
    finally:
        with model_lock:
            if model_proc is proc:
                ret = proc.poll()
                if ret is None:
                    try:
                        ret = proc.wait(timeout=1)
                    except Exception:
                        pass
                print(f"[MODEL] Worker {model} for exam {exam_id} process finished (return code {ret}).")
                if ret is not None and ret != 0:
                    last_model_error = f"{model} worker exited with code {ret}"
                model_proc = None
                active_model = "none"
                active_exam_id = None
                active_exam_end_time = None
                model_lifecycle_state = "stopped"
                current_measured_fps = None
        report_model_status()


def prepare_model(model, exam_id):
    """Preflight a model and camera without leaving inference running."""
    global last_model_error
    cfg = MODEL_CONFIG.get(model)
    if not cfg:
        return False, f"Unknown model '{model}'"
    with model_lock:
        if model_proc is not None and model_proc.poll() is None:
            return False, f"Cannot preflight while {active_model} is using the camera"
        if not os.path.isfile(cfg["weights"]):
            last_model_error = f"Weights not found: {cfg['weights']}"
            return False, last_model_error
        cmd = [
            sys.executable, WORKER_SCRIPT, *cfg["worker_args"],
            "--weights", cfg["weights"], "--exam-id", str(exam_id),
            "--camera", str(CAMERA_INDEX), "--check-only", "--headless"
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        except subprocess.TimeoutExpired:
            last_model_error = f"Preflight timed out for {model}"
            return False, last_model_error
        except Exception as exc:
            last_model_error = str(exc)
            return False, last_model_error
        if result.returncode != 0:
            detail = (result.stderr or result.stdout or f"exit code {result.returncode}").strip()
            last_model_error = detail[-1200:]
            return False, f"Preflight failed for {model}: {last_model_error}"
        last_model_error = None
        print(f"[MODEL PREFLIGHT] {model} passed for exam {exam_id}; camera released cleanly")
        return True, None


def start_model(model, exam_id, end_time_sec=None, start_time_sec=None):
    """Starts one .pt model worker. Refuses if a different model is running (no parallel runs)."""
    global model_proc, active_model, active_exam_id, active_exam_end_time, model_lifecycle_state, last_model_error, current_measured_fps
    cfg = MODEL_CONFIG.get(model)
    if not cfg:
        return False, f"Unknown model '{model}'"

    now_sec = time.time()
    if model == "device_detection":
        if start_time_sec is not None and now_sec < (start_time_sec - 1.0):
            msg = f"Cannot start device detection before scheduled start time (current={now_sec:.0f}, start={start_time_sec:.0f})."
            print(f"[BRIDGE GUARD] {msg}")
            return False, msg
        if end_time_sec is not None and now_sec >= end_time_sec:
            msg = f"Cannot start device detection: scheduled exam has already ended (current={now_sec:.0f}, end={end_time_sec:.0f})."
            print(f"[BRIDGE GUARD] {msg}")
            return False, msg

    if model == "face_verification":
        if end_time_sec is not None and now_sec >= end_time_sec:
            msg = f"Cannot start face verification: scheduled exam has already ended (current={now_sec:.0f}, end={end_time_sec:.0f})."
            print(f"[BRIDGE GUARD] {msg}")
            return False, msg

    with model_lock:
        if model_proc is not None and model_proc.poll() is None:
            if active_model == model and str(active_exam_id) == str(exam_id):
                model_lifecycle_state = "running"
                if end_time_sec:
                    active_exam_end_time = end_time_sec
                return True, None  # already running
            return False, f"{active_model} is still running; stop it first"
        if not os.path.isfile(cfg["weights"]):
            last_model_error = f"Weights not found: {cfg['weights']}"
            return False, last_model_error

        cmd = [
            sys.executable, WORKER_SCRIPT, *cfg["worker_args"],
            "--weights", cfg["weights"],
            "--exam-id", str(exam_id),
            "--camera", str(CAMERA_INDEX),
            "--backend-url", API_BASE_URL,
            "--bridge-key", PI_BRIDGE_KEY
        ]

        if is_headless():
            cmd.append("--headless")
        else:
            print(f"[MODEL] Live OpenCV camera preview enabled on Windows laptop runtime (camera index {CAMERA_INDEX}).")

        try:
            model_proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1
            )
        except Exception as e:
            last_model_error = str(e)
            return False, last_model_error

        time.sleep(1.0)  # Check for immediate crash on startup
        if model_proc.poll() is not None:
            err_output = model_proc.stderr.read() if model_proc.stderr else ""
            last_model_error = f"{model} worker exited immediately (code {model_proc.returncode}): {err_output[:300]}"
            model_proc = None
            model_lifecycle_state = "stopped"
            return False, last_model_error

        active_model = model
        active_exam_id = exam_id
        active_exam_end_time = end_time_sec
        model_lifecycle_state = "running"
        current_measured_fps = None
        last_model_error = None
        print(f"[MODEL] Started {model} for exam {exam_id} (pid {model_proc.pid}), scheduled end={active_exam_end_time}")

        # Start thread to read machine-readable stdout events from worker
        threading.Thread(
            target=read_worker_events,
            args=(model_proc, model, exam_id),
            daemon=True
        ).start()
        threading.Thread(
            target=read_worker_stderr,
            args=(model_proc, model, exam_id),
            daemon=True
        ).start()

        return True, None


def pause_model(model):
    """Pauses detection by stopping worker process and marking state paused."""
    global active_exam_id, active_exam_end_time, model_lifecycle_state
    with model_lock:
        if active_model == model:
            saved_exam_id = active_exam_id
            saved_end_time = active_exam_end_time
            _stop_model_locked()
            model_lifecycle_state = "paused"
            active_exam_id = saved_exam_id
            active_exam_end_time = saved_end_time
            print(f"[MODEL] Paused {model} for exam {saved_exam_id}")
            return True, None
        elif model_lifecycle_state == "paused":
            return True, None  # Idempotent
        return True, None


def resume_model(model, exam_id, end_time_sec=None, start_time_sec=None):
    """Resumes detection for paused worker if exam is still valid."""
    now_sec = time.time()
    if end_time_sec and now_sec >= end_time_sec:
        return False, "Cannot resume: scheduled exam end time has already elapsed."
    if model == "device_detection" and start_time_sec and now_sec < (start_time_sec - 1.0):
        return False, "Cannot resume: exam scheduled start time has not yet arrived."
    return start_model(model, exam_id, end_time_sec, start_time_sec)


def stop_model(model):
    with model_lock:
        if active_model == model or model_lifecycle_state == "paused":
            _stop_model_locked()
        return True, None


def model_watchdog():
    """Detects worker crashes, enforces local scheduled-end locally, and reports state."""
    global model_proc, active_model, active_exam_id, active_exam_end_time, model_lifecycle_state, last_model_error
    while True:
        time.sleep(3)
        with model_lock:
            # 1. Local scheduled-end enforcement (protects against network disconnect)
            if active_model != "none" and active_exam_end_time is not None:
                if time.time() >= active_exam_end_time:
                    print(f"[LOCAL END ENFORCEMENT] Exam {active_exam_id} end time reached ({active_exam_end_time}). Stopping {active_model} locally.")
                    _stop_model_locked()
                    last_model_error = None

            # 2. Crash watchdog
            if model_proc is not None and model_proc.poll() is not None:
                ret = model_proc.returncode
                if ret != 0:
                    last_model_error = f"{active_model} worker crashed (code {ret})"
                    print(f"[MODEL] {last_model_error}")
                else:
                    last_model_error = None
                model_proc = None
                active_model = "none"
                active_exam_id = None
                active_exam_end_time = None
                model_lifecycle_state = "stopped"
        report_model_status()


def handle_model_command(data):
    request_id = data.get("requestId")
    model = data.get("model")
    action = data.get("action")
    exam_id = data.get("examId")
    
    start_time_sec = data.get("startTimeSec")
    if start_time_sec is None:
        start_time_sec = parse_timestamp_seconds(data.get("startTime"))
    else:
        try:
            start_time_sec = float(start_time_sec)
        except Exception:
            start_time_sec = None

    end_time_sec = data.get("endTimeSec")
    if end_time_sec is None:
        end_time_sec = parse_timestamp_seconds(data.get("endTime"))
    else:
        try:
            end_time_sec = float(end_time_sec)
        except Exception:
            end_time_sec = None

    print(f"[MODEL COMMAND] action='{action}' model='{model}' exam='{exam_id}' startSec={start_time_sec} endSec={end_time_sec}")

    if action == "start":
        ok, err = start_model(model, exam_id, end_time_sec, start_time_sec)
    elif action == "stop":
        ok, err = stop_model(model)
    elif action == "pause":
        ok, err = pause_model(model)
    elif action == "resume":
        ok, err = resume_model(model, exam_id, end_time_sec, start_time_sec)
    elif action == "prepare":
        ok, err = prepare_model(model, exam_id)
    else:
        ok, err = False, f"Unknown action '{action}'"

    _ws_send({
        "type": "MODEL_ACK",
        "requestId": request_id,
        "ok": ok,
        "error": err,
        "model": model,
        "actualState": model_lifecycle_state
    })
    report_model_status()


def on_ws_message(ws, message):
    try:
        data = json.loads(message)
        msg_type = data.get("type")

        # Received command broadcast from ExamShield Dashboard
        if msg_type == "ROVER_UPDATE" and "lastCommand" in data.get("rover", {}):
            cmd = data["rover"]["lastCommand"]
            print(f"[WEB UI COMMAND] {cmd}")
            map_command_to_esp32(cmd)

        # Model start/stop/pause/resume from dashboard
        elif msg_type == "MODEL_COMMAND":
            threading.Thread(target=handle_model_command, args=(data,), daemon=True).start()

        # Server-initiated reconciliation packet on reconnection
        elif msg_type == "RECONCILE_STATE":
            desired_model = data.get("desiredModel") or data.get("activeModel", "none")
            if desired_model == "prohibited_device":
                desired_model = "device_detection"
            desired_exam_id = data.get("examId")
            is_paused = bool(data.get("isPaused", False))
            desired_status = "paused" if is_paused else data.get("status", "running" if desired_model != "none" else "stopped")
            
            start_time_sec = data.get("startTimeSec")
            if start_time_sec is None:
                start_time_sec = parse_timestamp_seconds(data.get("startTime"))
            else:
                try:
                    start_time_sec = float(start_time_sec)
                except Exception:
                    start_time_sec = None

            end_time_sec = data.get("endTimeSec")
            if end_time_sec is None:
                end_time_sec = parse_timestamp_seconds(data.get("endTime"))
            else:
                try:
                    end_time_sec = float(end_time_sec)
                except Exception:
                    end_time_sec = None

            print(f"[RECONCILE] Desired state from server: model='{desired_model}', exam='{desired_exam_id}', status='{desired_status}'")
            with model_lock:
                if desired_status == "stopped" or desired_model == "none":
                    if active_model != "none":
                        _stop_model_locked()
                elif desired_status == "paused":
                    pause_model(desired_model)
                elif desired_status == "running" and desired_model in MODEL_CONFIG:
                    now_sec = time.time()
                    # A reconnect must not launch device detection for a future exam.
                    if desired_model == "device_detection" and (
                        start_time_sec is None or end_time_sec is None or
                        not (start_time_sec <= now_sec < end_time_sec)
                    ):
                        print(f"[RECONCILE] Refusing device detection: exam is not currently in scheduled window (now={now_sec:.0f}, start={start_time_sec}, end={end_time_sec}).")
                        if active_model != "none":
                            _stop_model_locked()
                    elif end_time_sec is not None and now_sec >= end_time_sec:
                        print(f"[RECONCILE] Refusing model start: scheduled exam has ended (now={now_sec:.0f}, end={end_time_sec}).")
                        if active_model != "none":
                            _stop_model_locked()
                    elif active_model != desired_model or str(active_exam_id) != str(desired_exam_id):
                        _stop_model_locked()
                        start_model(desired_model, desired_exam_id, end_time_sec, start_time_sec)
            report_model_status()

        elif msg_type == "AUTH_ERROR":
            print(f"[WS AUTH ERROR] {data.get('error')}")

    except Exception as e:
        print(f"[WS MSG ERROR] {e}")


def on_ws_open(ws):
    global ws_ref, telemetry_thread, telemetry_stop_event
    ws_ref = ws
    print("[WEBSOCKET] Connected to ExamShield AI Server!")
    ws.send(json.dumps({"type": "PI_AUTH", "key": PI_BRIDGE_KEY}))
    report_model_status()

    # Stop any previous telemetry loop thread before starting a new one
    telemetry_stop_event.set()
    time.sleep(0.1)
    telemetry_stop_event = threading.Event()

    def telemetry_loop():
        while not telemetry_stop_event.is_set():
            try:
                rover_state["temperature"] = read_cpu_temperature()
                payload = {
                    "type": "ROVER_UPDATE",
                    "rover": {
                        "battery": rover_state["battery"],
                        "speed": rover_state["speed"],
                        "posX": rover_state["posX"],
                        "posY": rover_state["posY"],
                        "temperature": rover_state["temperature"],
                        "motorStatus": rover_state["motorStatus"],
                        "wifiStatus": rover_state["wifiStatus"]
                    }
                }
                ws.send(json.dumps(payload))
            except Exception as e:
                print(f"[TELEMETRY ERROR] {e}")
                break
            time.sleep(2)

    telemetry_thread = threading.Thread(target=telemetry_loop, daemon=True)
    telemetry_thread.start()


def on_ws_error(ws, error):
    print(f"[WEBSOCKET NOTICE] {error}")


def on_ws_close(ws, close_status_code, close_msg):
    global ws_ref
    ws_ref = None
    print(f"[WEBSOCKET] Connection closed (code: {close_status_code}, message: {close_msg})")


def trigger_ai_cheating_alert(violation_title, priority, location, details):
    """Calls backend REST API when OpenCV / YOLO detects unauthorized devices."""
    payload = {
        "title": violation_title,
        "priority": priority,       # "CRITICAL", "HIGH", "MEDIUM", "LOW"
        "location": location,
        "details": details
    }
    headers = {
        "Content-Type": "application/json",
        "x-pi-bridge-key": PI_BRIDGE_KEY
    }
    try:
        res = requests.post(ALERT_API, json=payload, headers=headers, timeout=5)
        print(f"[AI ALERT SENT] {violation_title} -> HTTP {res.status_code}")
    except Exception as e:
        print(f"[ALERT API ERROR] {e}")


if __name__ == "__main__":
    if not PI_BRIDGE_KEY:
        print("[FATAL] PI_BRIDGE_KEY is not set. Configure the same strong key in client/.env and on this bridge.", file=sys.stderr)
        sys.exit(2)

    init_serial()

    # Start ESP32 UART serial listener thread
    threading.Thread(target=listen_esp32_serial, daemon=True).start()

    # Start model crash watchdog / status reporter
    threading.Thread(target=model_watchdog, daemon=True).start()

    # Connect WebSocket loop
    while True:
        try:
            print(f"[WEBSOCKET] Connecting to {WS_URL}...")
            ws = websocket.WebSocketApp(
                WS_URL,
                on_message=on_ws_message,
                on_open=on_ws_open,
                on_error=on_ws_error,
                on_close=on_ws_close
            )
            ws.run_forever(ping_interval=15, ping_timeout=5)
        except Exception as e:
            print(f"[WS DISCONNECTED] Retrying in 3 seconds... Error: {e}")
        time.sleep(3)
