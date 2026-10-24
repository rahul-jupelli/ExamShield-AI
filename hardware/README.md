# 🤖 ExamShield AI — Hardware Connection Guide (Raspberry Pi + ESP32)

This directory contains the hardware integration scripts to connect a **Raspberry Pi** (Master Brain & Vision Processing) and **ESP32** (Low-level Motor & Telemetry Controller) to the ExamShield AI command dashboard.

---

## 📐 Dual-Board Architecture

```
  ┌─────────────────────────┐
  │ ExamShield AI Server    │
  │ (Express + WebSockets)  │
  └────────────▲────────────┘
               │
               │ WebSockets (ws://SERVER_IP:3000/ws) & REST API
               ▼
  ┌─────────────────────────┐
  │ Raspberry Pi (Master)   │
  │ - Camera Feed (MJPEG)   │
  │ - YOLO / OpenCV AI      │
  │ - Python Master Bridge  │
  └────────────▲────────────┘
               │
               │ UART Serial (TX/RX @ 115200 baud or USB Cable)
               ▼
  ┌─────────────────────────┐
  │ ESP32 Microcontroller   │
  │ - L298N Motor Driver    │
  │ - Battery Monitor (ADC) │
  │ - Drive Motors (PWM)    │
  └─────────────────────────┘
```

---

## 🔌 Wiring & Pin Connections

### 1. ESP32 to L298N Motor Driver
| ESP32 Pin | L298N Pin | Function |
|---|---|---|
| GPIO 13 | ENA | Left Motor Speed (PWM Channel 0) |
| GPIO 12 | IN1 | Left Motor Direction 1 |
| GPIO 14 | IN2 | Left Motor Direction 2 |
| GPIO 25 | ENB | Right Motor Speed (PWM Channel 1) |
| GPIO 26 | IN3 | Right Motor Direction 1 |
| GPIO 27 | IN4 | Right Motor Direction 2 |
| GND | GND | Common Ground |

### 2. ESP32 to Battery Monitor (Voltage Divider)
* **Battery Positive (+)** $\rightarrow$ $100\text{k}\Omega$ Resistor $\rightarrow$ **GPIO 34 (ADC)** $\rightarrow$ $33\text{k}\Omega$ Resistor $\rightarrow$ **GND**.

### 3. Raspberry Pi to ESP32 UART Link
* **Option A (USB Cable - Easiest)**: Plug ESP32 micro-USB cable into Raspberry Pi USB port (`/dev/ttyUSB0`).
* **Option B (Hardware Serial RX/TX)**:
  * Pi **TX (GPIO 14)** $\rightarrow$ ESP32 **RX (GPIO 16)**
  * Pi **RX (GPIO 15)** $\rightarrow$ ESP32 **TX (GPIO 17)**
  * Pi **GND** $\rightarrow$ ESP32 **GND**

---

## 🚀 Quick Setup Instructions

### Step 1: Flash the ESP32
1. Open [`esp32_motor_controller.ino`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/hardware/esp32_motor_controller.ino) in Arduino IDE.
2. Select Board: **ESP32 Dev Module**.
3. Upload to your ESP32 board via USB.

---

### Step 2: Set Up Raspberry Pi
1. Copy [`raspberry_pi_bridge.py`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/hardware/raspberry_pi_bridge.py) to your Raspberry Pi.
2. Install Python dependencies:
   ```bash
   pip3 install pyserial requests websocket-client ultralytics opencv-python
   ```
