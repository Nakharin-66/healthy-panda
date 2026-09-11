
-- personal daily target from the user's own daily goals
CREATE OR REPLACE FUNCTION public.personal_daily_target(_profile_id uuid, _metric text, _fallback numeric)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT CASE _metric
             WHEN 'steps' THEN g.steps_goal::numeric
             WHEN 'water_ml' THEN g.water_goal_ml::numeric
             WHEN 'calories_burned' THEN g.calories_goal::numeric
             WHEN 'sleep_minutes' THEN g.sleep_goal_minutes::numeric
             ELSE NULL END
      FROM public.daily_goals g
     WHERE g.profile_id = _profile_id
     ORDER BY g.effective_date DESC
     LIMIT 1
  ), NULLIF(_fallback, 0), 0)
$$;

CREATE OR REPLACE FUNCTION public.challenge_effective_target(_profile_id uuid, _challenge_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN c.target_source = 'personal_goal'
      THEN public.personal_daily_target(_profile_id, c.metric, c.target_value)
    ELSE c.target_value
  END
  FROM public.challenges c WHERE c.id = _challenge_id
$$;

-- add sleep support to the daily metric source
CREATE OR REPLACE FUNCTION public.challenge_metric_daily(_profile_id uuid, _metric text, _from date, _to date)
 RETURNS TABLE(d date, v numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT d, v FROM (
    SELECT stat_date AS d, COALESCE(steps,0)::numeric AS v
      FROM public.daily_statistics
     WHERE _metric = 'steps' AND profile_id = _profile_id AND stat_date BETWEEN _from AND _to
    UNION ALL
    SELECT stat_date, COALESCE(sleep_minutes,0)::numeric
      FROM public.daily_statistics
     WHERE _metric = 'sleep_minutes' AND profile_id = _profile_id AND stat_date BETWEEN _from AND _to
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
$function$;

-- progress now respects per-participant targets
CREATE OR REPLACE FUNCTION public.compute_challenge_progress(_profile_id uuid, _challenge_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  c public.challenges;
  tgt numeric;
  result numeric := 0;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RETURN 0; END IF;
  tgt := public.challenge_effective_target(_profile_id, _challenge_id);

  IF c.goal_mode = 'daily' AND c.metric NOT IN ('activity_days','active_days') THEN
    SELECT count(*) INTO result
      FROM public.challenge_metric_daily(_profile_id, c.metric, c.start_date, c.end_date) s
     WHERE s.v >= NULLIF(tgt, 0);
  ELSE
    SELECT COALESCE(sum(s.v), 0) INTO result
      FROM public.challenge_metric_daily(_profile_id, c.metric, c.start_date, c.end_date) s;
  END IF;

  RETURN COALESCE(result, 0);
END; $function$;

-- score from real progress, never user supplied
CREATE OR REPLACE FUNCTION public.compute_challenge_score(_profile_id uuid, _challenge_id uuid)
RETURNS numeric LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  c public.challenges;
  prog numeric;
  tgt numeric;
  s numeric := 0;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RETURN 0; END IF;
  prog := public.compute_challenge_progress(_profile_id, _challenge_id);
  tgt := NULLIF(public.challenge_effective_target(_profile_id, _challenge_id), 0);

  IF c.scoring_type = 'daily_completion'
     AND c.goal_mode = 'daily' AND c.metric NOT IN ('activity_days','active_days') THEN
    s := prog * 100;
  ELSIF c.goal_mode = 'daily' AND c.metric IN ('activity_days','active_days') THEN
    s := CASE WHEN tgt IS NULL THEN 0 ELSE least(prog / tgt, 1) * c.max_score END;
  ELSE
    s := CASE WHEN tgt IS NULL THEN 0 ELSE least(prog / tgt, 1) * c.max_score END;
  END IF;

  RETURN round(least(COALESCE(s, 0), c.max_score::numeric), 2);
END; $function$;

-- rebuild the challenge view type with scoring info
DROP FUNCTION IF EXISTS public.lookup_challenge_code(text);
DROP FUNCTION IF EXISTS public.challenge_detail(uuid);
DROP FUNCTION IF EXISTS public.list_visible_challenges();
DROP TYPE IF EXISTS public.challenge_view;

CREATE TYPE public.challenge_view AS (
  id uuid,
  title text,
  description text,
  icon text,
  challenge_code text,
  category public.challenge_category,
  metric text,
  target_value numeric,
  unit text,
  goal_mode public.challenge_goal_mode,
  start_date date,
  end_date date,
  reward_points integer,
  participation_visibility public.challenge_participation,
  leaderboard_visibility public.challenge_board_visibility,
  owner_profile_id uuid,
  owner_name text,
  owner_picture text,
  is_owner boolean,
  participant_count integer,
  joined boolean,
  my_progress numeric,
  my_completed boolean,
  invited boolean,
  scoring_type public.challenge_scoring_type,
  target_source public.challenge_target_source,
  max_score integer,
  status public.challenge_status,
  effective_status text,
  my_score numeric,
  my_target numeric
);

CREATE OR REPLACE FUNCTION public.challenge_effective_status(_challenge_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN c.status IN ('cancelled','closed') THEN c.status::text
    WHEN NOT c.is_active THEN 'cancelled'
    WHEN c.end_date < current_date THEN 'ended'
    WHEN c.start_date <= current_date THEN 'running'
    ELSE 'open'
  END
  FROM public.challenges c WHERE c.id = _challenge_id
$$;

CREATE OR REPLACE FUNCTION public.list_visible_challenges()
RETURNS SETOF public.challenge_view
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
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
                    AND i.status = 'pending'),
         c.scoring_type, c.target_source, c.max_score, c.status,
         public.challenge_effective_status(c.id),
         COALESCE(mine.score, 0),
         public.challenge_effective_target((SELECT id FROM me), c.id)
    FROM public.challenges c
    LEFT JOIN public.profiles o ON o.id = c.owner_profile_id
    LEFT JOIN public.challenge_participants mine
           ON mine.challenge_id = c.id AND mine.profile_id = (SELECT id FROM me)
   WHERE (SELECT id FROM me) IS NOT NULL
     AND c.is_active
     AND public.can_view_challenge(c.id)
   ORDER BY (mine.profile_id IS NOT NULL) DESC, c.end_date
$function$;

CREATE OR REPLACE FUNCTION public.challenge_detail(_challenge_id uuid)
RETURNS SETOF public.challenge_view
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
  SELECT * FROM public.list_visible_challenges() WHERE id = _challenge_id
$function$;

CREATE OR REPLACE FUNCTION public.lookup_challenge_code(_code text)
RETURNS SETOF public.challenge_view
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE target uuid;
BEGIN
  IF public.current_profile_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO target FROM public.challenges WHERE upper(btrim(challenge_code)) = upper(btrim(_code));
  IF target IS NULL THEN RAISE EXCEPTION 'challenge_code_not_found'; END IF;
  IF NOT public.can_view_challenge(target) THEN RAISE EXCEPTION 'challenge_not_accessible'; END IF;
  RETURN QUERY SELECT * FROM public.challenge_detail(target);
END; $function$;

-- creation with scoring options
DROP FUNCTION IF EXISTS public.create_challenge(text, text, public.challenge_category, text, numeric, public.challenge_goal_mode, date, date, public.challenge_participation, public.challenge_board_visibility, text);

CREATE OR REPLACE FUNCTION public.create_challenge(
  _title text, _description text, _category public.challenge_category, _metric text,
  _target_value numeric, _goal_mode public.challenge_goal_mode, _start_date date, _end_date date,
  _participation public.challenge_participation, _board public.challenge_board_visibility,
  _scoring public.challenge_scoring_type DEFAULT 'daily_completion',
  _target_source public.challenge_target_source DEFAULT 'fixed',
  _icon text DEFAULT NULL
) RETURNS public.challenges
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  me uuid := public.current_profile_id();
  days int;
  points int;
  max_pts int;
  row public.challenges;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF coalesce(btrim(_title), '') = '' THEN RAISE EXCEPTION 'title_required'; END IF;
  IF _metric NOT IN ('steps','distance_km','active_minutes','calories_burned','water_ml','activity_days','sleep_minutes')
    THEN RAISE EXCEPTION 'invalid_metric'; END IF;
  IF _target_value IS NULL OR _target_value <= 0 THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF _end_date < _start_date THEN RAISE EXCEPTION 'invalid_date_range'; END IF;
  IF _end_date - _start_date > 365 THEN RAISE EXCEPTION 'range_too_long'; END IF;

  days := (_end_date - _start_date) + 1;
  points := least(1000, greatest(10, days * 10 + CASE WHEN _goal_mode = 'daily' THEN 50 ELSE 0 END));

  IF _scoring = 'daily_completion' AND _goal_mode = 'daily'
     AND _metric NOT IN ('activity_days','active_days') THEN
    max_pts := days * 100;
  ELSE
    max_pts := 100;
  END IF;

  INSERT INTO public.challenges (
    owner_profile_id, title, description, icon, category, metric, target_value,
    unit, goal_mode, start_date, end_date, reward_points, is_active,
    participation_visibility, leaderboard_visibility, scoring_type, target_source, max_score, status
  ) VALUES (
    me, btrim(_title), nullif(btrim(coalesce(_description,'')), ''), _icon, _category, _metric, _target_value,
    CASE _metric WHEN 'steps' THEN 'ก้าว' WHEN 'distance_km' THEN 'กม.'
                 WHEN 'active_minutes' THEN 'นาที' WHEN 'calories_burned' THEN 'kcal'
                 WHEN 'water_ml' THEN 'มล.' WHEN 'sleep_minutes' THEN 'นาที' ELSE 'วัน' END,
    _goal_mode, _start_date, _end_date, points, true, _participation, _board,
    _scoring, _target_source, max_pts, 'open'
  ) RETURNING * INTO row;

  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress, score)
  VALUES (row.id, me, public.compute_challenge_progress(me, row.id),
          public.compute_challenge_score(me, row.id))
  ON CONFLICT (challenge_id, profile_id) DO NOTHING;

  RETURN row;
END; $function$;

-- joining stores a computed score too, and respects closed/cancelled status
CREATE OR REPLACE FUNCTION public.join_challenge(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  me uuid := public.current_profile_id();
  c public.challenges;
  allowed boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF NOT c.is_active OR c.status IN ('closed','cancelled') THEN RAISE EXCEPTION 'challenge_closed'; END IF;
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

  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress, score)
  VALUES (c.id, me, public.compute_challenge_progress(me, c.id), public.compute_challenge_score(me, c.id));

  UPDATE public.challenge_invites SET status = 'accepted'
   WHERE challenge_id = c.id AND invitee_profile_id = me AND status = 'pending';
END; $function$;

-- recompute progress + score for the signed-in user
CREATE OR REPLACE FUNCTION public.sync_challenge_progress()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE
  me uuid := public.current_profile_id();
  r record;
  value numeric;
  target numeric;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  FOR r IN
    SELECT cp.id, cp.challenge_id
      FROM public.challenge_participants cp
     WHERE cp.profile_id = me
  LOOP
    value := public.compute_challenge_progress(me, r.challenge_id);
    target := NULLIF(public.challenge_effective_target(me, r.challenge_id), 0);
    UPDATE public.challenge_participants
       SET progress = value,
           score = public.compute_challenge_score(me, r.challenge_id),
           completed = (target IS NOT NULL AND value >= target),
           completed_at = CASE WHEN target IS NOT NULL AND value >= target
                               THEN COALESCE(completed_at, now()) ELSE NULL END
     WHERE id = r.id;
  END LOOP;
END; $function$;

-- leaderboard ordered by score
DROP FUNCTION IF EXISTS public.challenge_leaderboard(uuid, boolean);

CREATE OR REPLACE FUNCTION public.challenge_leaderboard(_challenge_id uuid, _friends_only boolean DEFAULT false)
RETURNS TABLE(profile_id uuid, display_name text, picture_url text, progress numeric,
              score numeric, completed boolean, is_self boolean, is_friend boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public'
AS $function$
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
  SELECT p.id, p.display_name, p.picture_url, cp.progress, cp.score, cp.completed,
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
   ORDER BY cp.score DESC, cp.progress DESC, p.display_name;
END; $function$;

-- owner can close or cancel their own challenge
CREATE OR REPLACE FUNCTION public.set_challenge_status(_challenge_id uuid, _status public.challenge_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $function$
DECLARE me uuid := public.current_profile_id();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _status NOT IN ('open','closed','cancelled') THEN RAISE EXCEPTION 'invalid_action'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = _challenge_id AND owner_profile_id = me) THEN
    RAISE EXCEPTION 'not_challenge_owner';
  END IF;
  UPDATE public.challenges SET status = _status WHERE id = _challenge_id;
END; $function$;

-- keep progress/score writable only through the security definer functions
REVOKE UPDATE (progress, score, completed, completed_at) ON public.challenge_participants FROM authenticated;

-- signed-in only execution
REVOKE ALL ON FUNCTION public.personal_daily_target(uuid, text, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.challenge_effective_target(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.compute_challenge_score(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.challenge_effective_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_challenge_status(uuid, public.challenge_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_visible_challenges() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.challenge_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookup_challenge_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.challenge_leaderboard(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_challenge(text, text, public.challenge_category, text, numeric, public.challenge_goal_mode, date, date, public.challenge_participation, public.challenge_board_visibility, public.challenge_scoring_type, public.challenge_target_source, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.personal_daily_target(uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_effective_target(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_challenge_score(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_effective_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_challenge_status(uuid, public.challenge_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_visible_challenges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_challenge_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.challenge_leaderboard(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_challenge(text, text, public.challenge_category, text, numeric, public.challenge_goal_mode, date, date, public.challenge_participation, public.challenge_board_visibility, public.challenge_scoring_type, public.challenge_target_source, text) TO authenticated;
