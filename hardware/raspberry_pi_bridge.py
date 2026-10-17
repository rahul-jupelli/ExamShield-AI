#!/usr/bin/env python3
"""
===================================================================
ExamShield AI — Raspberry Pi Master Hardware Bridge
===================================================================
Role:
- Connects to ExamShield Express Backend via WebSocket & REST API
- Communicates with ESP32 Motor Controller over UART Serial
- Serves live MJPEG camera stream for RoverView dashboard
- Reports live telemetry (Battery %, CPU Temp, Speed, Location)
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


# --- CONFIGURATION ---
EXAMSHIELD_SERVER_IP = "192.168.1.100"  # Replace with your Laptop/Server IP
EXAMSHIELD_PORT = 3000

WS_URL = f"ws://{EXAMSHIELD_SERVER_IP}:{EXAMSHIELD_PORT}/ws"
ALERT_API = f"http://{EXAMSHIELD_SERVER_IP}:{EXAMSHIELD_PORT}/api/alerts/trigger"

# ESP32 Serial Port Configuration
SERIAL_PORT = "/dev/ttyUSB0"  # Or /dev/ttyS0 / /dev/ttyACM0
BAUD_RATE = 115200

# Shared secret so the server accepts this Pi (must match PI_BRIDGE_KEY in the server .env)
PI_BRIDGE_KEY = os.environ.get("PI_BRIDGE_KEY", "change-me")

# --- AI MODEL WORKERS (.pt files deployed on this Pi) ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.environ.get("EXAMSHIELD_MODEL_DIR", os.path.join(BASE_DIR, "models"))
MODEL_CONFIG = {
    "face_verification": {
        "weights": os.path.join(MODEL_DIR, "face_verification.pt"),
        "worker_args": ["--mode", "face_verification"],
    },
    "device_detection": {
        "weights": os.path.join(MODEL_DIR, "device_detection.pt"),
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
model_lock = threading.Lock()
model_proc = None          # subprocess.Popen of the running worker
active_model = "none"      # "face_verification" | "device_detection" | "none"
active_exam_id = None
last_model_error = None
ws_ref = None

def init_serial():
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
        print(f"[SERIAL] Connected to ESP32 on {SERIAL_PORT} @ {BAUD_RATE}")
    except Exception as e:
        print(f"[SERIAL WARNING] Could not open {SERIAL_PORT}: {e}")
        print("[SERIAL WARNING] Running in software-only relay mode.")

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
        print(f"[MOCK MOTOR] Executed: {cmd_str}")

def read_cpu_temperature():
    """Reads Raspberry Pi CPU temperature in Celsius"""
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r") as f:
            temp = float(f.read().strip()) / 1000.0
            return round(temp, 1)
    except Exception:
        return 41.5

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
            except Exception as e:
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
        "status": "running" if active_model != "none" else "stopped",
        "error": last_model_error,
    })

def _stop_model_locked():
    """Terminates the running worker and waits until the process (and camera) is released."""
    global model_proc, active_model, active_exam_id
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

def start_model(model, exam_id):
    """Starts one .pt model worker. Refuses if a different model is running (no parallel runs)."""
    global model_proc, active_model, active_exam_id, last_model_error
    cfg = MODEL_CONFIG.get(model)
    if not cfg:
        return False, f"Unknown model '{model}'"
    with model_lock:
        if model_proc is not None and model_proc.poll() is None:
            if active_model == model and active_exam_id == exam_id:
                return True, None  # already running
            return False, f"{active_model} is still running; stop it first"
        if not os.path.isfile(cfg["weights"]):
            last_model_error = f"Weights not found: {cfg['weights']}"
            return False, last_model_error
        cmd = [sys.executable, WORKER_SCRIPT, *cfg["worker_args"],
               "--weights", cfg["weights"], "--exam-id", str(exam_id)]
        try:
            model_proc = subprocess.Popen(cmd)
        except Exception as e:
            last_model_error = str(e)
            return False, last_model_error
        time.sleep(1.0)  # fail fast if the worker crashes on load
        if model_proc.poll() is not None:
            last_model_error = f"{model} worker exited immediately (code {model_proc.returncode})"
            model_proc = None
            return False, last_model_error
        active_model = model
        active_exam_id = exam_id
        last_model_error = None
        print(f"[MODEL] Started {model} for exam {exam_id} (pid {model_proc.pid})")
        return True, None

def stop_model(model):
    with model_lock:
        if active_model == model:
            _stop_model_locked()
        return True, None

def model_watchdog():
    """Detects worker crashes and reports the real model state every few seconds."""
    global model_proc, active_model, active_exam_id, last_model_error
    while True:
        time.sleep(3)
        with model_lock:
            if model_proc is not None and model_proc.poll() is not None:
                last_model_error = f"{active_model} worker crashed (code {model_proc.returncode})"
                print(f"[MODEL] {last_model_error}")
                model_proc = None
                active_model = "none"
                active_exam_id = None
        report_model_status()

def handle_model_command(data):
    request_id = data.get("requestId")
    model = data.get("model")
    action = data.get("action")
    exam_id = data.get("examId")
    print(f"[MODEL COMMAND] {action} {model} (exam {exam_id})")
    if action == "start":
        ok, err = start_model(model, exam_id)
    elif action == "stop":
        ok, err = stop_model(model)
    else:
        ok, err = False, f"Unknown action '{action}'"
    _ws_send({"type": "MODEL_ACK", "requestId": request_id, "ok": ok, "error": err})
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

        # Model start/stop from dashboard (runs in a thread: stopping can take seconds)
        elif msg_type == "MODEL_COMMAND":
            threading.Thread(target=handle_model_command, args=(data,), daemon=True).start()

        elif msg_type == "AUTH_ERROR":
            print(f"[WS AUTH ERROR] {data.get('error')}")

    except Exception as e:
        print(f"[WS MSG ERROR] {e}")

def on_ws_open(ws):
    global ws_ref
    ws_ref = ws
    print("[WEBSOCKET] Connected to ExamShield AI Server!")
    ws.send(json.dumps({"type": "PI_AUTH", "key": PI_BRIDGE_KEY}))
    report_model_status()
    
    # Start thread to periodically send Pi & ESP32 telemetry to Dashboard
    def telemetry_loop():
        while True:
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

    threading.Thread(target=telemetry_loop, daemon=True).start()

def trigger_ai_cheating_alert(violation_title, priority, location, details):
    """Call this function when OpenCV / YOLO on Pi detects unauthorized devices or cheating"""
    payload = {
        "title": violation_title,
        "priority": priority,       # "CRITICAL", "HIGH", "MEDIUM", "LOW"
        "location": location,
        "details": details
    }
    try:
        res = requests.post(ALERT_API, json=payload)
        print(f"[AI ALERT SENT] Response: {res.status_code}")
    except Exception as e:
        print(f"[ALERT API ERROR] {e}")

if __name__ == "__main__":
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
                on_open=on_ws_open
            )
            ws.run_forever()
        except Exception as e:
            print(f"[WS DISCONNECTED] Retrying in 3 seconds... Error: {e}")
            time.sleep(3)
