/*
  ===================================================================
  ExamShield AI — ESP32 Low-Level Motor & Sensor Controller (.ino)
  ===================================================================
  Hardware Setup:
  - ESP32 Microcontroller Board
  - L298N / Cytron Dual H-Bridge Motor Driver
  - Voltage Divider on GPIO 34 for Battery Level
  - USB / UART Link to Raspberry Pi (115200 Baud)
  ===================================================================
*/

#include <Arduino.h>

// --- Motor Driver Pin Definitions (L298N) ---
const int ENA = 13;  // Left Motor Speed PWM
const int IN1 = 12;  // Left Motor Direction 1
const int IN2 = 14;  // Left Motor Direction 2

const int ENB = 25;  // Right Motor Speed PWM
const int IN3 = 26;  // Right Motor Direction 1
const int IN4 = 27;  // Right Motor Direction 2

// --- Battery Monitor Pin ---
const int BATT_PIN = 34; // Analog pin for battery voltage divider

// --- PWM Speed Settings ---
const int PWM_FREQ = 5000;
const int PWM_RES = 8;      // 0 - 255 PWM resolution
const int SPEED_NORMAL = 180; // Default drive speed (0 - 255)
const int SPEED_TURN   = 150; // Turn speed

// Timing & State Variables
float batteryPercentage = 100.0;
unsigned long lastTelemetryTime = 0;

void setMotors(int leftSpeed, int leftDir1, int leftDir2, int rightSpeed, int rightDir1, int rightDir2) {
  digitalWrite(IN1, leftDir1);
  digitalWrite(IN2, leftDir2);
  digitalWrite(IN3, rightDir1);
  digitalWrite(IN4, rightDir2);

  ledcWrite(0, leftSpeed);
  ledcWrite(1, rightSpeed);
}

void moveForward() {
  setMotors(SPEED_NORMAL, HIGH, LOW, SPEED_NORMAL, HIGH, LOW);
}

void moveBackward() {
  setMotors(SPEED_NORMAL, LOW, HIGH, SPEED_NORMAL, LOW, HIGH);
}

void turnLeft() {
  setMotors(SPEED_TURN, LOW, HIGH, SPEED_TURN, HIGH, LOW);
}

void turnRight() {
  setMotors(SPEED_TURN, HIGH, LOW, SPEED_TURN, LOW, HIGH);
}

void stopMotors() {
  setMotors(0, LOW, LOW, 0, LOW, LOW);
}

void emergencyStop() {
  stopMotors();
  Serial.println("STATUS:ESTOP_ENGAGED");
}

float readBatteryVoltage() {
  int rawADC = analogRead(BATT_PIN);
  // Convert 12-bit ADC (0-4095) with 1:4 voltage divider ratio
  float voltage = (rawADC / 4095.0) * 3.3 * 4.0;
  // Map 3S LiPo battery range: 9.6V (Empty) to 12.6V (Full)
  float pct = ((voltage - 9.6) / (12.6 - 9.6)) * 100.0;
  return constrain(pct, 0.0, 100.0);
}

void processCommand(String cmd) {
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "FWD") {
    moveForward();
  } else if (cmd == "BWD") {
    moveBackward();
  } else if (cmd == "LEFT") {
    turnLeft();
  } else if (cmd == "RIGHT") {
    turnRight();
  } else if (cmd == "STOP") {
    stopMotors();
  } else if (cmd == "ESTOP") {
    emergencyStop();
  }
}

void setup() {
  // Initialize Serial UART communication with Raspberry Pi
  Serial.begin(115200);

  // Configure Motor Output Direction Pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  // Configure ESP32 Hardware PWM Channels
  ledcSetup(0, PWM_FREQ, PWM_RES);
  ledcSetup(1, PWM_FREQ, PWM_RES);
  ledcAttachPin(ENA, 0);
  ledcAttachPin(ENB, 1);

  stopMotors();
  Serial.println("STATUS:ESP32_READY");
}

void loop() {
  // 1. Listen for incoming UART movement commands from Raspberry Pi
  if (Serial.available() > 0) {
    String incomingCommand = Serial.readStringUntil('\n');
    processCommand(incomingCommand);
  }

  // 2. Periodically transmit battery telemetry back to Raspberry Pi (every 2 seconds)
  if (millis() - lastTelemetryTime > 2000) {
    lastTelemetryTime = millis();
    batteryPercentage = readBatteryVoltage();

    Serial.print("TELEMETRY:BATT:");
    Serial.println(batteryPercentage);
  }
}
