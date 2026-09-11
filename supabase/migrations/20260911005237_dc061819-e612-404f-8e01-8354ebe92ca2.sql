
-- 1. enums
DO $$ BEGIN
  CREATE TYPE public.challenge_scoring_type AS ENUM ('daily_completion','progress_percentage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.challenge_target_source AS ENUM ('fixed','personal_goal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.challenge_status AS ENUM ('open','running','ended','closed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE public.challenge_category ADD VALUE IF NOT EXISTS 'sleep';

-- 2. columns
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS scoring_type public.challenge_scoring_type NOT NULL DEFAULT 'daily_completion',
  ADD COLUMN IF NOT EXISTS max_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS target_source public.challenge_target_source NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS status public.challenge_status NOT NULL DEFAULT 'open';

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS score numeric NOT NULL DEFAULT 0;

-- prevent friend_code from ever changing
CREATE OR REPLACE FUNCTION public.lock_friend_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.friend_code IS DISTINCT FROM OLD.friend_code THEN
    RAISE EXCEPTION 'friend_code_is_permanent';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_profiles_lock_friend_code ON public.profiles;
CREATE TRIGGER trg_profiles_lock_friend_code
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_friend_code();

DROP FUNCTION IF EXISTS public.regenerate_friend_code();
