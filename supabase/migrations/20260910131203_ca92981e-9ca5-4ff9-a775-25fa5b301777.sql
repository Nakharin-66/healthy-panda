-- 1. friend_code -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_friend_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := 'HP-';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = candidate);
  END LOOP;
  RETURN candidate;
END;
$$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS friend_code text;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE friend_code IS NULL LOOP
    UPDATE public.profiles SET friend_code = public.generate_friend_code() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles ALTER COLUMN friend_code SET DEFAULT public.generate_friend_code();
ALTER TABLE public.profiles ALTER COLUMN friend_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_friend_code_key ON public.profiles (friend_code);

CREATE OR REPLACE FUNCTION public.regenerate_friend_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := public.current_profile_id();
  code text;
BEGIN
  IF pid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  code := public.generate_friend_code();
  UPDATE public.profiles SET friend_code = code WHERE id = pid;
  RETURN code;
END;
$$;

-- 2. friend_requests ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friend_requests_not_self CHECK (sender_profile_id <> receiver_profile_id),
  CONSTRAINT friend_requests_status_valid CHECK (status IN ('pending','accepted','rejected','cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_unique
  ON public.friend_requests (sender_profile_id, receiver_profile_id)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS friend_requests_receiver_idx ON public.friend_requests (receiver_profile_id, status);
CREATE INDEX IF NOT EXISTS friend_requests_sender_idx ON public.friend_requests (sender_profile_id, status);

GRANT SELECT, INSERT, UPDATE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own requests readable" ON public.friend_requests
  FOR SELECT TO authenticated
  USING (sender_profile_id = public.current_profile_id() OR receiver_profile_id = public.current_profile_id());

CREATE POLICY "send own requests" ON public.friend_requests
  FOR INSERT TO authenticated
  WITH CHECK (sender_profile_id = public.current_profile_id());

CREATE POLICY "update involved requests" ON public.friend_requests
  FOR UPDATE TO authenticated
  USING (sender_profile_id = public.current_profile_id() OR receiver_profile_id = public.current_profile_id())
  WITH CHECK (sender_profile_id = public.current_profile_id() OR receiver_profile_id = public.current_profile_id());

CREATE TRIGGER trg_friend_requests_updated BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. friendships -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (profile_id <> friend_profile_id),
  CONSTRAINT friendships_unique_pair UNIQUE (profile_id, friend_profile_id)
);

CREATE INDEX IF NOT EXISTS friendships_profile_idx ON public.friendships (profile_id);

GRANT SELECT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own friendships readable" ON public.friendships
  FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id() OR friend_profile_id = public.current_profile_id());

CREATE POLICY "own friendships removable" ON public.friendships
  FOR DELETE TO authenticated
  USING (profile_id = public.current_profile_id() OR friend_profile_id = public.current_profile_id());

CREATE TRIGGER trg_friendships_updated BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_friend_limit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (SELECT count(*) FROM public.friendships WHERE profile_id = NEW.profile_id) >= 50 THEN
    RAISE EXCEPTION 'friend_limit_reached';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_friendships_limit BEFORE INSERT ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.enforce_friend_limit();

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.friendships WHERE profile_id = _a AND friend_profile_id = _b)
$$;

-- 4. challenges metadata -----------------------------------------------------
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS metric text NOT NULL DEFAULT 'active_days';
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS target_value numeric NOT NULL DEFAULT 0;
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT '';
ALTER TABLE public.challenges DROP CONSTRAINT IF EXISTS challenges_metric_valid;
ALTER TABLE public.challenges ADD CONSTRAINT challenges_metric_valid
  CHECK (metric IN ('steps','water_ml','calories_burned','active_days','exercise_minutes'));

-- 5. friend operations -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.friend_summary()
RETURNS TABLE (friend_count int, pending_incoming int, pending_outgoing int)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::int FROM public.friendships WHERE profile_id = public.current_profile_id()),
    (SELECT count(*)::int FROM public.friend_requests WHERE receiver_profile_id = public.current_profile_id() AND status = 'pending'),
    (SELECT count(*)::int FROM public.friend_requests WHERE sender_profile_id = public.current_profile_id() AND status = 'pending')
$$;