3. Update `EXAMSHIELD_SERVER_IP` inside [`raspberry_pi_bridge.py`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/hardware/raspberry_pi_bridge.py#L20) to your laptop/server's IP address.
4. Copy your two model files to `hardware/models/` on the Pi (or set `EXAMSHIELD_MODEL_DIR`):
   * `face_verification.pt`
   * `device_detection.pt`
5. Copy [`model_worker.py`](model_worker.py) next to the bridge and fill in the `handle_face_verification` / `handle_device_detection` hooks (face matching, incident reporting).
6. Set the shared secret (must equal `PI_BRIDGE_KEY` in the server's `client/.env`) and run the master bridge:
   ```bash
   export PI_BRIDGE_KEY="<same-secret-as-server>"
   python3 raspberry_pi_bridge.py
   ```

---

### Step 3: Disable Server-Side Simulation
In your ExamShield server project, open [`server.js`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/client/server.js#L529-L581) and comment out the fake simulation `setInterval` block at line 529 so real hardware telemetry is displayed on the UI.

---

## 📸 Camera Streaming Setup (Pi Camera / USB Cam)

To stream real-time camera footage to the ExamShield Dashboard:

1. Install `mjpg-streamer` on Raspberry Pi:
   ```bash
   sudo apt-get install mjpg-streamer
   mjpg_streamer -i "input_uvc.so -d /dev/video0 -r 1280x720 -f 30" -o "output_http.so -w ./www -p 8081"
   ```
2. In [`RoverView.jsx`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/client/src/components/RoverView.jsx), point your camera stream URL to `http://<PI_IP>:8081/?action=stream`.

> **Camera conflict:** `mjpg_streamer` and the model workers both open the camera. Only one process can hold `/dev/video0` at a time, so either stream from the model worker, use a second camera for the stream, or stop the streamer while a model runs.

---

## 🧠 AI Model Lifecycle on the Pi 4 (Face Verification → Device Detection)

Both `.pt` models are deployed on the Raspberry Pi 4. The dashboard (Exam Details → *AI Model Control*) never runs a model itself; it only asks the **server**, which commands the Pi bridge over the WebSocket. **FV and DD never run at the same time** — this is enforced by the server, the Pi bridge, and the Pi's single-process-at-a-time supervisor.

```
Dashboard ──REST──► Server (scheduler + executor) ──WebSocket MODEL_COMMAND──► Pi bridge ──subprocess──► model_worker.py (.pt)
                          ▲                                                       │
                          └──────────── MODEL_ACK / MODEL_STATUS ◄────────────────┘
```

### Rules
| Model | Window | Start | Stop |
|---|---|---|---|
| **Face Verification** | `exam start − 60 min` → `exam start` | **Manual** (Start / Restart button) | Manual, **or auto** when ① every enrolled student is `verified`, or ② exam start time is reached (force-stop) |
| **Device Detection** | `exam start` → `exam end` | **Auto** at exam start, only after the Pi reports no model running (FV confirmed stopped) | Manual (can be restarted), **or auto** at exam end / when the exam is cancelled |

* FV can be restarted any time inside its window (e.g. accidental stop). It can never be started once the exam has started.
* Auto-stop ① requires **every** student to be `verified` — `failed`, `absent` and `unverified` students keep FV running until exam start or a manual stop.
* If a worker crashes or the Pi reboots while FV/DD should be running, the server restarts it (retries every 10 s).

### Where the automation runs
All automatic steps (FV auto-stop, force-stop at exam start, DD auto-start, DD auto-stop) run in a **server-side scheduler** in [`server.js`](../client/server.js) (`modelSchedulerTick`, every 5 s). They work even if nobody has the dashboard open. The dashboard only shows state and sends the evaluator's manual actions.

* Per-exam manual choices (FV started/stopped, DD stopped manually) are saved to `client/.model-lifecycle.json`, so a server restart does not lose them.
* The scheduler reads `exams` and `exam_students` from Supabase. If your RLS policies block the anon key, set `SUPABASE_SERVICE_ROLE_KEY` in `client/.env` (server-side only).
* Exams that exist only in the browser's local cache (not in Supabase) are not scheduled automatically; they are only automated after the first manual action on them.

### Server setup
Add to `client/.env` (see `client/.env.example`):
```
PI_BRIDGE_KEY=<shared secret, same value on the Pi>
SUPABASE_SERVICE_ROLE_KEY=<optional, see above>
```

### API used by the dashboard
| Endpoint | Purpose |
|---|---|
| `POST /api/rover/model-control` | Manual `{ examId, model: face_verification\|device_detection, action: start\|stop }` (Admin / Exam Controller / Operator) |
| `GET /api/rover/model-status?examId=` | Pi connection, running model, and the exam's lifecycle flags (all staff roles) |

### WebSocket messages (Pi ⇄ server)
| Message | Direction | Meaning |
|---|---|---|
| `PI_AUTH { key }` | Pi → server | Authenticates the Pi bridge with `PI_BRIDGE_KEY` |
| `MODEL_COMMAND { requestId, model, action, examId }` | server → Pi | Start / stop a model |
| `MODEL_ACK { requestId, ok, error }` | Pi → server | Result of the command (stop is only acked after the process exited and the camera is released) |
| `MODEL_STATUS { activeModel, examId, status, error }` | Pi → server | Real model state, reported every ~3 s (detects crashes) |

---

## Standalone laptop-as-Raspberry-Pi runtime (real camera inference)

The development protocol simulator (`dev_pi_simulator.py`) does **not** run AI models and must not be used to claim inference is working. To run real inference on the laptop webcam, use the standalone Python runtime below. It opens its own OpenCV preview window and does not require the Admin Exams page to start the camera.

Run commands from the project root (`ExamShield-AI`). Install the project's Python dependencies first, including `ultralytics` and `opencv-python`.

```powershell
# Run the real device detector on the laptop webcam
python hardware/laptop_pi_runtime.py --mode device_detection

# Run the existing YOLO face detector on the laptop webcam
python hardware/laptop_pi_runtime.py --mode face_verification
```

The default camera index is `0`. If that is not your webcam, try `--camera 1`. You can override weights using `--weights "C:\path\to\model.pt"`.

Existing model paths used by default:

- Device detector: `models/new_device_latest.pt`
- Face detector: `models/ExamShield_face_detector_best.pt`

**Important face-verification limitation:** `ExamShield_face_detector_best.pt` detects face locations; it does not identify a student. Identity verification requires a separate FaceNet/MTCNN embedding and comparison against the enrolled student's stored embedding. The standalone runtime labels this mode as face detection only and does not claim that a person has been verified.

Press **Q** or **Esc** in the preview window to stop and release the camera. Only one application/process should use the webcam at a time. Do not start the standalone runtime and the bridge-managed model worker against the same camera simultaneously.

### Connecting the physical bridge to the backend

Set these environment variables before running `raspberry_pi_bridge.py`:

- `PI_BRIDGE_KEY`: same strong shared secret as configured for the backend; there is no default key.
- `EXAMSHIELD_SERVER_HOST`: backend host (defaults to `127.0.0.1` for same-machine development).
- `EXAMSHIELD_SERVER_PORT`: backend port (defaults to `3000`).
- `EXAMSHIELD_MODEL_DIR`: optional model directory (defaults to the project's root `models` directory).
- `EXAMSHIELD_CAMERA_INDEX`: OpenCV camera index (defaults to `0`).
- `EXAMSHIELD_HEADLESS_WORKER`: `1` by default for bridge-managed workers; set to `0` only when a preview window is wanted on a desktop.

The standalone runtime is currently a local camera/inference process; it does not itself write exam attendance or incident records to Supabase. That backend integration must be implemented and tested separately before treating the laptop runtime as a complete end-to-end ExamShield session.
