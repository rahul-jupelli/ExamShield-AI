-- ==============================================================================
-- ExamShield AI: Complete Exam Lifecycle, Control Fields & Safe Constraints
-- File: supabase_complete_lifecycle_migration.sql
-- Version: 2026.10.8
-- Compatible with PostgreSQL 14+ / Supabase
-- ==============================================================================
-- SAFETY GUARANTEES:
-- 1. Non-destructive: NEVER drops, truncates, or recreates existing tables.
-- 2. Preserves all student records, photos, embeddings, exams, and incidents.
-- 3. Idempotent: Can be run multiple times safely.
-- 4. Single source of truth:
--    - exams: exam schedule, lifecycle states, persisted control settings
--    - exam_students: authoritative per-exam candidate verification status
-- ==============================================================================

-- 1. Add Control & Lifecycle Columns to public.exams if missing
DO $$
BEGIN
  -- 1.1 Persisted face verification toggle (OFF by default)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'face_verification_enabled'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN face_verification_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- 1.2 Persisted device detection pause state (Stop Detection = temporary pause)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'device_detection_paused'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN device_detection_paused BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- 1.3 Actual device detection lifecycle state
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'device_detection_state'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN device_detection_state TEXT NOT NULL DEFAULT 'idle';
  END IF;

  -- 1.4 Timestamps for device detection lifecycle
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'device_detection_started_at'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN device_detection_started_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'device_detection_stopped_at'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN device_detection_stopped_at TIMESTAMPTZ;
  END IF;

  -- 1.5 Official exam completion timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;

  -- 1.6 Exam room column (if missing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'room'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN room TEXT DEFAULT 'LH-302';
  END IF;

  -- 1.7 Archived soft-delete flag (if missing)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'exams' AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2. Add safe check constraints (Idempotent)
DO $$
BEGIN
  -- Check constraint on device_detection_state
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exams_device_detection_state' AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams 
      ADD CONSTRAINT chk_exams_device_detection_state 
      CHECK (device_detection_state IN ('idle', 'starting', 'running', 'paused', 'stopped', 'error'));
  END IF;

  -- Check constraint on exam status (if not already applied)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exam_status' AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams 
      ADD CONSTRAINT chk_exam_status 
      CHECK (status IN ('scheduled', 'verification', 'device_detection', 'completed', 'cancelled'));
  END IF;

  -- Check constraint on exam_students verification status
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exam_student_verification_status' AND conrelid = 'public.exam_students'::regclass
  ) THEN
    ALTER TABLE public.exam_students 
      ADD CONSTRAINT chk_exam_student_verification_status 
      CHECK (verification_status IN ('unverified', 'verified', 'failed', 'absent'));
  END IF;

  -- Safe unique constraint on (exam_id, student_id) in exam_students
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'exam_students_exam_id_student_id_unique' AND conrelid = 'public.exam_students'::regclass
  ) THEN
    ALTER TABLE public.exam_students 
      ADD CONSTRAINT exam_students_exam_id_student_id_unique 
      UNIQUE (exam_id, student_id);
  END IF;
END $$;

-- 3. Create Performance Indexes for Exam Lifecycle & Assignment Lookups
CREATE INDEX IF NOT EXISTS idx_exams_lifecycle ON public.exams (status, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exams_dd_state ON public.exams (device_detection_state);
CREATE INDEX IF NOT EXISTS idx_exams_fv_enabled ON public.exams (face_verification_enabled);
CREATE INDEX IF NOT EXISTS idx_exam_students_composite ON public.exam_students (exam_id, student_id, verification_status);

-- 4. Server-Side Synchronisation Function
CREATE OR REPLACE FUNCTION public.sync_exam_statuses_server()
RETURNS TABLE (
  updated_count INT,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INT := 0;
  v_row_count INT;
BEGIN
  -- Advance scheduled exams to 'device_detection' at start_time if not paused/cancelled/completed
  UPDATE public.exams
  SET status = 'device_detection',
      device_detection_state = CASE 
        WHEN device_detection_paused THEN 'paused' 
        ELSE 'idle' -- Hardware process manager on Pi must confirm 'running' state
      END,
      updated_at = NOW()
  WHERE status IN ('scheduled', 'verification')
    AND NOW() >= start_time
    AND NOW() < end_time;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_updated := v_updated + v_row_count;

  -- Automatically complete exams at end_time
  UPDATE public.exams
  SET status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      device_detection_state = 'stopped',
      device_detection_stopped_at = COALESCE(device_detection_stopped_at, NOW()),
      face_verification_enabled = FALSE,
      updated_at = NOW()
  WHERE status NOT IN ('completed', 'cancelled')
    AND NOW() >= end_time;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_updated := v_updated + v_row_count;

  RETURN QUERY SELECT v_updated, 'Exam lifecycle sync completed safely.'::TEXT;
END;
$$;

-- Restrict privileged lifecycle execution to service_role only
REVOKE EXECUTE ON FUNCTION public.sync_exam_statuses_server() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_exam_statuses_server() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_exam_statuses_server() TO service_role;

-- 5. Realtime Publication Check
DO $$
DECLARE
  v_pub_exists BOOLEAN;
  v_tbl TEXT;
  v_tables TEXT[] := ARRAY['exams', 'exam_students', 'device_incidents'];
  v_in_pub BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO v_pub_exists;
  IF v_pub_exists THEN
    FOREACH v_tbl IN ARRAY v_tables LOOP
      SELECT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_tbl
      ) INTO v_in_pub;
      IF NOT v_in_pub THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', v_tbl);
      END IF;
    END LOOP;
  END IF;
END $$;