CREATE OR REPLACE FUNCTION public.lookup_friend_code(_code text)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  picture_url text,
  friend_code text,
  privacy_level privacy_level,
  is_self boolean,
  is_friend boolean,
  request_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := public.current_profile_id();
  target public.profiles;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO target FROM public.profiles p WHERE upper(p.friend_code) = upper(trim(_code));
  IF target.id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT
    target.id,
    target.display_name,
    target.picture_url,
    target.friend_code,
    COALESCE((SELECT s.privacy_level FROM public.user_settings s WHERE s.profile_id = target.id), 'private'::privacy_level),
    target.id = me,
    EXISTS (SELECT 1 FROM public.friendships f WHERE f.profile_id = me AND f.friend_profile_id = target.id),
    (SELECT r.status FROM public.friend_requests r
      WHERE r.status = 'pending'
        AND ((r.sender_profile_id = me AND r.receiver_profile_id = target.id)
          OR (r.sender_profile_id = target.id AND r.receiver_profile_id = me))
      LIMIT 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := public.current_profile_id();
  target uuid;
  my_name text;
  new_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.profiles WHERE upper(friend_code) = upper(trim(_code));
  IF target IS NULL THEN RAISE EXCEPTION 'code_not_found'; END IF;
  IF target = me THEN RAISE EXCEPTION 'cannot_add_self'; END IF;
  IF EXISTS (SELECT 1 FROM public.friendships WHERE profile_id = me AND friend_profile_id = target) THEN
    RAISE EXCEPTION 'already_friends';
  END IF;
  IF EXISTS (SELECT 1 FROM public.friend_requests WHERE status = 'pending'
      AND ((sender_profile_id = me AND receiver_profile_id = target)
        OR (sender_profile_id = target AND receiver_profile_id = me))) THEN
    RAISE EXCEPTION 'request_exists';
  END IF;
  IF (SELECT count(*) FROM public.friendships WHERE profile_id = me) >= 50 THEN
    RAISE EXCEPTION 'friend_limit_reached';
  END IF;

  INSERT INTO public.friend_requests (sender_profile_id, receiver_profile_id)
  VALUES (me, target) RETURNING id INTO new_id;

  SELECT display_name INTO my_name FROM public.profiles WHERE id = me;
  INSERT INTO public.notifications (profile_id, title, body, notification_type)
  VALUES (target, 'คำขอเป็นเพื่อนใหม่', my_name || ' ส่งคำขอเป็นเพื่อนถึงคุณ', 'system');

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_request_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := public.current_profile_id();
  req public.friend_requests;
  my_name text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO req FROM public.friend_requests WHERE id = _request_id AND status = 'pending';
  IF req.id IS NULL THEN RAISE EXCEPTION 'request_not_found'; END IF;

  IF _action = 'cancel' THEN
    IF req.sender_profile_id <> me THEN RAISE EXCEPTION 'not_allowed'; END IF;
    UPDATE public.friend_requests SET status = 'cancelled' WHERE id = req.id;
    RETURN;
  END IF;

  IF req.receiver_profile_id <> me THEN RAISE EXCEPTION 'not_allowed'; END IF;

  IF _action = 'reject' THEN
    UPDATE public.friend_requests SET status = 'rejected' WHERE id = req.id;
    RETURN;
  END IF;

  IF _action <> 'accept' THEN RAISE EXCEPTION 'invalid_action'; END IF;

  IF (SELECT count(*) FROM public.friendships WHERE profile_id = me) >= 50
     OR (SELECT count(*) FROM public.friendships WHERE profile_id = req.sender_profile_id) >= 50 THEN
    RAISE EXCEPTION 'friend_limit_reached';
  END IF;

  INSERT INTO public.friendships (profile_id, friend_profile_id)
  VALUES (me, req.sender_profile_id) ON CONFLICT DO NOTHING;
  INSERT INTO public.friendships (profile_id, friend_profile_id)
  VALUES (req.sender_profile_id, me) ON CONFLICT DO NOTHING;

  UPDATE public.friend_requests SET status = 'accepted' WHERE id = req.id;

  SELECT display_name INTO my_name FROM public.profiles WHERE id = me;
  INSERT INTO public.notifications (profile_id, title, body, notification_type)
  VALUES (req.sender_profile_id, 'คำขอเป็นเพื่อนได้รับการยอมรับ',
          my_name || ' ยอมรับคำขอเป็นเพื่อนของคุณแล้ว', 'system');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(_friend_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := public.current_profile_id();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.friendships
   WHERE (profile_id = me AND friend_profile_id = _friend_profile_id)
      OR (profile_id = _friend_profile_id AND friend_profile_id = me);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  picture_url text,
  friend_code text,
  privacy_level privacy_level,
  since timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.picture_url, p.friend_code,
         COALESCE(s.privacy_level, 'private'::privacy_level), f.created_at
    FROM public.friendships f
    JOIN public.profiles p ON p.id = f.friend_profile_id
    LEFT JOIN public.user_settings s ON s.profile_id = p.id
   WHERE f.profile_id = public.current_profile_id()
   ORDER BY p.display_name
$$;

CREATE OR REPLACE FUNCTION public.list_friend_requests()
RETURNS TABLE (
  id uuid,
  direction text,
  profile_id uuid,
  display_name text,
  picture_url text,
  friend_code text,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id,
         CASE WHEN r.sender_profile_id = public.current_profile_id() THEN 'outgoing' ELSE 'incoming' END,
         p.id, p.display_name, p.picture_url, p.friend_code, r.created_at
    FROM public.friend_requests r
    JOIN public.profiles p ON p.id = CASE WHEN r.sender_profile_id = public.current_profile_id()
                                          THEN r.receiver_profile_id ELSE r.sender_profile_id END
   WHERE r.status = 'pending'
     AND (r.sender_profile_id = public.current_profile_id() OR r.receiver_profile_id = public.current_profile_id())
   ORDER BY r.created_at DESC
$$;

-- 6. challenge progress ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_challenge_progress(_profile_id uuid, _challenge_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.challenges;
  starts timestamptz;
  ends timestamptz;
  result numeric := 0;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RETURN 0; END IF;
  starts := c.start_date::timestamptz;
  ends := (c.end_date + 1)::timestamptz;

  IF c.metric = 'steps' THEN
    SELECT COALESCE(sum(steps), 0) INTO result FROM public.daily_statistics
     WHERE profile_id = _profile_id AND stat_date BETWEEN c.start_date AND c.end_date;
  ELSIF c.metric = 'water_ml' THEN
    SELECT COALESCE(sum(amount_ml), 0) INTO result FROM public.water_logs
     WHERE profile_id = _profile_id AND recorded_at >= starts AND recorded_at < ends;
  ELSIF c.metric = 'calories_burned' THEN
    SELECT COALESCE((SELECT sum(calories) FROM public.activity_logs
                      WHERE profile_id = _profile_id AND deleted_at IS NULL
                        AND performed_at >= starts AND performed_at < ends), 0)
         + COALESCE((SELECT sum(calories) FROM public.exercise_logs
                      WHERE profile_id = _profile_id
                        AND recorded_at >= starts AND recorded_at < ends), 0)
      INTO result;
  ELSIF c.metric = 'exercise_minutes' THEN
    SELECT COALESCE((SELECT sum(duration_minutes) FROM public.activity_logs
                      WHERE profile_id = _profile_id AND deleted_at IS NULL
                        AND performed_at >= starts AND performed_at < ends), 0)
         + COALESCE((SELECT sum(duration_minutes) FROM public.exercise_logs
                      WHERE profile_id = _profile_id
                        AND recorded_at >= starts AND recorded_at < ends), 0)
      INTO result;
  ELSE
    SELECT count(DISTINCT d) INTO result FROM (
      SELECT date(performed_at) AS d FROM public.activity_logs
        WHERE profile_id = _profile_id AND deleted_at IS NULL
          AND performed_at >= starts AND performed_at < ends
      UNION
      SELECT date(recorded_at) AS d FROM public.exercise_logs
        WHERE profile_id = _profile_id AND recorded_at >= starts AND recorded_at < ends
    ) src;
  END IF;

  RETURN COALESCE(result, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_challenge_progress()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := public.current_profile_id();
  r record;
  value numeric;
  target numeric;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  FOR r IN
    SELECT cp.id, cp.challenge_id, c.target_value
      FROM public.challenge_participants cp
      JOIN public.challenges c ON c.id = cp.challenge_id
     WHERE cp.profile_id = me
  LOOP
    value := public.compute_challenge_progress(me, r.challenge_id);
    target := NULLIF(r.target_value, 0);
    UPDATE public.challenge_participants
       SET progress = value,
           completed = (target IS NOT NULL AND value >= target),
           completed_at = CASE WHEN target IS NOT NULL AND value >= target
                               THEN COALESCE(completed_at, now()) ELSE NULL END
     WHERE id = r.id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_challenge(_challenge_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE me uuid := public.current_profile_id();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress)
  VALUES (_challenge_id, me, public.compute_challenge_progress(me, _challenge_id))
  ON CONFLICT (challenge_id, profile_id) DO NOTHING;
END;
$$;

-- 7. leaderboard -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_challenge_id uuid, _friends_only boolean DEFAULT false)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  picture_url text,
  progress numeric,
  completed boolean,
  is_self boolean,
  is_friend boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT p.id, p.display_name, p.picture_url, cp.progress, cp.completed,
         p.id = (SELECT id FROM me),
         EXISTS (SELECT 1 FROM public.friendships f
                  WHERE f.profile_id = (SELECT id FROM me) AND f.friend_profile_id = p.id)
    FROM public.challenge_participants cp
    JOIN public.profiles p ON p.id = cp.profile_id
    LEFT JOIN public.user_settings s ON s.profile_id = p.id
   WHERE cp.challenge_id = _challenge_id
     AND (SELECT id FROM me) IS NOT NULL
     AND (
       p.id = (SELECT id FROM me)
       OR (
         (NOT _friends_only OR EXISTS (SELECT 1 FROM public.friendships f
              WHERE f.profile_id = (SELECT id FROM me) AND f.friend_profile_id = p.id))
         AND (
           COALESCE(s.privacy_level, 'private'::privacy_level) = 'public'::privacy_level
           OR (COALESCE(s.privacy_level, 'private'::privacy_level) = 'friends'::privacy_level
               AND EXISTS (SELECT 1 FROM public.friendships f
                    WHERE f.profile_id = (SELECT id FROM me) AND f.friend_profile_id = p.id))
         )
       )
     )
   ORDER BY cp.progress DESC, p.display_name
$$;

CREATE OR REPLACE FUNCTION public.friend_public_profile(_profile_id uuid)
RETURNS TABLE (
  profile_id uuid,
  display_name text,
  picture_url text,
  friend_code text,
  privacy_level privacy_level,
  visible boolean,
  streak_days int,
  activity_count int,
  challenge_count int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.current_profile_id() AS id),
  vis AS (
    SELECT p.id,
      COALESCE(s.privacy_level, 'private'::privacy_level) AS lvl,
      (COALESCE(s.privacy_level, 'private'::privacy_level) = 'public'::privacy_level
       OR (COALESCE(s.privacy_level, 'private'::privacy_level) = 'friends'::privacy_level
           AND EXISTS (SELECT 1 FROM public.friendships f
                WHERE f.profile_id = (SELECT id FROM me) AND f.friend_profile_id = p.id))) AS ok
      FROM public.profiles p LEFT JOIN public.user_settings s ON s.profile_id = p.id
     WHERE p.id = _profile_id
  )
  SELECT p.id, p.display_name, p.picture_url, p.friend_code, vis.lvl, vis.ok,
    CASE WHEN vis.ok THEN p.streak_days END,
    CASE WHEN vis.ok THEN (SELECT count(*)::int FROM public.activity_logs a
        WHERE a.profile_id = p.id AND a.deleted_at IS NULL
          AND a.performed_at >= now() - interval '7 days') END,
    CASE WHEN vis.ok THEN (SELECT count(*)::int FROM public.challenge_participants cp
        WHERE cp.profile_id = p.id) END
    FROM public.profiles p JOIN vis ON vis.id = p.id
   WHERE EXISTS (SELECT 1 FROM public.friendships f
                  WHERE f.profile_id = (SELECT id FROM me) AND f.friend_profile_id = p.id)
$$;

REVOKE EXECUTE ON FUNCTION public.generate_friend_code() FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.compute_challenge_progress(uuid, uuid) FROM anon;

-- 8. realtime ----------------------------------------------------------------
ALTER TABLE public.challenge_participants REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_participants; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
