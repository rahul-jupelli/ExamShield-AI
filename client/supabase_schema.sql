-- ==========================================
-- ExamShield AI - Supabase Database Schema & Seed Data
-- Run this script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==========================================

-- Drop existing tables (to handle schema changes)
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.live_alerts CASCADE;
DROP TABLE IF EXISTS public.rover_status CASCADE;
DROP TABLE IF EXISTS public.system_metrics CASCADE;
DROP TABLE IF EXISTS public.ai_detection_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;

-- 1. Create Table: students
CREATE TABLE public.students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  "hallTicket" TEXT,
  branch TEXT,
  room TEXT,
  seat TEXT,
  photo TEXT,
  status TEXT,
  "detectedDevice" TEXT,
  "detectionConfidence" NUMERIC,
  "suspicionScore" NUMERIC,
  "suspicionReason" TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  "faceConfidence" NUMERIC,
  "entryDecision" TEXT,
  "verificationCompleted" BOOLEAN DEFAULT FALSE,
  "entryAllowed" BOOLEAN DEFAULT FALSE,
  "verificationHistory" JSONB DEFAULT '[]'::jsonb,
  "violationHistory" JSONB DEFAULT '[]'::jsonb,
  snapshot TEXT
);

-- 2. Create Table: live_alerts
CREATE TABLE IF NOT EXISTS public.live_alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  priority TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  location TEXT,
  "actionTaken" TEXT,
  status TEXT,
  snapshot TEXT,
  details TEXT
);

