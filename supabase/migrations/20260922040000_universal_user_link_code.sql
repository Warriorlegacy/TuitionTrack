-- Migration: Universal User Link Code (Teacher, Student, Parent)
-- Ensures public.users also has a unique link_code generated for every role.

-- 1. Helper function for teacher user link code (TCH-XXXXXX)
CREATE OR REPLACE FUNCTION public.generate_teacher_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    res := 'TCH-';
    FOR i IN 1..6 LOOP
      res := res || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE link_code = res) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN res;
END;
$$;

-- 2. Add link_code column to public.users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS link_code text UNIQUE;

-- 3. Function to assign link_code on public.users
CREATE OR REPLACE FUNCTION public.set_user_link_code()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.link_code IS NULL OR NEW.link_code = '' THEN
    IF NEW.role::text = 'parent' THEN
      NEW.link_code := public.generate_parent_code();
    ELSIF NEW.role::text = 'student' THEN
      NEW.link_code := public.generate_student_code();
    ELSIF NEW.role::text = 'teacher' THEN
      NEW.link_code := public.generate_teacher_code();
    ELSE
      NEW.link_code := public.generate_student_code();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_user_link_code ON public.users;
CREATE TRIGGER trg_set_user_link_code
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_link_code();

-- 4. Backfill any existing users without link_code
UPDATE public.users
SET link_code = CASE 
  WHEN role::text = 'parent' THEN public.generate_parent_code()
  WHEN role::text = 'teacher' THEN public.generate_teacher_code()
  ELSE public.generate_student_code()
END
WHERE link_code IS NULL;

-- 5. Index for ultra-fast lookup
CREATE INDEX IF NOT EXISTS idx_users_link_code ON public.users(link_code);
