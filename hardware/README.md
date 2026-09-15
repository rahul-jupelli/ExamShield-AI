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
   pip3 install pyserial requests websocket-client
   ```
3. Update `EXAMSHIELD_SERVER_IP` inside [`raspberry_pi_bridge.py`](file:///c:/Users/vivek/OneDrive/Desktop/ExamShield-AI/hardware/raspberry_pi_bridge.py#L20) to your laptop/server's IP address.
4. Run the master bridge:
   ```bash
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
