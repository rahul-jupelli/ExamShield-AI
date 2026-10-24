#!/usr/bin/env python3
"""
=============================================================================
ExamShield AI — Development Raspberry Pi 4 Hardware Simulator
=============================================================================
Purpose:
  Simulates the Raspberry Pi 4 bridge protocol for local testing on Windows,
  macOS, or Linux without physical hardware, camera modules, or rovers.

Safety Notice:
  - This simulator is strictly for development and staging environments.
  - It is blocked from executing in production environments (NODE_ENV=production).
  - It does NOT fabricate real face-recognition matches or real camera captures.
  - It implements the WebSocket protocol for lifecycle testing only; it does not run AI inference.

Protocol Supported:
  - PI_AUTH (with isSimulator=True flag)
  - RECONCILE_STATE (authoritative exam schedule reconciliation)
  - MODEL_COMMAND (start, stop, pause, resume)
  - MODEL_ACK (command acknowledgements with status)
  - MODEL_STATUS (simulated lifecycle only; no real inference/FPS)
  - ROVER_UPDATE (simulated telemetry relay)
  - Local exam end-time watchdog enforcement
=============================================================================
"""

import sys
import os
import time
import json
import threading
import argparse
from datetime import datetime

# =============================================================================
# PRODUCTION ENVIRONMENT FAIL-SAFE
# =============================================================================
node_env = os.environ.get("NODE_ENV", "").strip().lower()
if node_env == "production" or "--production" in sys.argv:
    print("\n[FATAL ERROR] dev_pi_simulator.py is strictly a development tool.")
    print("Execution blocked: NODE_ENV is set to 'production'.")
    sys.exit(1)

try:
    import websocket
except ImportError:
    print("\n[DEPENDENCY ERROR] 'websocket-client' is required.")
    print("Install it via: pip install websocket-client\n")
    sys.exit(1)

from pathlib import Path

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

# Default configuration
DEFAULT_WS_URL = "ws://localhost:3000/ws"
DEFAULT_PI_KEY = os.environ.get("PI_BRIDGE_KEY", "change-me")


