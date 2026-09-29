ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age smallint,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.validate_profile_onboarding()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.age IS NOT NULL AND (NEW.age < 10 OR NEW.age > 120) THEN
    RAISE EXCEPTION 'age must be between 10 and 120';
  END IF;
  IF NEW.primary_goal IS NOT NULL AND NEW.primary_goal NOT IN ('weight','exercise','daily_activity','nutrition','overall') THEN
    RAISE EXCEPTION 'invalid primary_goal';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_profile_onboarding_trg ON public.profiles;
CREATE TRIGGER validate_profile_onboarding_trg BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_onboarding();