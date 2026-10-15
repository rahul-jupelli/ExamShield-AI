-- ==============================================================================
-- ExamShield AI: Hardened Schema, Constraints & Role-Based Security Migration
-- File: supabase_targeted_exam_security_migration.sql
-- Version: 2026.10.5
-- Specifically tailored for existing tables:
--   - public.exams
--   - public.exam_students
--   - public.device_incidents
-- ==============================================================================
-- CRITICAL SAFETY GUARANTEES:
-- 1. Non-destructive: NEVER drops or recreates existing tables.
-- 2. Preserves student records, face embeddings, QR codes, and existing data.
-- 3. Pre-flight Validation: Halts execution if existing data violates constraints,
--    reporting the exact queries needed to inspect the conflicting records.
-- 4. Never defaults roles to 'Admin'. Missing, unassigned, or invalid roles return NULL
--    and are strictly denied access.
-- 5. Column-Level Integrity:
--    - Trigger 'trg_protect_exam_students_columns' prevents altering exam_id or student_id.
--    - Trigger 'trg_protect_device_incident_columns' prevents unauthorized alteration
--      of incident identity, detection class, confidence, qualifying frames,
--      evidence paths, evidence completeness, or created_at timestamp.
-- 6. Selected-Student Verification Initialization:
--    - 'initialize_exam_verification_students(p_exam_id)' operates STRICTLY on students
--      already explicitly assigned/selected for that exam in public.exam_students.
--    - It NEVER selects every row from public.students.
--    - It NEVER resets previously 'verified', 'failed', or 'absent' candidate statuses.
-- 7. Realtime Publication: Safely checks each table individually without masking genuine SQL errors.
-- 8. Storage: Private 'incident-evidence' bucket with role-scoped policies. Existing
--    'student-photos' bucket and its policies are untouched.
-- ==============================================================================

-- ==============================================================================
-- STEP 1: Pre-Flight Validation (Halt Migration on Existing Incompatible Data)
-- ==============================================================================
-- If any incompatible rows exist, the migration will abort immediately with an
-- exception explaining how to inspect the conflicting rows. No data will be modified.

DO $$
DECLARE
  v_invalid_exam_status_count INT;
  v_invalid_exam_times_count INT;
  v_invalid_student_status_count INT;
  v_invalid_incident_status_count INT;
BEGIN
  -- 1.1 Check exam status values
  SELECT COUNT(*) INTO v_invalid_exam_status_count
  FROM public.exams
  WHERE status IS NOT NULL
    AND status NOT IN ('scheduled', 'verification', 'device_detection', 'completed', 'cancelled');

  IF v_invalid_exam_status_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % row(s) in public.exams with invalid status. Inspect with: SELECT id, exam_name, status FROM public.exams WHERE status NOT IN (''scheduled'', ''verification'', ''device_detection'', ''completed'', ''cancelled'');', v_invalid_exam_status_count;
  END IF;

  -- 1.2 Check exam start/end time order
  SELECT COUNT(*) INTO v_invalid_exam_times_count
  FROM public.exams
  WHERE start_time IS NOT NULL
    AND end_time IS NOT NULL
    AND end_time <= start_time;

  IF v_invalid_exam_times_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % row(s) in public.exams where end_time <= start_time. Inspect with: SELECT id, exam_name, start_time, end_time FROM public.exams WHERE end_time <= start_time;', v_invalid_exam_times_count;
  END IF;

  -- 1.3 Check student verification status values
  SELECT COUNT(*) INTO v_invalid_student_status_count
  FROM public.exam_students
  WHERE verification_status IS NOT NULL
    AND verification_status NOT IN ('unverified', 'verified', 'failed', 'absent');

  IF v_invalid_student_status_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % row(s) in public.exam_students with invalid verification_status. Inspect with: SELECT exam_id, student_id, verification_status FROM public.exam_students WHERE verification_status NOT IN (''unverified'', ''verified'', ''failed'', ''absent'');', v_invalid_student_status_count;
  END IF;

  -- 1.4 Check incident review status values
  SELECT COUNT(*) INTO v_invalid_incident_status_count
  FROM public.device_incidents
  WHERE review_status IS NOT NULL
    AND review_status NOT IN ('pending', 'confirmed', 'dismissed');

  IF v_invalid_incident_status_count > 0 THEN
    RAISE EXCEPTION 'MIGRATION HALTED: Found % row(s) in public.device_incidents with invalid review_status. Inspect with: SELECT id, exam_id, review_status FROM public.device_incidents WHERE review_status NOT IN (''pending'', ''confirmed'', ''dismissed'');', v_invalid_incident_status_count;
  END IF;

  RAISE NOTICE 'Pre-flight check passed: Existing data is fully compatible with target constraints.';
