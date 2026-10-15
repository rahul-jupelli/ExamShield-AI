-- ==============================================================================
-- ExamShield AI: Exam Scheduling, Student Verification & Incident Review
-- File: supabase_exam_management_migration.sql (CORRECTED)
-- Version: 2026.10.2
-- Compatible with PostgreSQL 14+ / Supabase
-- ==============================================================================
-- NOTES:
-- 1. This migration establishes schemas for exams, exam_students, and device_incidents.
-- 2. It removes unrestricted public-access policies (USING (true) WITH CHECK (true)).
-- 3. Implements strict Row-Level Security:
--    - Authenticated users (operators, controllers, administrators) have full access.
--    - Service role / backend server has full bypass access.
--    - Anonymous / unauthenticated public traffic cannot read or tamper with exam,
--      student verification, or incident evidence records.
-- 4. Automatically protects cancelled exams so that scheduled transition triggers
--    cannot reactivate them.
-- 5. Hardens the private storage bucket 'incident-evidence' so that evidence photos
--    cannot be read anonymously or without an authenticated session / signed URL.
-- ==============================================================================

-- 1. Create Table: exams
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  room TEXT DEFAULT 'LH-302',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_exam_status CHECK (
    status IN ('scheduled', 'verification', 'device_detection', 'completed', 'cancelled')
  ),
  CONSTRAINT chk_exam_time_order CHECK (end_time > start_time)
);

-- Indexes for querying exams by status and time range
CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_time ON public.exams (start_time, end_time);

-- 2. Create Table: exam_students
-- Notice: student_id references public.students(id) which is TEXT
CREATE TABLE IF NOT EXISTS public.exam_students (
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  PRIMARY KEY (exam_id, student_id),
  CONSTRAINT chk_exam_student_verification_status CHECK (
    verification_status IN ('unverified', 'verified', 'failed', 'absent')
  )
);

-- Indexes for fast student and exam lookups
CREATE INDEX IF NOT EXISTS idx_exam_students_exam_id ON public.exam_students (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_students_student_id ON public.exam_students (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_students_verification_status ON public.exam_students (verification_status);

-- 3. Create Table: device_incidents
CREATE TABLE IF NOT EXISTS public.device_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  detected_class TEXT NOT NULL,
  confidence REAL NOT NULL,
  qualifying_frames INTEGER NOT NULL DEFAULT 1,
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'pending',
  evidence_paths JSONB DEFAULT '[]'::jsonb,
  evidence_complete BOOLEAN NOT NULL DEFAULT TRUE,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_device_incident_review_status CHECK (
    review_status IN ('pending', 'confirmed', 'dismissed')
  )
);

-- Indexes for incidents
CREATE INDEX IF NOT EXISTS idx_device_incidents_exam_id ON public.device_incidents (exam_id);
CREATE INDEX IF NOT EXISTS idx_device_incidents_student_id ON public.device_incidents (student_id);
CREATE INDEX IF NOT EXISTS idx_device_incidents_review_status ON public.device_incidents (review_status);
CREATE INDEX IF NOT EXISTS idx_device_incidents_created_at ON public.device_incidents (created_at DESC);

-- ==============================================================================
-- 4. Enable Row Level Security (RLS) & Hardened Access Policies
-- ==============================================================================

-- Drop any previous unrestricted public-access policies
DROP POLICY IF EXISTS "Allow public full access to exams" ON public.exams;
DROP POLICY IF EXISTS "Allow public full access to exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "Allow public full access to device_incidents" ON public.device_incidents;

-- Table: exams
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select exams" ON public.exams;
CREATE POLICY "Authenticated users can select exams"
  ON public.exams FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert exams" ON public.exams;
CREATE POLICY "Authenticated users can insert exams"
  ON public.exams FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update exams" ON public.exams;
CREATE POLICY "Authenticated users can update exams"
  ON public.exams FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete exams" ON public.exams;
CREATE POLICY "Authenticated users can delete exams"
  ON public.exams FOR DELETE
  TO authenticated
  USING (true);

-- Table: exam_students
ALTER TABLE public.exam_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select exam_students" ON public.exam_students;
CREATE POLICY "Authenticated users can select exam_students"
  ON public.exam_students FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert exam_students" ON public.exam_students;
CREATE POLICY "Authenticated users can insert exam_students"
  ON public.exam_students FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update exam_students" ON public.exam_students;
CREATE POLICY "Authenticated users can update exam_students"
  ON public.exam_students FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete exam_students" ON public.exam_students;
CREATE POLICY "Authenticated users can delete exam_students"
  ON public.exam_students FOR DELETE
  TO authenticated
  USING (true);

-- Table: device_incidents
ALTER TABLE public.device_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can select device_incidents" ON public.device_incidents;
CREATE POLICY "Authenticated users can select device_incidents"
  ON public.device_incidents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert device_incidents" ON public.device_incidents;
CREATE POLICY "Authenticated users can insert device_incidents"
  ON public.device_incidents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update device_incidents" ON public.device_incidents;
CREATE POLICY "Authenticated users can update device_incidents"
  ON public.device_incidents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can delete device_incidents" ON public.device_incidents;
CREATE POLICY "Authenticated users can delete device_incidents"
  ON public.device_incidents FOR DELETE
  TO authenticated
  USING (true);

-- ==============================================================================
-- 5. Private Storage Bucket for Incident Evidence Frames
-- ==============================================================================

-- Create or update private bucket 'incident-evidence'
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-evidence', 'incident-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Remove unrestricted storage access
DROP POLICY IF EXISTS "ExamShield incident evidence read" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence insert" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence update" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence delete" ON storage.objects;

-- Storage RLS: Require authentication for incident-evidence
CREATE POLICY "ExamShield incident evidence read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'incident-evidence');

CREATE POLICY "ExamShield incident evidence insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'incident-evidence');

CREATE POLICY "ExamShield incident evidence update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'incident-evidence')
  WITH CHECK (bucket_id = 'incident-evidence');

CREATE POLICY "ExamShield incident evidence delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'incident-evidence');

-- ==============================================================================
-- 6. Trigger for updated_at and Status Protection Function
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent cancelled exams from automatically transitioning to another status
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled examinations cannot be automatically reactivated or updated to a non-cancelled status.';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_exam_updated_at ON public.exams;
CREATE TRIGGER trigger_exam_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_exam_updated_at();

-- ==============================================================================
-- 7. Realtime Publication Setup
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exams;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.exam_students;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.device_incidents;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Realtime publication configuration skipped or already present.';
END $$;
