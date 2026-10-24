-- ==============================================================================
-- ExamShield AI: Minimal Non-Destructive Migration for Exams Table
-- File: supabase_minimal_room_migration.sql
-- ==============================================================================
-- Purpose:
-- Adds the missing 'room' column to public.exams table without dropping or
-- modifying any existing tables, constraints, student records, or face embeddings.
--
-- Compatibility & Safety Guarantees:
-- 1. Non-destructive: Uses ADD COLUMN IF NOT EXISTS.
-- 2. Defaults to 'LH-302' (the primary exam hall in ExamShield).
-- 3. Does NOT drop or recreate public.exams, preserving all existing examination data.
-- ==============================================================================

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

-- Verify column addition
COMMENT ON COLUMN public.exams.room IS 'Designated examination hall/room (default: LH-302)';