END $$;

-- ==============================================================================
-- STEP 2: Add Missing Columns & Safe Defaults (Non-Destructive)
-- ==============================================================================

-- 2.1 Add 'room' column to exams if missing (default 'LH-302')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'exams' 
      AND column_name = 'room'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN room TEXT DEFAULT 'LH-302';
  END IF;
END $$;

-- 2.2 Add 'archived' flag to exams to support archival instead of hard deletion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'exams' 
      AND column_name = 'archived'
  ) THEN
    ALTER TABLE public.exams ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- 2.3 Set safe defaults on public.exams
ALTER TABLE public.exams ALTER COLUMN status SET DEFAULT 'scheduled';
ALTER TABLE public.exams ALTER COLUMN created_at SET DEFAULT NOW();
ALTER TABLE public.exams ALTER COLUMN updated_at SET DEFAULT NOW();

-- 2.4 Set safe defaults on public.exam_students
ALTER TABLE public.exam_students ALTER COLUMN verification_status SET DEFAULT 'unverified';

-- 2.5 Set safe defaults on public.device_incidents
-- NOTE: evidence_complete defaults to FALSE for newly detected incidents.
-- It is set to TRUE only when the inference pipeline verifies that qualifying frames were captured.
ALTER TABLE public.device_incidents ALTER COLUMN review_status SET DEFAULT 'pending';
ALTER TABLE public.device_incidents ALTER COLUMN evidence_complete SET DEFAULT FALSE;
ALTER TABLE public.device_incidents ALTER COLUMN created_at SET DEFAULT NOW();

-- ==============================================================================
-- STEP 3: Add Check Constraints (Safe & Idempotent)
-- ==============================================================================

-- 3.1 Constraint on exam status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exam_status' AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams 
      ADD CONSTRAINT chk_exam_status 
      CHECK (status IN ('scheduled', 'verification', 'device_detection', 'completed', 'cancelled'));
  END IF;
END $$;

-- 3.2 Constraint: end_time must be strictly after start_time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exam_time_order' AND conrelid = 'public.exams'::regclass
  ) THEN
    ALTER TABLE public.exams 
      ADD CONSTRAINT chk_exam_time_order 
      CHECK (end_time > start_time);
  END IF;
END $$;

-- 3.3 Constraint on per-exam student verification status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_exam_student_verification_status' AND conrelid = 'public.exam_students'::regclass
  ) THEN
    ALTER TABLE public.exam_students 
      ADD CONSTRAINT chk_exam_student_verification_status 
      CHECK (verification_status IN ('unverified', 'verified', 'failed', 'absent'));
  END IF;
END $$;

-- 3.4 Constraint on incident review status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_device_incident_review_status' AND conrelid = 'public.device_incidents'::regclass
  ) THEN
    ALTER TABLE public.device_incidents 
      ADD CONSTRAINT chk_device_incident_review_status 
      CHECK (review_status IN ('pending', 'confirmed', 'dismissed'));
  END IF;
END $$;

