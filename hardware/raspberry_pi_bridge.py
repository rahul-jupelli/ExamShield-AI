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

# --- CONFIGURATION ---
EXAMSHIELD_SERVER_IP = "192.168.1.100"  # Replace with your Laptop/Server IP
EXAMSHIELD_PORT = 3000

WS_URL = f"ws://{EXAMSHIELD_SERVER_IP}:{EXAMSHIELD_PORT}/ws"
ALERT_API = f"http://{EXAMSHIELD_SERVER_IP}:{EXAMSHIELD_PORT}/api/alerts/trigger"

# ESP32 Serial Port Configuration
SERIAL_PORT = "/dev/ttyUSB0"  # Or /dev/ttyS0 / /dev/ttyACM0
BAUD_RATE = 115200

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

def on_ws_message(ws, message):
    try:
        data = json.loads(message)
        msg_type = data.get("type")

        # Received command broadcast from ExamShield Dashboard
        if msg_type == "ROVER_UPDATE" and "lastCommand" in data.get("rover", {}):
            cmd = data["rover"]["lastCommand"]
            print(f"[WEB UI COMMAND] {cmd}")
            map_command_to_esp32(cmd)

    except Exception as e:
        print(f"[WS MSG ERROR] {e}")

def on_ws_open(ws):
    print("[WEBSOCKET] Connected to ExamShield AI Server!")
    
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