-- 3. Create Table: rover_status
CREATE TABLE IF NOT EXISTS public.rover_status (
  id INT PRIMARY KEY DEFAULT 1,
  battery NUMERIC,
  speed NUMERIC,
  location TEXT,
  hall TEXT,
  floor INT,
  "wifiStatus" TEXT,
  "cameraStatus" TEXT,
  temperature NUMERIC,
  "cpuUsage" NUMERIC,
  "storageUsed" NUMERIC,
  "storageTotal" NUMERIC,
  "motorStatus" TEXT,
  "currentMission" TEXT,
  "estimatedTimeRemaining" NUMERIC,
  "posX" NUMERIC,
  "posY" NUMERIC,
  "manualMode" BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Table: system_metrics
CREATE TABLE IF NOT EXISTS public.system_metrics (
  id INT PRIMARY KEY DEFAULT 1,
  backend TEXT,
  "aiModel" TEXT,
  camera TEXT,
  database TEXT,
  storage NUMERIC,
  internet TEXT,
  "roverConnection" TEXT,
  "modelFps" NUMERIC,
  "inferenceTime" NUMERIC,
  cpu NUMERIC,
  memory NUMERIC,
  gpu NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Table: ai_detection_logs
CREATE TABLE IF NOT EXISTS public.ai_detection_logs (
  id TEXT PRIMARY KEY,
  "frameUrl" TEXT,
  "detectedObjects" JSONB,
  confidence NUMERIC,
  decision TEXT,
  operator TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  hall TEXT
);

-- 6. Create Table: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id INT PRIMARY KEY DEFAULT 1,
  "examHalls" JSONB,
  "aiThreshold" NUMERIC,
  "suspicionThreshold" NUMERIC,
  "notificationChannels" JSONB,
  "roverConfig" JSONB,
  operators JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- Enable Row Level Security (RLS) & Set Access Policies
-- ==========================================

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to students" ON public.students;
CREATE POLICY "Allow public full access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.live_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to live_alerts" ON public.live_alerts;
CREATE POLICY "Allow public full access to live_alerts" ON public.live_alerts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.rover_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to rover_status" ON public.rover_status;
CREATE POLICY "Allow public full access to rover_status" ON public.rover_status FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to system_metrics" ON public.system_metrics;
CREATE POLICY "Allow public full access to system_metrics" ON public.system_metrics FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.ai_detection_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to ai_detection_logs" ON public.ai_detection_logs;
CREATE POLICY "Allow public full access to ai_detection_logs" ON public.ai_detection_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to system_settings" ON public.system_settings;
CREATE POLICY "Allow public full access to system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- Populate / Seed Data into Supabase
-- ==========================================

-- Insert Students
INSERT INTO public.students (id, name, "hallTicket", branch, room, seat, photo, status, "detectedDevice", "detectionConfidence", timestamp, "faceConfidence", "entryDecision", "verificationHistory", "violationHistory", snapshot)
VALUES
('s1', 'Aditya Vardhan', 'HT2026A405', 'Computer Science & AI', 'LH-302', 'Row C-4', 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80', 'Device Detected', 'Smart Watch (v4.2 Active)', 98.6, '2026-07-21T10:05:12Z', 99.1, 'Denied', '["09:45 AM - RFID Verified", "09:46 AM - Face Match Passed (99.1%)", "10:05 AM - Smart Watch detected by Rover RF Scanner"]'::jsonb, '["Active smart-device transmission intercepted near seat C-4. Spec-ID: SW-405."]'::jsonb, 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80'),
('s2', 'Meera Deshmukh', 'HT2026B112', 'Electronics & Communication', 'LH-302', 'Row F-12', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80', 'Device Detected', 'Micro Bluetooth Earbud (RF Beacon active)', 94.2, '2026-07-21T10:08:44Z', 98.4, 'Denied', '["09:48 AM - RFID Verified", "09:49 AM - Face Match Passed (98.4%)", "10:08 AM - Thermal/RF spike detected around left ear"]'::jsonb, '["Unsanctioned micro-receiver transmitting at 2.4GHz. Signal strength -45dBm."]'::jsonb, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

INSERT INTO public.students (id, name, "hallTicket", branch, room, seat, photo, status, "suspicionScore", "suspicionReason", timestamp, "faceConfidence", "entryDecision", "verificationHistory", "violationHistory", snapshot)
VALUES
('s3', 'Rahul Khanna', 'HT2026A488', 'Information Technology', 'LH-302', 'Row A-7', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80', 'Suspicious', 82, 'Frequent looking down & hands concealing lap area (AI Pose Estimation Flag)', '2026-07-21T10:02:15Z', 97.2, 'Pending', '["09:42 AM - RFID Verified", "09:43 AM - Face Match Passed (97.2%)", "10:02 AM - Rover Camera flagged pose: Gaze-deviated (82% suspicion)"]'::jsonb, '["No direct electronic signature, but active optical concealing detected."]'::jsonb, 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80'),
('s4', 'Sneha Reddy', 'HT2026C201', 'AI & Data Science', 'LH-304', 'Row E-3', 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150&auto=format&fit=crop&q=80', 'Suspicious', 68, 'Repetitive backward glancing & erratic head posture', '2026-07-21T10:11:30Z', 96.5, 'Pending', '["09:52 AM - RFID Verified", "09:53 AM - Face Match Passed (96.5%)", "10:11 AM - Object detection flagged: Head pitch deviation"]'::jsonb, '["Excessive neck movement detected (exceeding room baselines). Monitor active."]'::jsonb, 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&auto=format&fit=crop&q=80')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

INSERT INTO public.students (id, name, "hallTicket", branch, room, seat, photo, status, "verificationCompleted", "entryAllowed", timestamp, "faceConfidence", "entryDecision", "verificationHistory", "violationHistory")
VALUES
('s5', 'Ananya Iyer', 'HT2026A102', 'Computer Science', 'LH-302', 'Row B-1', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:35:00Z', 99.8, 'Allowed', '["09:34 AM - RFID Scanned", "09:35 AM - Facial Recognition Completed (99.8%)", "09:40 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb),
('s6', 'Vikram Malhotra', 'HT2026A105', 'Computer Science', 'LH-302', 'Row B-2', 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:36:10Z', 99.4, 'Allowed', '["09:35 AM - RFID Scanned", "09:36 AM - Facial Recognition Completed (99.4%)", "09:40 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb),
('s7', 'Pooja Bhat', 'HT2026A302', 'Information Technology', 'LH-302', 'Row B-3', 'https://images.unsplash.com/photo-1554151228-14d9def656e4?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:38:22Z', 98.9, 'Allowed', '["09:37 AM - RFID Scanned", "09:38 AM - Facial Recognition Completed (98.9%)", "09:42 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb),
('s8', 'Siddharth Rao', 'HT2026B101', 'Electronics & Communication', 'LH-302', 'Row C-1', 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:41:05Z', 99.2, 'Allowed', '["09:40 AM - RFID Scanned", "09:41 AM - Facial Recognition Completed (99.2%)", "09:45 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb),
('s9', 'Kunal Sen', 'HT2026A204', 'Electrical Engineering', 'LH-302', 'Row C-2', 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:43:18Z', 98.1, 'Allowed', '["09:42 AM - RFID Scanned", "09:43 AM - Facial Recognition Completed (98.1%)", "09:48 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb),
('s10', 'Riya Verma', 'HT2026C110', 'AI & Data Science', 'LH-302', 'Row C-3', 'https://images.unsplash.com/photo-1548142813-c348350df52b?w=150&auto=format&fit=crop&q=80', 'Verified Safe', true, true, '2026-07-21T09:44:50Z', 99.5, 'Allowed', '["09:43 AM - RFID Scanned", "09:44 AM - Facial Recognition Completed (99.5%)", "09:50 AM - Rover initial sweep: Cleared"]'::jsonb, '[]'::jsonb)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;

-- Insert Alerts
INSERT INTO public.live_alerts (id, title, priority, timestamp, location, "actionTaken", status, snapshot, details)
VALUES
(
  'a1', 'Smart Watch Emission Detected', 'CRITICAL', '2026-07-21T10:05:12Z', 'LH-302 (Seat C-4)',
  'Rover locked camera focus. Highlighted student Aditya Vardhan.', 'Investigating',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'Aditya Vardhan (HT2026A405) was scanned by the Rover. The embedded RF Analyzer picked up active smart-device transmissions synced with suspicious pulse frequency around the wrist area.'
),
(
  'a2', 'Unsanctioned Bluetooth Beacon Intercepted', 'HIGH', '2026-07-21T10:08:44Z', 'LH-302 (Seat F-12)',
  'Triggered thermal imaging scanner. Sent alert coordinates to controller console.', 'Active',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'Meera Deshmukh (HT2026B112) ear thermal profiles exceed normal bounds. BLE probe detected a hidden active receiver.'
),
(
  'a3', 'Camera Lens Blocked Warning', 'MEDIUM', '2026-07-21T09:58:10Z', 'Hallway B Entrance',
  'Initiated lens cleaning mechanism cycle.', 'Resolved', NULL,
  'Optical sensor dust threshold was exceeded. Self-cleaning wipers successfully cleared obstruction.'
),
(
  'a4', 'Rover Obstacle Detected', 'LOW', '2026-07-21T09:45:30Z', 'LH-302 Aisle 2',
  'Auto-recalculated routing trajectory.', 'Resolved', NULL,
  'An exam desk chair was blocking the path. The rover recalculated around Row B without human operator override.'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title, priority = EXCLUDED.priority, timestamp = EXCLUDED.timestamp,
  location = EXCLUDED.location, "actionTaken" = EXCLUDED."actionTaken", status = EXCLUDED.status,
  snapshot = EXCLUDED.snapshot, details = EXCLUDED.details;

-- Insert Rover Status
INSERT INTO public.rover_status (id, battery, speed, location, hall, floor, "wifiStatus", "cameraStatus", temperature, "cpuUsage", "storageUsed", "storageTotal", "motorStatus", "currentMission", "estimatedTimeRemaining", "posX", "posY", "manualMode")
VALUES (1, 88, 0.4, 'LH-302, Aisle C', 'Lecture Hall 302', 3, 'Excellent', 'Online', 38.5, 45, 142.4, 512, 'Operational', 'Aisle Sweep LH-302', 24, 42, 68, false)
ON CONFLICT (id) DO UPDATE SET battery = EXCLUDED.battery, speed = EXCLUDED.speed, location = EXCLUDED.location, updated_at = NOW();

-- Insert System Metrics
INSERT INTO public.system_metrics (id, backend, "aiModel", camera, database, storage, internet, "roverConnection", "modelFps", "inferenceTime", cpu, memory, gpu)
VALUES (1, 'online', 'online', 'online', 'online', 28, 'connected', 'connected', 29.8, 32.4, 44.5, 58.2, 67.1)
ON CONFLICT (id) DO UPDATE SET backend = EXCLUDED.backend, "aiModel" = EXCLUDED."aiModel", updated_at = NOW();

-- Insert AI Detection Logs
INSERT INTO public.ai_detection_logs (id, "frameUrl", "detectedObjects", confidence, decision, operator, timestamp, hall)
VALUES
('log_1', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80', '["Smart Watch", "Hand", "Desk"]'::jsonb, 98.6, 'Device Flagged (Red)', 'SysRover_Primary', '2026-07-21T10:05:12Z', 'LH-302'),
('log_2', 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=500&auto=format&fit=crop&q=80', '["Person", "Concealed Hand Pose"]'::jsonb, 82.0, 'Suspicious Behavior (Orange)', 'SysRover_Primary', '2026-07-21T10:02:15Z', 'LH-302'),
('log_3', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=500&auto=format&fit=crop&q=80', '["Person (RFID matched)", "Face Match (99.8%)"]'::jsonb, 99.8, 'Verified Safe (Green)', 'SysGate_Entry', '2026-07-21T09:35:00Z', 'LH-302'),
('log_4', 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=500&auto=format&fit=crop&q=80', '["Micro earbud thermal signature"]'::jsonb, 94.2, 'Device Flagged (Red)', 'SysRover_Primary', '2026-07-21T10:08:44Z', 'LH-302')
ON CONFLICT (id) DO UPDATE SET "frameUrl" = EXCLUDED."frameUrl", confidence = EXCLUDED.confidence;

-- Insert System Settings
INSERT INTO public.system_settings (id, "examHalls", "aiThreshold", "suspicionThreshold", "notificationChannels", "roverConfig", operators)
VALUES (
  1,
  '["LH-302", "LH-304", "Auditorium-1", "Main Lab"]'::jsonb,
  85, 65,
  '{"dashboard": true, "audioAlerts": true, "smsDispatch": false, "deanEmail": true}'::jsonb,
  '{"patrolSpeed": 0.4, "thermalInterval": 2, "opticalTracking": true, "rfJammerBlock": false}'::jsonb,
  '[{"name": "Prof. S. Rangan", "role": "Exam Controller", "active": true}, {"name": "Officer Kiran Kumar", "role": "Operator", "active": true}, {"name": "Dr. Helen Carter", "role": "Admin", "active": true}, {"name": "Viewer Account", "role": "Viewer", "active": true}]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET "aiThreshold" = EXCLUDED."aiThreshold", updated_at = NOW();

-- ==========================================
-- Supabase Storage Bucket Setup (Student Photos - PRIVATE)
-- ==========================================

-- Create PRIVATE Storage Bucket for Student Enrollment Photos
-- Bucket is NOT public — images are accessed via signed URLs only
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Allow the anon key (used by the app) to SELECT (read/download) files
DROP POLICY IF EXISTS "Anon Read Access for student-photos" ON storage.objects;
CREATE POLICY "Anon Read Access for student-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

-- Allow the anon key to INSERT (upload) files
DROP POLICY IF EXISTS "Anon Insert Access for student-photos" ON storage.objects;
CREATE POLICY "Anon Insert Access for student-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-photos');

-- Allow the anon key to UPDATE (upsert) files
DROP POLICY IF EXISTS "Anon Update Access for student-photos" ON storage.objects;
CREATE POLICY "Anon Update Access for student-photos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'student-photos');