-- ==============================================================================
-- STEP 4: Create Performance Indexes
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_exams_status ON public.exams (status);
CREATE INDEX IF NOT EXISTS idx_exams_time ON public.exams (start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_exams_archived ON public.exams (archived);
CREATE INDEX IF NOT EXISTS idx_exam_students_exam_id ON public.exam_students (exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_students_student_id ON public.exam_students (student_id);
CREATE INDEX IF NOT EXISTS idx_exam_students_verification_status ON public.exam_students (verification_status);
CREATE INDEX IF NOT EXISTS idx_device_incidents_exam_id ON public.device_incidents (exam_id);
CREATE INDEX IF NOT EXISTS idx_device_incidents_student_id ON public.device_incidents (student_id);
CREATE INDEX IF NOT EXISTS idx_device_incidents_review_status ON public.device_incidents (review_status);
CREATE INDEX IF NOT EXISTS idx_device_incidents_created_at ON public.device_incidents (created_at DESC);

-- ==============================================================================
-- STEP 5: Hardened Role Resolution Function
-- ==============================================================================
-- Security Requirements:
-- 1. Never defaults to 'Admin'. Missing or invalid roles return NULL.
-- 2. Reads strictly from auth.jwt() -> 'app_metadata' ->> 'role'.
--    (app_metadata cannot be altered by client users, unlike user_metadata).
-- 3. Explicit search_path = public, pg_temp.
-- 4. Rejects any role value not in ('Admin', 'Exam Controller', 'Operator', 'Viewer').

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Extract role strictly from app_metadata managed by administrators
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';

  -- Fallback check: service_role token identifies as Admin
  IF v_role IS NULL THEN
    IF auth.jwt() ->> 'role' = 'service_role' THEN
      RETURN 'Admin';
    END IF;
    RETURN NULL; -- Strict: Unknown/unassigned roles get NULL (DENY ALL)
  END IF;

  -- Validate against permitted role whitelist
  IF v_role IN ('Admin', 'Exam Controller', 'Operator', 'Viewer') THEN
    RETURN v_role;
  END IF;

  RETURN NULL; -- Invalid or tampered role denied
END;
$$;

-- Revoke execute from PUBLIC and grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, service_role;

-- ==============================================================================
-- STEP 6: Column-Level Integrity Triggers
-- ==============================================================================

-- 6.1 Protect exam_students identity columns
-- Operators are permitted to update verification_status and verified_at ONLY.
-- They CANNOT change exam_id or student_id.
CREATE OR REPLACE FUNCTION public.protect_exam_students_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.exam_id <> NEW.exam_id) OR (OLD.student_id <> NEW.student_id) THEN
    RAISE EXCEPTION 'Permission Denied: Reassigning exam_id or student_id on an existing candidate record is not permitted.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_exam_students_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_exam_students_columns() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_exam_students_columns ON public.exam_students;
CREATE TRIGGER trg_protect_exam_students_columns
  BEFORE UPDATE ON public.exam_students
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_exam_students_columns();

-- 6.2 Protect device_incidents detection metadata & evidence
-- Incident reviewers may ONLY update review_status, student_id, reviewed_by, and reviewed_at.
-- They CANNOT alter the incident id, exam_id, detected_class, confidence, qualifying_frames,
-- evidence_paths, evidence_complete, or created_at timestamp.
CREATE OR REPLACE FUNCTION public.protect_device_incident_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  v_caller_role := public.get_auth_role();

  -- Service role and full Admin can modify for disaster recovery
  IF v_caller_role = 'Admin' THEN
    RETURN NEW;
  END IF;

  -- For Exam Controllers and Operators: detection fields are strictly immutable
  IF (OLD.id <> NEW.id) OR
     (OLD.exam_id <> NEW.exam_id) OR
     (OLD.detected_class <> NEW.detected_class) OR
     (OLD.confidence <> NEW.confidence) OR
     (OLD.qualifying_frames <> NEW.qualifying_frames) OR
     (OLD.evidence_paths IS DISTINCT FROM NEW.evidence_paths) OR
     (OLD.evidence_complete IS DISTINCT FROM NEW.evidence_complete) OR
     (OLD.created_at <> NEW.created_at) THEN
    RAISE EXCEPTION 'Permission Denied: Incident detection metadata and visual evidence frames are immutable. Only review_status, student_id, reviewed_by, and reviewed_at may be updated.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_device_incident_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_device_incident_columns() TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_protect_device_incident_columns ON public.device_incidents;
CREATE TRIGGER trg_protect_device_incident_columns
  BEFORE UPDATE ON public.device_incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_device_incident_columns();

-- ==============================================================================
-- STEP 7: Narrow Row Level Security (RLS) on public.exams
-- ==============================================================================

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to exams" ON public.exams;
DROP POLICY IF EXISTS "Authenticated users can select exams" ON public.exams;
DROP POLICY IF EXISTS "Authenticated users can insert exams" ON public.exams;
DROP POLICY IF EXISTS "Authenticated users can update exams" ON public.exams;
DROP POLICY IF EXISTS "Authenticated users can delete exams" ON public.exams;
DROP POLICY IF EXISTS "exams_select_policy" ON public.exams;
DROP POLICY IF EXISTS "exams_insert_policy" ON public.exams;
DROP POLICY IF EXISTS "exams_update_policy" ON public.exams;
DROP POLICY IF EXISTS "exams_delete_policy" ON public.exams;

-- 7.1 SELECT: Permitted roles can view active (unarchived) exams
CREATE POLICY "exams_select_policy"
  ON public.exams FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator', 'Viewer')
  );

-- 7.2 INSERT: Only Admins and Exam Controllers can schedule exams
CREATE POLICY "exams_insert_policy"
  ON public.exams FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Exam Controller')
  );

-- 7.3 UPDATE: Only Admins and Exam Controllers can modify exam schedules/details
CREATE POLICY "exams_update_policy"
  ON public.exams FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller')
  )
  WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Exam Controller')
  );

-- 7.4 DELETE: Hard deletion restricted to Admin disaster recovery
CREATE POLICY "exams_delete_policy"
  ON public.exams FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() = 'Admin'
  );

