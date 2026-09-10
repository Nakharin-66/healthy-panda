-- ============ enums ============
DO $$ BEGIN
  CREATE TYPE public.challenge_category AS ENUM ('movement','exercise','water','wellness','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.challenge_goal_mode AS ENUM ('daily','cumulative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.challenge_participation AS ENUM ('everyone','friends','invite_only');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.challenge_board_visibility AS ENUM ('everyone','friends','participants');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.challenge_invite_status AS ENUM ('pending','accepted','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ challenge code generator ============
CREATE OR REPLACE FUNCTION public.generate_challenge_code()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  candidate text; i int;
BEGIN
  LOOP
    candidate := 'CH-';
    FOR i IN 1..5 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_code = candidate);
  END LOOP;
  RETURN candidate;
END; $$;

-- ============ challenges columns ============
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS challenge_code text,
  ADD COLUMN IF NOT EXISTS category public.challenge_category NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS goal_mode public.challenge_goal_mode NOT NULL DEFAULT 'cumulative',
  ADD COLUMN IF NOT EXISTS participation_visibility public.challenge_participation NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS leaderboard_visibility public.challenge_board_visibility NOT NULL DEFAULT 'everyone';

UPDATE public.challenges SET challenge_code = public.generate_challenge_code() WHERE challenge_code IS NULL;
ALTER TABLE public.challenges ALTER COLUMN challenge_code SET NOT NULL;
ALTER TABLE public.challenges ALTER COLUMN challenge_code SET DEFAULT public.generate_challenge_code();
CREATE UNIQUE INDEX IF NOT EXISTS challenges_challenge_code_key ON public.challenges(challenge_code);
CREATE INDEX IF NOT EXISTS challenges_owner_idx ON public.challenges(owner_profile_id, created_at DESC);

-- ============ invites ============
CREATE TABLE IF NOT EXISTS public.challenge_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  inviter_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.challenge_invite_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_invites_not_self CHECK (inviter_profile_id <> invitee_profile_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS challenge_invites_unique ON public.challenge_invites(challenge_id, invitee_profile_id);
CREATE INDEX IF NOT EXISTS challenge_invites_invitee_idx ON public.challenge_invites(invitee_profile_id, status);

GRANT SELECT ON public.challenge_invites TO authenticated;
GRANT ALL ON public.challenge_invites TO service_role;
ALTER TABLE public.challenge_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invites visible to both sides" ON public.challenge_invites;
CREATE POLICY "invites visible to both sides" ON public.challenge_invites
  FOR SELECT TO authenticated
  USING (inviter_profile_id = public.current_profile_id() OR invitee_profile_id = public.current_profile_id());

DROP TRIGGER IF EXISTS set_challenge_invites_updated_at ON public.challenge_invites;
CREATE TRIGGER set_challenge_invites_updated_at BEFORE UPDATE ON public.challenge_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ access helper ============
CREATE OR REPLACE FUNCTION public.can_view_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
     WHERE c.id = _challenge_id
       AND (
         c.owner_profile_id IS NULL
         OR c.owner_profile_id = (SELECT id FROM me)
         OR c.participation_visibility = 'everyone'
         OR (c.participation_visibility = 'friends'
             AND public.are_friends((SELECT id FROM me), c.owner_profile_id))
         OR EXISTS (SELECT 1 FROM public.challenge_invites i
                     WHERE i.challenge_id = c.id AND i.invitee_profile_id = (SELECT id FROM me)
                       AND i.status IN ('pending','accepted'))
         OR EXISTS (SELECT 1 FROM public.challenge_participants cp
                     WHERE cp.challenge_id = c.id AND cp.profile_id = (SELECT id FROM me))
       )
  )
$$;
REVOKE ALL ON FUNCTION public.can_view_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_challenge(uuid) TO authenticated;

-- ============ challenges RLS ============
DROP POLICY IF EXISTS "challenges public read" ON public.challenges;
DROP POLICY IF EXISTS "challenges readable" ON public.challenges;
CREATE POLICY "challenges readable" ON public.challenges
  FOR SELECT TO authenticated USING (public.can_view_challenge(id));
DROP POLICY IF EXISTS "challenges anon read system" ON public.challenges;
CREATE POLICY "challenges anon read system" ON public.challenges
  FOR SELECT TO anon USING (owner_profile_id IS NULL AND is_active);
DROP POLICY IF EXISTS "owner updates own challenge" ON public.challenges;
CREATE POLICY "owner updates own challenge" ON public.challenges
  FOR UPDATE TO authenticated
  USING (owner_profile_id IS NOT NULL AND owner_profile_id = public.current_profile_id())
  WITH CHECK (owner_profile_id = public.current_profile_id());
DROP POLICY IF EXISTS "owner deletes own challenge" ON public.challenges;
CREATE POLICY "owner deletes own challenge" ON public.challenges
  FOR DELETE TO authenticated
  USING (owner_profile_id IS NOT NULL AND owner_profile_id = public.current_profile_id());

GRANT SELECT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;

-- participants: keep own-row policy, ensure reads of others go through leaderboard function only
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_participants TO authenticated;
GRANT ALL ON public.challenge_participants TO service_role;

-- ============ per-day metric series ============
CREATE OR REPLACE FUNCTION public.challenge_metric_daily(_profile_id uuid, _metric text, _from date, _to date)
RETURNS TABLE(d date, v numeric) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d, v FROM (
    SELECT stat_date AS d, COALESCE(steps,0)::numeric AS v
      FROM public.daily_statistics
     WHERE _metric = 'steps' AND profile_id = _profile_id AND stat_date BETWEEN _from AND _to
    UNION ALL
    SELECT date(recorded_at), sum(amount_ml)::numeric
      FROM public.water_logs
     WHERE _metric = 'water_ml' AND profile_id = _profile_id
       AND recorded_at >= _from::timestamptz AND recorded_at < (_to + 1)::timestamptz
     GROUP BY 1
    UNION ALL
    SELECT date(performed_at), sum(COALESCE(distance_km,0))::numeric
      FROM public.activity_logs
     WHERE _metric = 'distance_km' AND profile_id = _profile_id AND deleted_at IS NULL
       AND performed_at >= _from::timestamptz AND performed_at < (_to + 1)::timestamptz
     GROUP BY 1
    UNION ALL
    SELECT d, sum(v) FROM (
      SELECT date(performed_at) AS d, sum(calories)::numeric AS v FROM public.activity_logs
       WHERE _metric = 'calories_burned' AND profile_id = _profile_id AND deleted_at IS NULL
         AND performed_at >= _from::timestamptz AND performed_at < (_to + 1)::timestamptz
       GROUP BY 1
      UNION ALL
      SELECT date(recorded_at), sum(calories)::numeric FROM public.exercise_logs
       WHERE _metric = 'calories_burned' AND profile_id = _profile_id
         AND recorded_at >= _from::timestamptz AND recorded_at < (_to + 1)::timestamptz
       GROUP BY 1
    ) cal GROUP BY d
    UNION ALL
    SELECT d, sum(v) FROM (
      SELECT date(performed_at) AS d, sum(duration_minutes)::numeric AS v FROM public.activity_logs
       WHERE _metric IN ('active_minutes','exercise_minutes') AND profile_id = _profile_id AND deleted_at IS NULL
         AND performed_at >= _from::timestamptz AND performed_at < (_to + 1)::timestamptz
       GROUP BY 1
      UNION ALL
      SELECT date(recorded_at), sum(duration_minutes)::numeric FROM public.exercise_logs
       WHERE _metric IN ('active_minutes','exercise_minutes') AND profile_id = _profile_id
         AND recorded_at >= _from::timestamptz AND recorded_at < (_to + 1)::timestamptz
       GROUP BY 1
    ) mins GROUP BY d
    UNION ALL
    SELECT d, 1::numeric FROM (
      SELECT DISTINCT date(performed_at) AS d FROM public.activity_logs
       WHERE _metric IN ('activity_days','active_days') AND profile_id = _profile_id AND deleted_at IS NULL
         AND performed_at >= _from::timestamptz AND performed_at < (_to + 1)::timestamptz
      UNION
      SELECT DISTINCT date(recorded_at) FROM public.exercise_logs
       WHERE _metric IN ('activity_days','active_days') AND profile_id = _profile_id
         AND recorded_at >= _from::timestamptz AND recorded_at < (_to + 1)::timestamptz
    ) days
  ) src
$$;
REVOKE ALL ON FUNCTION public.challenge_metric_daily(uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_metric_daily(uuid, text, date, date) TO authenticated;

-- ============ progress ============
CREATE OR REPLACE FUNCTION public.compute_challenge_progress(_profile_id uuid, _challenge_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.challenges;
  result numeric := 0;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RETURN 0; END IF;

  IF c.goal_mode = 'daily' AND c.metric NOT IN ('activity_days','active_days') THEN
    SELECT count(*) INTO result
      FROM public.challenge_metric_daily(_profile_id, c.metric, c.start_date, c.end_date) s
     WHERE s.v >= NULLIF(c.target_value, 0);
  ELSE
    SELECT COALESCE(sum(s.v), 0) INTO result
      FROM public.challenge_metric_daily(_profile_id, c.metric, c.start_date, c.end_date) s;
  END IF;

  RETURN COALESCE(result, 0);
END; $$;
REVOKE ALL ON FUNCTION public.compute_challenge_progress(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_challenge_progress(uuid, uuid) TO authenticated;

-- ============ create challenge ============
CREATE OR REPLACE FUNCTION public.create_challenge(
  _title text, _description text, _category public.challenge_category, _metric text,
  _target_value numeric, _goal_mode public.challenge_goal_mode,
  _start_date date, _end_date date,
  _participation public.challenge_participation, _board public.challenge_board_visibility,
  _icon text DEFAULT NULL
) RETURNS public.challenges LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.current_profile_id();
  days int;
  points int;
  row public.challenges;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(btrim(_title), '') = '' THEN RAISE EXCEPTION 'title_required'; END IF;
  IF _metric NOT IN ('steps','distance_km','active_minutes','calories_burned','water_ml','activity_days')
    THEN RAISE EXCEPTION 'invalid_metric'; END IF;
  IF _target_value IS NULL OR _target_value <= 0 THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'invalid_date_range'; END IF;
  IF _end_date - _start_date > 365 THEN RAISE EXCEPTION 'range_too_long'; END IF;

  days := (_end_date - _start_date) + 1;
  points := least(1000, greatest(10, days * 10 + CASE WHEN _goal_mode = 'daily' THEN 50 ELSE 0 END));

  INSERT INTO public.challenges (
    owner_profile_id, title, description, icon, category, metric, target_value,
    unit, goal_mode, start_date, end_date, reward_points, is_active,
    participation_visibility, leaderboard_visibility
  ) VALUES (
    me, btrim(_title), nullif(btrim(coalesce(_description,'')), ''), _icon, _category, _metric, _target_value,
    CASE _metric WHEN 'steps' THEN 'ก้าว' WHEN 'distance_km' THEN 'กม.'
                 WHEN 'active_minutes' THEN 'นาที' WHEN 'calories_burned' THEN 'kcal'
                 WHEN 'water_ml' THEN 'มล.' ELSE 'วัน' END,
    _goal_mode, _start_date, _end_date, points, true, _participation, _board
  ) RETURNING * INTO row;

  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress)
  VALUES (row.id, me, public.compute_challenge_progress(me, row.id))
  ON CONFLICT (challenge_id, profile_id) DO NOTHING;

  RETURN row;
END; $$;
REVOKE ALL ON FUNCTION public.create_challenge(text, text, public.challenge_category, text, numeric, public.challenge_goal_mode, date, date, public.challenge_participation, public.challenge_board_visibility, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_challenge(text, text, public.challenge_category, text, numeric, public.challenge_goal_mode, date, date, public.challenge_participation, public.challenge_board_visibility, text) TO authenticated;

-- ============ join with participation rules ============
CREATE OR REPLACE FUNCTION public.join_challenge(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.current_profile_id();
  c public.challenges;
  allowed boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF NOT c.is_active THEN RAISE EXCEPTION 'challenge_closed'; END IF;
  IF c.end_date < current_date THEN RAISE EXCEPTION 'challenge_expired'; END IF;

  IF c.owner_profile_id IS NULL OR c.owner_profile_id = me OR c.participation_visibility = 'everyone' THEN
    allowed := true;
  ELSIF c.participation_visibility = 'friends' THEN
    allowed := public.are_friends(me, c.owner_profile_id);
  ELSE
    allowed := EXISTS (SELECT 1 FROM public.challenge_invites i
                        WHERE i.challenge_id = c.id AND i.invitee_profile_id = me
                          AND i.status IN ('pending','accepted'));
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'join_not_allowed'; END IF;

  IF EXISTS (SELECT 1 FROM public.challenge_participants WHERE challenge_id = c.id AND profile_id = me) THEN
    RAISE EXCEPTION 'already_joined';
  END IF;

  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress)
  VALUES (c.id, me, public.compute_challenge_progress(me, c.id));

  UPDATE public.challenge_invites SET status = 'accepted'
   WHERE challenge_id = c.id AND invitee_profile_id = me AND status = 'pending';
END; $$;
REVOKE ALL ON FUNCTION public.join_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_challenge(uuid) TO authenticated;

-- ============ leave challenge ============
CREATE OR REPLACE FUNCTION public.leave_challenge(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := public.current_profile_id();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  DELETE FROM public.challenge_participants WHERE challenge_id = _challenge_id AND profile_id = me;
END; $$;
REVOKE ALL ON FUNCTION public.leave_challenge(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_challenge(uuid) TO authenticated;

-- ============ visible challenge list ============
DO $$ BEGIN
  CREATE TYPE public.challenge_view AS (
    id uuid, title text, description text, icon text, challenge_code text,
    category public.challenge_category, metric text, target_value numeric, unit text,
    goal_mode public.challenge_goal_mode, start_date date, end_date date,
    reward_points int, participation_visibility public.challenge_participation,
    leaderboard_visibility public.challenge_board_visibility,
    owner_profile_id uuid, owner_name text, owner_picture text, is_owner boolean,
    participant_count int, joined boolean, my_progress numeric, my_completed boolean,
    invited boolean
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.list_visible_challenges()
RETURNS SETOF public.challenge_view
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT c.id, c.title, c.description, c.icon, c.challenge_code, c.category, c.metric,
         c.target_value, c.unit, c.goal_mode, c.start_date, c.end_date, c.reward_points,
         c.participation_visibility, c.leaderboard_visibility,
         c.owner_profile_id, o.display_name, o.picture_url,
         c.owner_profile_id IS NOT NULL AND c.owner_profile_id = (SELECT id FROM me),
         (SELECT count(*)::int FROM public.challenge_participants cp WHERE cp.challenge_id = c.id),
         mine.profile_id IS NOT NULL, COALESCE(mine.progress, 0), COALESCE(mine.completed, false),
         EXISTS (SELECT 1 FROM public.challenge_invites i
                  WHERE i.challenge_id = c.id AND i.invitee_profile_id = (SELECT id FROM me)
                    AND i.status = 'pending')
    FROM public.challenges c
    LEFT JOIN public.profiles o ON o.id = c.owner_profile_id
    LEFT JOIN public.challenge_participants mine
           ON mine.challenge_id = c.id AND mine.profile_id = (SELECT id FROM me)
   WHERE (SELECT id FROM me) IS NOT NULL
     AND c.is_active
     AND public.can_view_challenge(c.id)
   ORDER BY (mine.profile_id IS NOT NULL) DESC, c.end_date
$$;
REVOKE ALL ON FUNCTION public.list_visible_challenges() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_visible_challenges() TO authenticated;

CREATE OR REPLACE FUNCTION public.challenge_detail(_challenge_id uuid)
RETURNS SETOF public.challenge_view LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM public.list_visible_challenges() WHERE id = _challenge_id
$$;
REVOKE ALL ON FUNCTION public.challenge_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_detail(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_challenge_code(_code text)
RETURNS SETOF public.challenge_view LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE target uuid;
BEGIN
  IF public.current_profile_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.challenges WHERE upper(btrim(challenge_code)) = upper(btrim(_code));
  IF target IS NULL THEN RAISE EXCEPTION 'challenge_code_not_found'; END IF;
  IF NOT public.can_view_challenge(target) THEN RAISE EXCEPTION 'challenge_not_accessible'; END IF;
  RETURN QUERY SELECT * FROM public.challenge_detail(target);
END; $$;
REVOKE ALL ON FUNCTION public.lookup_challenge_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lookup_challenge_code(text) TO authenticated;

-- ============ invites ============
CREATE OR REPLACE FUNCTION public.invite_friend_to_challenge(_challenge_id uuid, _friend_profile_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.current_profile_id();
  c public.challenges;
  invite_id uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF c.owner_profile_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'not_challenge_owner'; END IF;
  IF NOT public.are_friends(me, _friend_profile_id) THEN RAISE EXCEPTION 'not_friends'; END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_participants
              WHERE challenge_id = c.id AND profile_id = _friend_profile_id) THEN
    RAISE EXCEPTION 'already_joined';
  END IF;

  INSERT INTO public.challenge_invites (challenge_id, inviter_profile_id, invitee_profile_id, status)
  VALUES (c.id, me, _friend_profile_id, 'pending')
  ON CONFLICT (challenge_id, invitee_profile_id)
  DO UPDATE SET status = 'pending', inviter_profile_id = me, updated_at = now()
  RETURNING id INTO invite_id;

  INSERT INTO public.notifications (profile_id, title, body, notification_type)
  VALUES (_friend_profile_id, 'คำเชิญเข้าร่วมชาเลนจ์',
          format('คุณได้รับเชิญเข้าร่วมชาเลนจ์ "%s"', c.title), 'challenge');

  RETURN invite_id;
END; $$;
REVOKE ALL ON FUNCTION public.invite_friend_to_challenge(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_friend_to_challenge(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_challenge_invite(_invite_id uuid, _action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.current_profile_id();
  inv public.challenge_invites;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO inv FROM public.challenge_invites WHERE id = _invite_id;
  IF inv.id IS NULL OR inv.status <> 'pending' THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  IF _action = 'reject' THEN
    IF inv.invitee_profile_id <> me THEN RAISE EXCEPTION 'not_allowed'; END IF;
    UPDATE public.challenge_invites SET status = 'rejected' WHERE id = inv.id;
  ELSIF _action = 'cancel' THEN
    IF inv.inviter_profile_id <> me THEN RAISE EXCEPTION 'not_allowed'; END IF;
    UPDATE public.challenge_invites SET status = 'cancelled' WHERE id = inv.id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.respond_challenge_invite(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_challenge_invite(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_challenge_invites()
RETURNS TABLE(
  id uuid, direction text, challenge_id uuid, challenge_title text, challenge_code text,
  counterpart_name text, counterpart_picture text, status public.challenge_invite_status,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT i.id,
         CASE WHEN i.invitee_profile_id = (SELECT id FROM me) THEN 'incoming' ELSE 'outgoing' END,
         i.challenge_id, c.title, c.challenge_code,
         p.display_name, p.picture_url, i.status, i.created_at
    FROM public.challenge_invites i
    JOIN public.challenges c ON c.id = i.challenge_id
    JOIN public.profiles p ON p.id = CASE WHEN i.invitee_profile_id = (SELECT id FROM me)
                                          THEN i.inviter_profile_id ELSE i.invitee_profile_id END
   WHERE (SELECT id FROM me) IS NOT NULL
     AND i.status = 'pending'
     AND (i.invitee_profile_id = (SELECT id FROM me) OR i.inviter_profile_id = (SELECT id FROM me))
   ORDER BY i.created_at DESC
$$;
REVOKE ALL ON FUNCTION public.list_challenge_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_challenge_invites() TO authenticated;

-- ============ leaderboard with visibility rules ============
CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_challenge_id uuid, _friends_only boolean DEFAULT false)
RETURNS TABLE(profile_id uuid, display_name text, picture_url text, progress numeric,
              completed boolean, is_self boolean, is_friend boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me uuid := public.current_profile_id();
  c public.challenges;
  am_participant boolean;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL OR NOT public.can_view_challenge(c.id) THEN RETURN; END IF;

  am_participant := EXISTS (SELECT 1 FROM public.challenge_participants
                             WHERE challenge_id = c.id AND profile_id = me);

  IF c.leaderboard_visibility = 'participants'
     AND NOT am_participant AND c.owner_profile_id IS DISTINCT FROM me THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.display_name, p.picture_url, cp.progress, cp.completed,
         p.id = me,
         public.are_friends(me, p.id)
    FROM public.challenge_participants cp
    JOIN public.profiles p ON p.id = cp.profile_id
    LEFT JOIN public.user_settings s ON s.profile_id = p.id
   WHERE cp.challenge_id = c.id
     AND (
       p.id = me
       OR (
         (NOT _friends_only OR public.are_friends(me, p.id))
         AND (c.leaderboard_visibility <> 'friends' OR public.are_friends(me, p.id))
         AND (
           COALESCE(s.privacy_level, 'private'::privacy_level) = 'public'::privacy_level
           OR (COALESCE(s.privacy_level, 'private'::privacy_level) = 'friends'::privacy_level
               AND public.are_friends(me, p.id))
         )
       )
     )
   ORDER BY cp.progress DESC, p.display_name;
END; $$;
REVOKE ALL ON FUNCTION public.challenge_leaderboard(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid, boolean) TO authenticated;

-- ============ realtime ============
ALTER TABLE public.challenges REPLICA IDENTITY FULL;
ALTER TABLE public.challenge_invites REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.challenges;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_invites;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;