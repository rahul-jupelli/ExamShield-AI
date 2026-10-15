-- ==============================================================================
-- ExamShield AI: Remediation Migration for Hardening Exam & Evidence Policies
-- File: supabase_remediation_harden_policies.sql
-- Use this script IF you already ran the initial version of
-- supabase_exam_management_migration.sql and need to remove unrestricted public
-- access policies without dropping existing tables or data.
-- ==============================================================================

-- 1. Revoke unrestricted public access on public.exams
DROP POLICY IF EXISTS "Allow public full access to exams" ON public.exams;

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

-- 2. Revoke unrestricted public access on public.exam_students
DROP POLICY IF EXISTS "Allow public full access to exam_students" ON public.exam_students;

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

-- 3. Revoke unrestricted public access on public.device_incidents
DROP POLICY IF EXISTS "Allow public full access to device_incidents" ON public.device_incidents;

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

-- 4. Harden private storage bucket 'incident-evidence'
INSERT INTO storage.buckets (id, name, public)
VALUES ('incident-evidence', 'incident-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "ExamShield incident evidence read" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence insert" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence update" ON storage.objects;
DROP POLICY IF EXISTS "ExamShield incident evidence delete" ON storage.objects;

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

-- 5. Install or replace status protection trigger
CREATE OR REPLACE FUNCTION public.handle_exam_updated_at()
RETURNS TRIGGER AS $$
BEGIN
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
