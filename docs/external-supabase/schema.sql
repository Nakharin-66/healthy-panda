-- Healthy Panda — portable schema bundle for an EXTERNAL Supabase project
-- Run this once in the SQL editor of your own Supabase project (in this order).

-- ============ supabase/migrations/20260803090727_f3bfc368-eacd-4b5d-bf49-6771cc2e0ef1.sql ============
CREATE TABLE public.health_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pair_code text NOT NULL UNIQUE,
  ingest_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  platform text,
  app_version text,
  paired_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.health_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.health_devices(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value numeric NOT NULL,
  unit text,
  recorded_at timestamptz NOT NULL,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, metric, recorded_at)
);

CREATE INDEX health_samples_device_metric_idx ON public.health_samples (device_id, metric, recorded_at DESC);

GRANT ALL ON public.health_devices TO service_role;
GRANT ALL ON public.health_samples TO service_role;

ALTER TABLE public.health_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_samples ENABLE ROW LEVEL SECURITY;
-- ============ supabase/migrations/20260803104820_70bc9db9-5304-4028-a8f7-0c913760769e.sql ============
-- =========================================================
-- Healthy Panda — complete schema
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------- enums ----------
CREATE TYPE public.gender AS ENUM ('male','female','other','undisclosed');
CREATE TYPE public.activity_level AS ENUM ('sedentary','light','moderate','active','very_active');
CREATE TYPE public.device_platform AS ENUM ('android','ios','wearos','watchos','web','other');
CREATE TYPE public.device_kind AS ENUM ('smartwatch','health_connect','apple_health','manual','other');
CREATE TYPE public.pair_status AS ENUM ('pending','paired','revoked');
CREATE TYPE public.metric_type AS ENUM (
  'steps','distance_km','calories_burned','calories_intake','heart_rate','resting_heart_rate',
  'spo2','sleep_minutes','water_ml','exercise_minutes','active_minutes','body_weight_kg','bmi'
);
CREATE TYPE public.meal_type AS ENUM ('breakfast','lunch','dinner','snack');
CREATE TYPE public.chat_role AS ENUM ('user','assistant','system');
CREATE TYPE public.risk_level AS ENUM ('low','medium','high');
CREATE TYPE public.notification_type AS ENUM ('reminder','achievement','coach','system','challenge');
CREATE TYPE public.privacy_level AS ENUM ('private','friends','public');

