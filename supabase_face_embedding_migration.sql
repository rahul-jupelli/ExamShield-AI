-- ExamShield: non-destructive FaceNet / pgvector setup
-- Run this only in Supabase SQL Editor if you need to verify/fix the live schema.
-- It does NOT drop the students table.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$
DECLARE
  current_udt text;
BEGIN
  SELECT udt_name
    INTO current_udt
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'students'
     AND column_name = 'faceEmbedding';

  IF current_udt IS NULL THEN
    ALTER TABLE public.students
      ADD COLUMN "faceEmbedding" vector(512);
  ELSIF current_udt <> 'vector' THEN
    -- Existing non-vector values are intentionally discarded because they are not
    -- trusted FaceNet embeddings. Existing student rows are not deleted.
    ALTER TABLE public.students DROP COLUMN "faceEmbedding";
    ALTER TABLE public.students ADD COLUMN "faceEmbedding" vector(512);
  ELSE
    -- Ensure the live vector column has the expected dimension.
    BEGIN
      ALTER TABLE public.students
        ALTER COLUMN "faceEmbedding" TYPE vector(512);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'faceEmbedding is already a vector column; no type change was needed.';
    END;
  END IF;
END $$;

-- Ensure the student photo bucket exists and is public because the application
-- stores a public Storage URL in students.photo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-photos', 'student-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "ExamShield student photos read" ON storage.objects;
CREATE POLICY "ExamShield student photos read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-photos');

DROP POLICY IF EXISTS "ExamShield student photos insert" ON storage.objects;
CREATE POLICY "ExamShield student photos insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-photos');