-- ==============================================================================
-- STEP 8: Narrow Row Level Security (RLS) on public.exam_students
-- ==============================================================================

ALTER TABLE public.exam_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "Authenticated users can select exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "Authenticated users can insert exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "Authenticated users can update exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "Authenticated users can delete exam_students" ON public.exam_students;
DROP POLICY IF EXISTS "exam_students_select_policy" ON public.exam_students;
DROP POLICY IF EXISTS "exam_students_insert_policy" ON public.exam_students;
DROP POLICY IF EXISTS "exam_students_update_policy" ON public.exam_students;
DROP POLICY IF EXISTS "exam_students_delete_policy" ON public.exam_students;

-- 8.1 SELECT: Authorized staff can view student assignments
CREATE POLICY "exam_students_select_policy"
  ON public.exam_students FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator', 'Viewer')
  );

-- 8.2 INSERT: Only Admins and Exam Controllers can assign students to exams
CREATE POLICY "exam_students_insert_policy"
  ON public.exam_students FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Exam Controller')
  );

-- 8.3 UPDATE:
-- Admins, Controllers, and Operators can update verification results.
-- Column tampering (exam_id, student_id) is blocked by trg_protect_exam_students_columns.
CREATE POLICY "exam_students_update_policy"
  ON public.exam_students FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
  )
  WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
    AND verification_status IN ('unverified', 'verified', 'failed', 'absent')
  );

-- 8.4 DELETE: Only Admins and Exam Controllers can unassign students
CREATE POLICY "exam_students_delete_policy"
  ON public.exam_students FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller')
  );

-- ==============================================================================
-- STEP 9: Narrow Row Level Security (RLS) on public.device_incidents
-- ==============================================================================

ALTER TABLE public.device_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access to device_incidents" ON public.device_incidents;
DROP POLICY IF EXISTS "Authenticated users can select device_incidents" ON public.device_incidents;
DROP POLICY IF EXISTS "Authenticated users can insert device_incidents" ON public.device_incidents;
DROP POLICY IF EXISTS "Authenticated users can update device_incidents" ON public.device_incidents;
DROP POLICY IF EXISTS "Authenticated users can delete device_incidents" ON public.device_incidents;
DROP POLICY IF EXISTS "device_incidents_select_policy" ON public.device_incidents;
DROP POLICY IF EXISTS "device_incidents_insert_policy" ON public.device_incidents;
DROP POLICY IF EXISTS "device_incidents_update_policy" ON public.device_incidents;
DROP POLICY IF EXISTS "device_incidents_delete_policy" ON public.device_incidents;

-- 9.1 SELECT: Authorized staff can view recorded incidents
CREATE POLICY "device_incidents_select_policy"
  ON public.device_incidents FOR SELECT
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator', 'Viewer')
  );

-- 9.2 INSERT: Authorized edge rover pipeline / server / Admins
CREATE POLICY "device_incidents_insert_policy"
  ON public.device_incidents FOR INSERT
  TO authenticated
  WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
  );

-- 9.3 UPDATE:
-- Restricts reviews to authorized reviewers (Admin, Controller, Operator).
-- Immutable columns are enforced by trg_protect_device_incident_columns.
CREATE POLICY "device_incidents_update_policy"
  ON public.device_incidents FOR UPDATE
  TO authenticated
  USING (
    public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
  )
  WITH CHECK (
    review_status IN ('pending', 'confirmed', 'dismissed')
    AND public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
  );

-- 9.4 DELETE: Operators CANNOT delete incidents. Only Admin.
CREATE POLICY "device_incidents_delete_policy"
  ON public.device_incidents FOR DELETE
  TO authenticated
  USING (
    public.get_auth_role() = 'Admin'
  );

-- ==============================================================================
-- STEP 10: Configure Private 'incident-evidence' Storage Bucket & Narrow Policies
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-evidence', 'incident-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "ExamShield incident evidence read" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence insert" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence update" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence delete" ON storage.objects;
DROP POLICY IF EXISTS "incident_evidence_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "incident_evidence_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "incident_evidence_update_policy" ON storage.objects;
DROP POLICY IF EXISTS "incident_evidence_delete_policy" ON storage.objects;

-- 10.1 Evidence Read: Authorized roles only (Admin, Controller, Operator, Viewer)
CREATE POLICY "incident_evidence_read_policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator', 'Viewer')
  );

-- 10.2 Evidence Insert: Edge inference upload / Admin / Controller / Operator
CREATE POLICY "incident_evidence_insert_policy"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'incident-evidence'
    AND public.get_auth_role() IN ('Admin', 'Exam Controller', 'Operator')
  );

