-- Migration: Parent-Student Code Linking
-- Adds unique link_code to students and workspace_members with automatic generators.

-- 1. Helper function to generate unique student code (STU-XXXXXX)
CREATE OR REPLACE FUNCTION public.generate_student_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    res := 'STU-';
    FOR i IN 1..6 LOOP
      res := res || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.students WHERE link_code = res) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN res;
END;
$$;

-- 2. Helper function to generate unique parent/member code (PAR-XXXXXX)
CREATE OR REPLACE FUNCTION public.generate_parent_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    res := 'PAR-';
    FOR i IN 1..6 LOOP
      res := res || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.workspace_members WHERE link_code = res) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN res;
END;
$$;

-- 3. Add link_code column to students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS link_code text UNIQUE;

-- 4. Add link_code column to workspace_members
ALTER TABLE public.workspace_members 
ADD COLUMN IF NOT EXISTS link_code text UNIQUE;

-- 5. Trigger to auto-assign link_code on student insert if null
CREATE OR REPLACE FUNCTION public.set_student_link_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.link_code IS NULL OR NEW.link_code = '' THEN
    NEW.link_code := public.generate_student_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_student_link_code ON public.students;
CREATE TRIGGER trg_set_student_link_code
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.set_student_link_code();

-- 6. Trigger to auto-assign link_code on workspace_members insert if null
CREATE OR REPLACE FUNCTION public.set_member_link_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.link_code IS NULL OR NEW.link_code = '' THEN
    IF NEW.role = 'parent' THEN
      NEW.link_code := public.generate_parent_code();
    ELSE
      NEW.link_code := public.generate_student_code();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_member_link_code ON public.workspace_members;
CREATE TRIGGER trg_set_member_link_code
BEFORE INSERT ON public.workspace_members
FOR EACH ROW
EXECUTE FUNCTION public.set_member_link_code();

-- 7. Add index for fast lookup
CREATE INDEX IF NOT EXISTS idx_students_link_code ON public.students(link_code);
CREATE INDEX IF NOT EXISTS idx_workspace_members_link_code ON public.workspace_members(link_code);