-- ---------- 1. profiles ----------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  line_user_id text UNIQUE,
  display_name text NOT NULL DEFAULT 'Panda Friend',
  picture_url text,
  email text,
  gender public.gender NOT NULL DEFAULT 'undisclosed',
  birthday date,
  height_cm numeric(5,2) CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm < 300)),
  weight_kg numeric(5,2) CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg < 500)),
  target_weight_kg numeric(5,2) CHECK (target_weight_kg IS NULL OR (target_weight_kg > 0 AND target_weight_kg < 500)),
  activity_level public.activity_level NOT NULL DEFAULT 'moderate',
  language text NOT NULL DEFAULT 'th',
  timezone text NOT NULL DEFAULT 'Asia/Bangkok',
  streak_days integer NOT NULL DEFAULT 0 CHECK (streak_days >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles own read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "profiles own insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles own update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles own delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_line_user_id ON public.profiles(line_user_id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- helper: current profile id
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
$$;

-- auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email, picture_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', 'Panda Friend'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_settings (profile_id)
  SELECT id FROM public.profiles WHERE user_id = NEW.id
  ON CONFLICT (profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------- 2. connected devices (extend existing health_devices) ----------
ALTER TABLE public.health_devices
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS device_kind public.device_kind NOT NULL DEFAULT 'health_connect',
  ADD COLUMN IF NOT EXISTS pair_status public.pair_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_devices_pair_code ON public.health_devices(pair_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_devices_ingest_token ON public.health_devices(ingest_token);
CREATE INDEX IF NOT EXISTS idx_health_devices_profile ON public.health_devices(profile_id, last_sync_at DESC);
GRANT SELECT ON public.health_devices TO authenticated;
GRANT ALL ON public.health_devices TO service_role;
CREATE POLICY "devices own read" ON public.health_devices FOR SELECT TO authenticated USING (profile_id = public.current_profile_id());
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON public.health_devices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 3. health samples (extend existing) ----------
ALTER TABLE public.health_samples
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_samples_dedupe ON public.health_samples(device_id, metric, recorded_at);
CREATE INDEX IF NOT EXISTS idx_health_samples_profile_metric ON public.health_samples(profile_id, metric, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_samples_recorded_at ON public.health_samples(recorded_at DESC);
GRANT SELECT ON public.health_samples TO authenticated;
GRANT ALL ON public.health_samples TO service_role;
CREATE POLICY "samples own read" ON public.health_samples FOR SELECT TO authenticated USING (profile_id = public.current_profile_id());
CREATE TRIGGER trg_samples_updated BEFORE UPDATE ON public.health_samples FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 4. water logs ----------
CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_ml integer NOT NULL CHECK (amount_ml > 0 AND amount_ml <= 5000),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.water_logs TO authenticated;
GRANT ALL ON public.water_logs TO service_role;
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "water own all" ON public.water_logs FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_water_logs_profile ON public.water_logs(profile_id, recorded_at DESC);
CREATE TRIGGER trg_water_updated BEFORE UPDATE ON public.water_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 5. food logs ----------
CREATE TABLE public.food_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url text,
  food_name text NOT NULL,
  meal_type public.meal_type NOT NULL DEFAULT 'snack',
  calories numeric(8,2) NOT NULL DEFAULT 0 CHECK (calories >= 0),
  protein_g numeric(7,2) NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  fat_g numeric(7,2) NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  carbohydrates_g numeric(7,2) NOT NULL DEFAULT 0 CHECK (carbohydrates_g >= 0),
  fiber_g numeric(7,2) DEFAULT 0 CHECK (fiber_g IS NULL OR fiber_g >= 0),
  sugar_g numeric(7,2) DEFAULT 0 CHECK (sugar_g IS NULL OR sugar_g >= 0),
  sodium_mg numeric(8,2) DEFAULT 0 CHECK (sodium_mg IS NULL OR sodium_mg >= 0),
  ai_confidence numeric(4,3) CHECK (ai_confidence IS NULL OR (ai_confidence >= 0 AND ai_confidence <= 1)),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.food_logs TO authenticated;
GRANT ALL ON public.food_logs TO service_role;
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "food own all" ON public.food_logs FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_food_logs_profile ON public.food_logs(profile_id, recorded_at DESC);
CREATE INDEX idx_food_logs_meal ON public.food_logs(profile_id, meal_type, recorded_at DESC);
CREATE TRIGGER trg_food_updated BEFORE UPDATE ON public.food_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 6. exercise logs ----------
CREATE TABLE public.exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  calories numeric(8,2) NOT NULL DEFAULT 0 CHECK (calories >= 0),
  average_heart_rate integer CHECK (average_heart_rate IS NULL OR (average_heart_rate > 0 AND average_heart_rate < 300)),
  source text NOT NULL DEFAULT 'manual',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_logs TO authenticated;
GRANT ALL ON public.exercise_logs TO service_role;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exercise own all" ON public.exercise_logs FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_exercise_logs_profile ON public.exercise_logs(profile_id, recorded_at DESC);
CREATE TRIGGER trg_exercise_updated BEFORE UPDATE ON public.exercise_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 7. daily goals ----------
CREATE TABLE public.daily_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  steps_goal integer NOT NULL DEFAULT 8000 CHECK (steps_goal > 0),
  calories_goal integer NOT NULL DEFAULT 2100 CHECK (calories_goal > 0),
  water_goal_ml integer NOT NULL DEFAULT 2500 CHECK (water_goal_ml > 0),
  sleep_goal_minutes integer NOT NULL DEFAULT 480 CHECK (sleep_goal_minutes > 0),
  protein_goal_g integer NOT NULL DEFAULT 120 CHECK (protein_goal_g >= 0),
  fat_goal_g integer NOT NULL DEFAULT 65 CHECK (fat_goal_g >= 0),
  carb_goal_g integer NOT NULL DEFAULT 240 CHECK (carb_goal_g >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, effective_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_goals TO authenticated;
GRANT ALL ON public.daily_goals TO service_role;
ALTER TABLE public.daily_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals own all" ON public.daily_goals FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_daily_goals_profile ON public.daily_goals(profile_id, effective_date DESC);
CREATE TRIGGER trg_goals_updated BEFORE UPDATE ON public.daily_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 8. daily statistics ----------
CREATE TABLE public.daily_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stat_date date NOT NULL DEFAULT CURRENT_DATE,
  health_score integer CHECK (health_score IS NULL OR (health_score >= 0 AND health_score <= 100)),
  steps integer NOT NULL DEFAULT 0 CHECK (steps >= 0),
  calories numeric(8,2) NOT NULL DEFAULT 0 CHECK (calories >= 0),
  water_ml integer NOT NULL DEFAULT 0 CHECK (water_ml >= 0),
  sleep_minutes integer NOT NULL DEFAULT 0 CHECK (sleep_minutes >= 0),
  exercise_minutes integer NOT NULL DEFAULT 0 CHECK (exercise_minutes >= 0),
  heart_rate_avg numeric(5,1),
  spo2_avg numeric(4,1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, stat_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_statistics TO authenticated;
GRANT ALL ON public.daily_statistics TO service_role;
ALTER TABLE public.daily_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats own all" ON public.daily_statistics FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_daily_stats_profile ON public.daily_statistics(profile_id, stat_date DESC);
CREATE INDEX idx_daily_stats_steps ON public.daily_statistics(stat_date, steps DESC);
CREATE TRIGGER trg_stats_updated BEFORE UPDATE ON public.daily_statistics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 9. ai conversations ----------
CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role public.chat_role NOT NULL,
  message text NOT NULL,
  tokens integer CHECK (tokens IS NULL OR tokens >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat own all" ON public.ai_conversations FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_ai_conv_profile ON public.ai_conversations(profile_id, created_at DESC);
CREATE INDEX idx_ai_conv_session ON public.ai_conversations(session_id, created_at);
CREATE TRIGGER trg_chat_updated BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 10. ai recommendations ----------
CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation text NOT NULL,
  summary text,
  risk_level public.risk_level NOT NULL DEFAULT 'low',
  recommendation_type text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reco own all" ON public.ai_recommendations FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_ai_reco_profile ON public.ai_recommendations(profile_id, created_at DESC);
CREATE TRIGGER trg_reco_updated BEFORE UPDATE ON public.ai_recommendations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 11. challenges ----------
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  icon text,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date NOT NULL,
  reward_points integer NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);
GRANT SELECT ON public.challenges TO authenticated, anon;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "challenges public read" ON public.challenges FOR SELECT TO authenticated, anon USING (is_active);
CREATE INDEX idx_challenges_active ON public.challenges(is_active, end_date DESC);
CREATE TRIGGER trg_challenges_updated BEFORE UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 12. challenge participants ----------
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress numeric(6,2) NOT NULL DEFAULT 0 CHECK (progress >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, profile_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants own all" ON public.challenge_participants FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_participants_challenge ON public.challenge_participants(challenge_id, progress DESC);
CREATE INDEX idx_participants_profile ON public.challenge_participants(profile_id);
CREATE TRIGGER trg_participants_updated BEFORE UPDATE ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 13. user badges ----------
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_name text NOT NULL,
  badge_icon text,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, badge_name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges own all" ON public.user_badges FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_badges_profile ON public.user_badges(profile_id, unlocked_at DESC);
CREATE TRIGGER trg_badges_updated BEFORE UPDATE ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 14. notifications ----------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  notification_type public.notification_type NOT NULL DEFAULT 'system',
  read boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif own all" ON public.notifications FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_notif_profile ON public.notifications(profile_id, read, created_at DESC);
CREATE TRIGGER trg_notif_updated BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 15. ai scan history ----------
CREATE TABLE public.ai_scan_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_log_id uuid REFERENCES public.food_logs(id) ON DELETE SET NULL,
  image_url text,
  ai_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  calories numeric(8,2) CHECK (calories IS NULL OR calories >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_scan_history TO authenticated;
GRANT ALL ON public.ai_scan_history TO service_role;
ALTER TABLE public.ai_scan_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan own all" ON public.ai_scan_history FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_scan_profile ON public.ai_scan_history(profile_id, created_at DESC);
CREATE TRIGGER trg_scan_updated BEFORE UPDATE ON public.ai_scan_history FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 16. user settings ----------
CREATE TABLE public.user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'light',
  language text NOT NULL DEFAULT 'th',
  notification_enabled boolean NOT NULL DEFAULT true,
  health_permission boolean NOT NULL DEFAULT false,
  privacy_level public.privacy_level NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings own all" ON public.user_settings FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_settings_profile ON public.user_settings(profile_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 17. app logs ----------
CREATE TABLE public.app_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  module text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_logs TO authenticated;
GRANT ALL ON public.app_logs TO service_role;
ALTER TABLE public.app_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "logs own read" ON public.app_logs FOR SELECT TO authenticated USING (profile_id = public.current_profile_id());
CREATE INDEX idx_app_logs_profile ON public.app_logs(profile_id, created_at DESC);
CREATE INDEX idx_app_logs_module ON public.app_logs(module, created_at DESC);
CREATE TRIGGER trg_logs_updated BEFORE UPDATE ON public.app_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- 18. file storage metadata ----------
CREATE TABLE public.file_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_name text NOT NULL,
  file_path text NOT NULL,
  mime_type text,
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket_name, file_path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.file_assets TO authenticated;
GRANT ALL ON public.file_assets TO service_role;
ALTER TABLE public.file_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files own all" ON public.file_assets FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id()) WITH CHECK (profile_id = public.current_profile_id());
CREATE INDEX idx_file_assets_profile ON public.file_assets(profile_id, created_at DESC);
CREATE TRIGGER trg_files_updated BEFORE UPDATE ON public.file_assets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------- signup trigger ----------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------- seed data ----------
INSERT INTO public.challenges (title, description, icon, start_date, end_date, reward_points) VALUES
  ('เดิน 10,000 ก้าว 7 วัน', 'เดินให้ครบ 10,000 ก้าวทุกวันติดต่อกัน 1 สัปดาห์', 'Footprints', CURRENT_DATE, CURRENT_DATE + 7, 300),
  ('ดื่มน้ำครบเป้า 5 วัน', 'ดื่มน้ำให้ถึงเป้าหมายรายวัน 5 วันในสัปดาห์นี้', 'GlassWater', CURRENT_DATE, CURRENT_DATE + 7, 200),
  ('เผาผลาญ 2,000 kcal', 'ออกกำลังกายสะสมให้เผาผลาญครบ 2,000 kcal', 'Flame', CURRENT_DATE, CURRENT_DATE + 14, 500);
-- ============ supabase/migrations/20260803104858_acf28ea6-2a08-47f1-95bd-8e2d058bf0a6.sql ============
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
-- ============ supabase/migrations/20260803115138_8bd814d8-b259-4adf-b4a0-df49f690f5a3.sql ============
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin, service_role;

REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO service_role;
-- ============ supabase/migrations/20260803150457_8720ad64-5dce-44dc-b755-549123dcb96e.sql ============
-- ACTIVITY TYPES
CREATE TABLE public.activity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  icon text NOT NULL DEFAULT 'dumbbell',
  met_value numeric NOT NULL,
  description text,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_types_met_range CHECK (met_value > 0 AND met_value <= 30),
  CONSTRAINT activity_types_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT activity_types_builtin_no_owner CHECK ((is_builtin AND profile_id IS NULL) OR (NOT is_builtin AND profile_id IS NOT NULL))
);
CREATE UNIQUE INDEX activity_types_owner_name_key ON public.activity_types (profile_id, lower(btrim(name))) WHERE profile_id IS NOT NULL;
CREATE UNIQUE INDEX activity_types_builtin_name_key ON public.activity_types (lower(btrim(name))) WHERE is_builtin;
CREATE INDEX activity_types_profile_idx ON public.activity_types (profile_id);
CREATE INDEX activity_types_category_idx ON public.activity_types (category);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_types TO authenticated;
GRANT ALL ON public.activity_types TO service_role;
ALTER TABLE public.activity_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read builtin or own activity types" ON public.activity_types
  FOR SELECT TO authenticated
  USING (is_builtin OR profile_id = public.current_profile_id());
CREATE POLICY "Insert own activity types" ON public.activity_types
  FOR INSERT TO authenticated
  WITH CHECK (NOT is_builtin AND profile_id = public.current_profile_id());
CREATE POLICY "Update own activity types" ON public.activity_types
  FOR UPDATE TO authenticated
  USING (NOT is_builtin AND profile_id = public.current_profile_id())
  WITH CHECK (NOT is_builtin AND profile_id = public.current_profile_id());
CREATE POLICY "Delete own activity types" ON public.activity_types
  FOR DELETE TO authenticated
  USING (NOT is_builtin AND profile_id = public.current_profile_id());

CREATE TRIGGER trg_activity_types_updated BEFORE UPDATE ON public.activity_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ACTIVITY LOGS
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_type_id uuid NOT NULL REFERENCES public.activity_types(id) ON DELETE RESTRICT,
  activity_name text NOT NULL,
  met_value numeric NOT NULL,
  weight_kg numeric NOT NULL,
  duration_minutes integer NOT NULL,
  calories numeric NOT NULL,
  notes text,
  performed_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT activity_logs_duration_positive CHECK (duration_minutes > 0 AND duration_minutes <= 1440)
);
CREATE INDEX activity_logs_profile_time_idx ON public.activity_logs (profile_id, performed_at DESC);
CREATE INDEX activity_logs_active_idx ON public.activity_logs (profile_id, performed_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX activity_logs_type_idx ON public.activity_logs (activity_type_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own activity logs" ON public.activity_logs
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

CREATE TRIGGER trg_activity_logs_updated BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- EXERCISE GOALS
CREATE TABLE public.exercise_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal_type text NOT NULL,
  target_value numeric NOT NULL,
  unit text NOT NULL,
  period text NOT NULL DEFAULT 'weekly',
  start_date date NOT NULL DEFAULT current_date,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exercise_goals_target_positive CHECK (target_value > 0),
  CONSTRAINT exercise_goals_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT exercise_goals_status_valid CHECK (status IN ('active','completed','archived')),
  CONSTRAINT exercise_goals_dates_valid CHECK (end_date >= start_date)
);
CREATE INDEX exercise_goals_profile_idx ON public.exercise_goals (profile_id, status, end_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_goals TO authenticated;
GRANT ALL ON public.exercise_goals TO service_role;
ALTER TABLE public.exercise_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own exercise goals" ON public.exercise_goals
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

CREATE TRIGGER trg_exercise_goals_updated BEFORE UPDATE ON public.exercise_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- GOAL PROGRESS
CREATE TABLE public.goal_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.exercise_goals(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_date date NOT NULL DEFAULT current_date,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, progress_date)
);
CREATE INDEX goal_progress_profile_idx ON public.goal_progress (profile_id, progress_date DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.goal_progress TO authenticated;
GRANT ALL ON public.goal_progress TO service_role;
ALTER TABLE public.goal_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own goal progress" ON public.goal_progress
  FOR ALL TO authenticated
  USING (profile_id = public.current_profile_id())
  WITH CHECK (profile_id = public.current_profile_id());

CREATE TRIGGER trg_goal_progress_updated BEFORE UPDATE ON public.goal_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_types;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.exercise_goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goal_progress;

-- BUILT-IN ACTIVITY SEED
INSERT INTO public.activity_types (name, category, icon, met_value, is_builtin, description) VALUES
  ('เดิน', 'cardio', 'footprints', 3.0, true, 'เดินความเร็วปกติ'),
  ('เดินเร็ว', 'cardio', 'footprints', 4.3, true, 'เดินเร็วประมาณ 6 กม./ชม.'),
  ('วิ่ง', 'cardio', 'zap', 9.8, true, 'วิ่งประมาณ 10 กม./ชม.'),
  ('จ๊อกกิ้ง', 'cardio', 'zap', 7.0, true, 'วิ่งเหยาะ ๆ'),
  ('ปั่นจักรยาน', 'cardio', 'bike', 7.5, true, 'ปั่นจักรยานทั่วไป'),
  ('ปั่นจักรยานเสือภูเขา', 'cardio', 'mountain', 8.5, true, 'ปั่นทางขึ้นเขา'),
  ('ว่ายน้ำ', 'cardio', 'waves', 8.0, true, 'ว่ายน้ำฟรีสไตล์'),
  ('โยคะ', 'flexibility', 'flower-2', 2.5, true, 'โยคะแบบทั่วไป'),
  ('พิลาทิส', 'flexibility', 'flower-2', 3.0, true, 'พิลาทิสระดับกลาง'),
  ('เวทเทรนนิ่ง', 'strength', 'dumbbell', 6.0, true, 'ยกน้ำหนักระดับกลาง'),
  ('HIIT', 'cardio', 'flame', 10.0, true, 'คาร์ดิโอความเข้มข้นสูงสลับพัก'),
  ('แอโรบิก', 'cardio', 'activity', 7.3, true, 'แอโรบิกแรงกระแทกสูง'),
  ('เต้น', 'cardio', 'music', 5.0, true, 'เต้นทั่วไป'),
  ('กระโดดเชือก', 'cardio', 'flame', 11.0, true, 'กระโดดเชือกความเร็วปกติ'),
  ('เดินป่า', 'cardio', 'mountain', 6.0, true, 'เดินป่า/เทรล'),
  ('แบดมินตัน', 'sport', 'target', 5.5, true, 'แบดมินตันทั่วไป'),
  ('เทนนิส', 'sport', 'target', 7.3, true, 'เทนนิสเดี่ยว'),
  ('เทเบิลเทนนิส', 'sport', 'target', 4.0, true, 'ปิงปอง'),
  ('บาสเกตบอล', 'sport', 'target', 6.5, true, 'บาสเกตบอลทั่วไป'),
  ('ฟุตบอล', 'sport', 'target', 7.0, true, 'ฟุตบอลทั่วไป'),
  ('วอลเลย์บอล', 'sport', 'target', 4.0, true, 'วอลเลย์บอลทั่วไป'),
  ('พายเรือ', 'cardio', 'waves', 7.0, true, 'เครื่องพายเรือระดับกลาง'),
  ('เครื่องเดินวงรี', 'cardio', 'activity', 5.0, true, 'Elliptical ระดับกลาง'),
  ('เดินขึ้นบันได', 'cardio', 'trending-up', 8.8, true, 'ขึ้นบันไดต่อเนื่อง'),
  ('ยืดเหยียด', 'flexibility', 'flower-2', 2.3, true, 'ยืดกล้ามเนื้อ');
-- ============ supabase/migrations/20260803155320_716d0a70-563a-489f-9032-af8379498043.sql ============
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC,
  ADD COLUMN IF NOT EXISTS distance_source TEXT,
  ADD COLUMN IF NOT EXISTS distance_synced BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_distance_source_check'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_distance_source_check
      CHECK (distance_source IS NULL OR distance_source IN ('health_connect','apple_health','smartwatch','manual','unknown'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'activity_logs_distance_km_check'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_distance_km_check
      CHECK (distance_km IS NULL OR (distance_km > 0 AND distance_km <= 999));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS activity_logs_distance_idx
  ON public.activity_logs (profile_id, performed_at)
  WHERE distance_km IS NOT NULL;