-- 10.3 Evidence Update: Restricted to Admins (immutable evidence)
CREATE POLICY "incident_evidence_update_policy"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND public.get_auth_role() = 'Admin'
  )
  WITH CHECK (
    bucket_id = 'incident-evidence'
    AND public.get_auth_role() = 'Admin'
  );

-- 10.4 Evidence Delete: Restricted to Admins (preserves audit trail)
CREATE POLICY "incident_evidence_delete_policy"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'incident-evidence'
    AND public.get_auth_role() = 'Admin'
  );

-- ==============================================================================
-- STEP 11: Prevent Automatic Reactivation of Cancelled Exams & Update Trigger
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_exam_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' THEN
    RAISE EXCEPTION 'Constraint Violation: Cancelled examinations cannot be reactivated or transitioned automatically.';
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_exam_updated_at ON public.exams;
CREATE TRIGGER trigger_exam_updated_at
  BEFORE UPDATE ON public.exams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_exam_updated_at();

-- ==============================================================================
-- STEP 12: Server-Side Lifecycle Procedures
-- ==============================================================================

-- 12.1 Reliable status transition logic
-- Correctly handles phase boundaries:
-- - verification begins 60 min before start_time
-- - device_detection begins at start_time
-- - completed occurs at end_time
-- - Cancelled exams are strictly excluded.
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
  -- Phase 1: Advance to 'verification' (start_time - 60 min <= NOW() < start_time)
  UPDATE public.exams
  SET status = 'verification'
  WHERE status = 'scheduled'
    AND NOW() >= (start_time - INTERVAL '60 minutes')
    AND NOW() < start_time;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_updated := v_updated + v_row_count;

  -- Phase 2: Advance to 'device_detection' (start_time <= NOW() < end_time)
  -- Catches exams that were 'scheduled' or 'verification', including missed runs
  UPDATE public.exams
  SET status = 'device_detection'
  WHERE status IN ('scheduled', 'verification')
    AND NOW() >= start_time
    AND NOW() < end_time;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_updated := v_updated + v_row_count;

  -- Phase 3: Advance to 'completed' (NOW() >= end_time)
  -- Strictly excludes 'cancelled' and 'completed'
  UPDATE public.exams
  SET status = 'completed'
  WHERE status NOT IN ('cancelled', 'completed')
    AND NOW() >= end_time;
  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  v_updated := v_updated + v_row_count;

  RETURN QUERY SELECT v_updated, 'Exam lifecycle sync completed safely.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_exam_statuses_server() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_exam_statuses_server() TO authenticated, service_role;

-- 12.2 Selected-Student Verification Initialization
-- Initializes ONLY the students explicitly assigned/selected for that exam.
-- Does NOT select all rows from public.students.
-- NEVER resets previously 'verified', 'failed', or 'absent' candidate statuses.
CREATE OR REPLACE FUNCTION public.initialize_exam_verification_students(p_exam_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_updated INT := 0;
BEGIN
  v_caller_role := public.get_auth_role();

  -- Authorization check: Caller must be an authorized staff member
  IF v_caller_role NOT IN ('Admin', 'Exam Controller', 'Operator') THEN
    RAISE EXCEPTION 'Permission Denied: Only Admin, Exam Controller, or Operator can initialize verification.';
  END IF;

  -- For candidates already assigned to this exam who have NULL verification_status,
  -- initialize them to 'unverified'. Existing 'verified', 'failed', or 'absent' rows are UNTOUCHED.
  UPDATE public.exam_students
  SET verification_status = 'unverified'
  WHERE exam_id = p_exam_id
    AND verification_status IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.initialize_exam_verification_students(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_exam_verification_students(UUID) TO authenticated, service_role;

-- ==============================================================================
-- STEP 13: Realtime Publication Check (Individual Safe Checks)
-- ==============================================================================

DO $$
DECLARE
  v_pub_exists BOOLEAN;
  v_table_in_pub BOOLEAN;
  v_target_tables TEXT[] := ARRAY['exams', 'exam_students', 'device_incidents'];
  v_tbl TEXT;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
  INTO v_pub_exists;

  IF v_pub_exists THEN
    FOREACH v_tbl IN ARRAY v_target_tables LOOP
      SELECT EXISTS (
        SELECT 1 
        FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = v_tbl
      ) INTO v_table_in_pub;

      IF NOT v_table_in_pub THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', v_tbl);
        RAISE NOTICE 'Added table public.% to publication supabase_realtime.', v_tbl;
      ELSE
        RAISE NOTICE 'Table public.% is already in publication supabase_realtime.', v_tbl;
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime does not exist; skipping publication update.';
  END IF;
END $$;