class DevPiSimulator:
    def __init__(self, ws_url=DEFAULT_WS_URL, bridge_key=DEFAULT_PI_KEY, fail_auth=False, headless=False):
        self.ws_url = ws_url
        self.bridge_key = "INVALID_KEY_FOR_TESTING" if fail_auth else bridge_key
        self.headless = headless

        # Simulation state
        self.ws = None
        self.connected = False
        self.authenticated = False
        self.running = True

        # Model supervisor state
        self.lock = threading.RLock()
        self.active_model = "none"         # "none" | "face_verification" | "device_detection"
        self.model_status = "stopped"      # "stopped" | "running" | "paused"
        self.active_exam_id = None
        self.active_exam_end_time = None   # UNIX timestamp (seconds)
        # Deliberately no FPS value: this simulator does not run model inference.
        self.last_error = None

        # Testing hooks
        self.simulate_fail_next = False
        self.simulate_timeout_next = False

        # Rover telemetry state
        self.rover_battery = 94.0
        self.rover_pos_x = 50
        self.rover_pos_y = 50

    def log(self, prefix, message):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [DEV SIMULATOR - {prefix}] {message}")

    def run(self):
        self.print_banner()

        # Start background watchdog for scheduled exam end
        threading.Thread(target=self._watchdog_loop, daemon=True).start()

        # Start periodic telemetry & status loop
        threading.Thread(target=self._telemetry_loop, daemon=True).start()

        # Start connection manager loop
        conn_thread = threading.Thread(target=self._connection_manager, daemon=True)
        conn_thread.start()

        if not self.headless:
            self._interactive_cli()
        else:
            try:
                while self.running:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stop()

    def print_banner(self):
        print("\n" + "=" * 65)
        print("  EXAMSHIELD AI — DEVELOPMENT RASPBERRY PI 4 SIMULATOR")
        print("  [DEVELOPMENT & TEST MODE — NOT PHYSICAL HARDWARE]")
        print("=" * 65)
        print(f"  Target Server   : {self.ws_url}")
        print(f"  Bridge Auth Key : {'[INVALID INTENDED]' if self.bridge_key.startswith('INVALID') else self.bridge_key}")
        print(f"  Fail-safe Check : Passed (Non-production environment)")
        print("=" * 65)
        if not self.headless:
            print("  Interactive Commands (press Enter after command):")
            print("    'd' | 'disconnect' : Forcibly drop WebSocket connection")
            print("    'r' | 'reconnect'  : Reconnect WebSocket to backend")
            print("    'f' | 'fail'       : Toggle fail response on next command")
            print("    't' | 'timeout'    : Toggle 10s delayed ACK on next command")
            print("    's' | 'status'     : Print current simulated device status")
            print("    'q' | 'quit'       : Stop simulator and exit")
            print("=" * 65 + "\n")

    def _connection_manager(self):
        while self.running:
            if not self.connected:
                self.log("NET", f"Connecting to ExamShield Server at {self.ws_url}...")
                try:
                    ws = websocket.WebSocketApp(
                        self.ws_url,
                        on_open=self._on_ws_open,
                        on_message=self._on_ws_message,
                        on_error=self._on_ws_error,
                        on_close=self._on_ws_close
                    )
                    self.ws = ws
                    ws.run_forever(ping_interval=15, ping_timeout=5)
                except Exception as e:
                    self.log("ERROR", f"Connection exception: {e}")
                
                self.connected = False
                self.authenticated = False

            if self.running:
                time.sleep(3)

    def _on_ws_open(self, ws):
        self.connected = True
        self.log("NET", "WebSocket connected. Transmitting PI_AUTH handshake packet...")
        auth_packet = {
            "type": "PI_AUTH",
            "key": self.bridge_key,
            "isSimulator": True,
            "clientName": "Dev-RaspberryPi4-Simulator",
            "version": "1.0.0-dev"
        }
        ws.send(json.dumps(auth_packet))

    def _on_ws_message(self, ws, message):
        try:
            data = json.loads(message)
            msg_type = data.get("type")

            if msg_type == "PI_AUTH_SUCCESS":
                self.authenticated = True
                self.log("AUTH", "Authentication successful! Registered as Simulated Pi.")
                self._send_status()

            elif msg_type == "AUTH_ERROR":
                self.authenticated = False
                self.log("AUTH_ERROR", f"Server rejected Pi authentication: {data.get('error')}")

            elif msg_type == "RECONCILE_STATE":
                self._handle_reconcile_state(data)

            elif msg_type == "MODEL_COMMAND":
                threading.Thread(target=self._handle_model_command, args=(data,), daemon=True).start()

            elif msg_type == "ROVER_UPDATE":
                pass

        except Exception as e:
            self.log("ERROR", f"Failed to parse incoming message: {e}")

    def _on_ws_error(self, ws, error):
        self.log("NET_ERROR", f"WebSocket error: {error}")

    def _on_ws_close(self, ws, close_status_code, close_msg):
        self.connected = False
        self.authenticated = False
        self.log("NET", f"Connection closed (code: {close_status_code}, msg: {close_msg}).")

    def _handle_reconcile_state(self, data):
        desired_model = data.get("desiredModel") or data.get("activeModel", "none")
        if desired_model == "prohibited_device":
            desired_model = "device_detection"
        desired_exam_id = data.get("examId")
        is_paused = bool(data.get("isPaused", False))
        end_time_raw = data.get("endTime")

        end_time_sec = None
        if end_time_raw:
            try:
                val = float(end_time_raw)
                end_time_sec = val / 1000.0 if val > 1e11 else val
            except (ValueError, TypeError):
                pass

        self.log("RECONCILE", f"Server state sync: desiredModel='{desired_model}', exam='{desired_exam_id}', isPaused={is_paused}")

        with self.lock:
            self.active_exam_end_time = end_time_sec
            if is_paused:
                self.active_model = desired_model if desired_model != "none" else "none"
                self.model_status = "paused"
                self.active_exam_id = desired_exam_id
            elif desired_model in ["device_detection", "face_verification"]:
                self.active_model = desired_model
                self.model_status = "running"
                self.active_exam_id = desired_exam_id
            else:
                self.active_model = "none"
                self.model_status = "stopped"
                self.active_exam_id = None

        self._send_status()

    def _handle_model_command(self, data):
        request_id = data.get("requestId")
        model = data.get("model")
        action = data.get("action")
        exam_id = data.get("examId")
        end_time_raw = data.get("endTime")

        end_time_sec = None
        if end_time_raw:
            try:
                val = float(end_time_raw)
                end_time_sec = val / 1000.0 if val > 1e11 else val
            except (ValueError, TypeError):
                pass

        self.log("COMMAND", f"Received command: action='{action}' model='{model}' exam='{exam_id}'")

        # Test hook: Simulate delayed ACK / timeout
        if self.simulate_timeout_next:
            self.simulate_timeout_next = False
            self.log("TEST_HOOK", "Simulating 10s delay to trigger server timeout...")
            time.sleep(10)

        # Test hook: Simulate rejection
        if self.simulate_fail_next:
            self.simulate_fail_next = False
            self.log("TEST_HOOK", "Simulating negative ACK rejection...")
            self._send_ack(request_id, False, "Simulated device failure for testing.", model)
            return

        with self.lock:
            if action == "start":
                self.active_model = model
                self.model_status = "running"
                self.active_exam_id = exam_id
                self.active_exam_end_time = end_time_sec
                self.last_error = None
                self._send_ack(request_id, True, None, model, "running")

            elif action == "pause":
                self.model_status = "paused"
                self._send_ack(request_id, True, None, model, "paused")

            elif action == "resume":
                self.active_model = model
                self.model_status = "running"
                self.active_exam_id = exam_id
                self.active_exam_end_time = end_time_sec
                self._send_ack(request_id, True, None, model, "running")

            elif action == "stop":
                self.active_model = "none"
                self.model_status = "stopped"
                self.active_exam_id = None
                self.active_exam_end_time = None
                self._send_ack(request_id, True, None, model, "stopped")

            elif action == "prepare":
                self._send_ack(
                    request_id, False,
                    "Development simulator cannot validate real model weights or camera. Run raspberry_pi_bridge.py for real preflight.",
                    model, self.model_status
                )

            else:
                self._send_ack(request_id, False, f"Unknown action '{action}'", model)

        self._send_status()

    def _send_ack(self, request_id, ok, error, model, actual_state=None):
        if not self.ws or not self.connected:
            return
        ack_packet = {
            "type": "MODEL_ACK",
            "requestId": request_id,
            "ok": ok,
            "error": error,
            "model": model,
            "actualState": actual_state or self.model_status
        }
        try:
            self.ws.send(json.dumps(ack_packet))
            self.log("ACK", f"Sent MODEL_ACK ok={ok} error={error} state='{actual_state or self.model_status}'")
        except Exception as e:
            self.log("ERROR", f"Failed to send ACK: {e}")

    def _send_status(self):
        if not self.ws or not self.connected or not self.authenticated:
            return
        with self.lock:
            status_packet = {
                "type": "MODEL_STATUS",
                "activeModel": self.active_model,
                "examId": self.active_exam_id,
                "status": self.model_status,
                "error": self.last_error,
                "isSimulator": True
            }
        try:
            self.ws.send(json.dumps(status_packet))
        except Exception:
            pass

    def _watchdog_loop(self):
        """Enforces scheduled exam end time locally, mimicking real hardware watchdog."""
        while self.running:
            time.sleep(0.5)
            now_sec = time.time()
            stopped = False
            with self.lock:
                if self.active_model != "none" and self.active_exam_end_time:
                    if now_sec >= self.active_exam_end_time:
                        self.log("WATCHDOG", f"Scheduled exam end time ({self.active_exam_end_time}) reached. Auto-stopping model.")
                        self.active_model = "none"
                        self.model_status = "stopped"
                        self.active_exam_id = None
                        self.active_exam_end_time = None
                        stopped = True
            if stopped:
                self._send_status()

    def _telemetry_loop(self):
        """Periodically reports status and simulated rover telemetry."""
        while self.running:
            time.sleep(3)
            if self.connected and self.authenticated:
                self._send_status()

                # Simulate subtle telemetry drift
                self.rover_battery = max(10.0, round(self.rover_battery - 0.01, 2))
                rover_packet = {
                    "type": "ROVER_UPDATE",
                    "rover": {
                        "battery": self.rover_battery,
                        "speed": 0.4 if self.model_status == "running" else 0.0,
                        "posX": self.rover_pos_x,
                        "posY": self.rover_pos_y,
                        "temperature": 41.2,
                        "motorStatus": "Standby (Simulated)" if self.model_status != "running" else "Patrolling (Simulated)",
                        "wifiStatus": "-48 dBm (Simulated Loopback)"
                    }
                }
                try:
                    if self.ws and self.connected:
                        self.ws.send(json.dumps(rover_packet))
                except Exception:
                    pass

    def _interactive_cli(self):
        """Interactive command-line control prompt for testers."""
        while self.running:
            try:
                cmd = input().strip().lower()
            except (EOFError, KeyboardInterrupt):
                self.stop()
                break

            if not cmd:
                continue

            if cmd in ["q", "quit", "exit"]:
                self.stop()
                break

            elif cmd in ["d", "disconnect"]:
                self.log("CLI", "Forcibly dropping WebSocket connection (simulating network drop)...")
                if self.ws:
                    self.ws.close()
                self.connected = False

            elif cmd in ["r", "reconnect"]:
                self.log("CLI", "Triggering manual reconnection...")
                self.connected = False

            elif cmd in ["f", "fail"]:
                self.simulate_fail_next = not self.simulate_fail_next
                self.log("CLI", f"Simulate failure on next command: {self.simulate_fail_next}")

            elif cmd in ["t", "timeout"]:
                self.simulate_timeout_next = not self.simulate_timeout_next
                self.log("CLI", f"Simulate timeout on next command: {self.simulate_timeout_next}")

            elif cmd in ["s", "status"]:
                with self.lock:
                    print("\n--- CURRENT SIMULATOR STATUS ---")
                    print(f"  Connected     : {self.connected}")
                    print(f"  Authenticated : {self.authenticated}")
                    print(f"  Active Model  : {self.active_model}")
                    print(f"  Status        : {self.model_status}")
                    print(f"  Exam ID       : {self.active_exam_id}")
                    print(f"  End Time Sec  : {self.active_exam_end_time}")
                    print("  AI inference   : NOT RUNNING (protocol simulator only)")
                    print("--------------------------------\n")
            else:
                print(f"Unknown command '{cmd}'. Available: 'd' (disconnect), 'r' (reconnect), 'f' (fail), 't' (timeout), 's' (status), 'q' (quit)")

    def stop(self):
        self.log("SYS", "Stopping Dev Pi Simulator...")
        self.running = False
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass


def main():
    parser = argparse.ArgumentParser(description="ExamShield AI — Development Raspberry Pi 4 Simulator")
    parser.add_argument("--url", default=DEFAULT_WS_URL, help=f"WebSocket URL (default: {DEFAULT_WS_URL})")
    parser.add_argument("--key", default=DEFAULT_PI_KEY, help="Pi Bridge Authentication Key")
    parser.add_argument("--invalid-auth", action="store_true", help="Send an invalid authentication key to test rejection")
    parser.add_argument("--headless", action="store_true", help="Run in headless non-interactive mode")
    parser.add_argument("--disconnect-after", type=float, help="Automatically disconnect after N seconds for testing")
    args = parser.parse_args()

    simulator = DevPiSimulator(
        ws_url=args.url,
        bridge_key=args.key,
        fail_auth=args.invalid_auth,
        headless=args.headless or bool(args.disconnect_after)
    )

    if args.disconnect_after:
        def auto_disconnect():
            time.sleep(args.disconnect_after)
            simulator.log("AUTO_TEST", f"Auto-disconnect timer ({args.disconnect_after}s) fired. Dropping socket.")
            if simulator.ws:
                simulator.ws.close()
            time.sleep(1)
            simulator.stop()

        threading.Thread(target=auto_disconnect, daemon=True).start()

    simulator.run()


if __name__ == "__main__":
    main()
