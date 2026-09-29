
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
UPDATE public.challenges SET
  start_at = COALESCE(start_at, (start_date::timestamp) AT TIME ZONE 'Asia/Bangkok'),
  end_at = COALESCE(end_at, ((end_date::timestamp) + interval '23 hours 59 minutes 59 seconds') AT TIME ZONE 'Asia/Bangkok');
ALTER TABLE public.challenges ALTER COLUMN start_at SET DEFAULT now(), ALTER COLUMN start_at SET NOT NULL,
  ALTER COLUMN end_at SET DEFAULT now() + interval '7 days', ALTER COLUMN end_at SET NOT NULL;

ALTER TABLE public.challenge_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_source text,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
UPDATE public.challenge_participants SET joined_at = created_at;

ALTER TABLE public.challenge_invites ADD COLUMN IF NOT EXISTS responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.generate_challenge_code()
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; candidate text; i int;
BEGIN
  LOOP
    candidate := 'HP-CH-';
    FOR i IN 1..5 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.challenges WHERE challenge_code = candidate);
  END LOOP;
  RETURN candidate;
END; $$;

-- Data entries
CREATE TABLE public.challenge_data_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_date date NOT NULL,
  value numeric NOT NULL,
  unit text NOT NULL DEFAULT '',
  source text NOT NULL CHECK (source IN ('health_device','manual')),
  source_provider text,
  source_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, profile_id, data_date, source)
);
CREATE INDEX challenge_data_entries_cp_idx ON public.challenge_data_entries(challenge_id, profile_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenge_data_entries TO authenticated;
GRANT ALL ON public.challenge_data_entries TO service_role;
ALTER TABLE public.challenge_data_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "entries read own" ON public.challenge_data_entries FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());
CREATE POLICY "entries insert own manual" ON public.challenge_data_entries FOR INSERT TO authenticated
  WITH CHECK (profile_id = public.current_profile_id() AND source = 'manual'
    AND EXISTS (SELECT 1 FROM public.challenge_participants cp WHERE cp.challenge_id = challenge_data_entries.challenge_id AND cp.profile_id = public.current_profile_id()));
CREATE POLICY "entries update own manual" ON public.challenge_data_entries FOR UPDATE TO authenticated
  USING (profile_id = public.current_profile_id() AND source = 'manual')
  WITH CHECK (profile_id = public.current_profile_id() AND source = 'manual');
CREATE POLICY "entries delete own manual" ON public.challenge_data_entries FOR DELETE TO authenticated
  USING (profile_id = public.current_profile_id() AND source = 'manual');

-- validation
CREATE OR REPLACE FUNCTION public.validate_challenge_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.challenges; maxv numeric;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = NEW.challenge_id;
  IF c.id IS NULL OR c.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF NEW.value IS NULL OR NEW.value < 0 THEN RAISE EXCEPTION 'invalid_value'; END IF;
  maxv := CASE c.metric WHEN 'steps' THEN 100000 WHEN 'distance_km' THEN 200
            WHEN 'active_minutes' THEN 1440 WHEN 'calories_burned' THEN 10000 ELSE 1000000 END;
  IF NEW.value > maxv THEN RAISE EXCEPTION 'value_too_large'; END IF;
  IF NEW.data_date < (c.start_at AT TIME ZONE 'Asia/Bangkok')::date
     OR NEW.data_date > (c.end_at AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'date_out_of_range';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.challenge_id := OLD.challenge_id; NEW.profile_id := OLD.profile_id; NEW.source := OLD.source;
  END IF;
  NEW.unit := c.unit;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_entries_validate BEFORE INSERT OR UPDATE ON public.challenge_data_entries
  FOR EACH ROW EXECUTE FUNCTION public.validate_challenge_entry();

-- recompute: device has priority per day, never add both
CREATE OR REPLACE FUNCTION public.challenge_recompute(_challenge_id uuid, _profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE total numeric; tgt numeric;
BEGIN
  SELECT COALESCE(sum(v),0) INTO total FROM (
    SELECT COALESCE(max(value) FILTER (WHERE source='health_device'), max(value) FILTER (WHERE source='manual')) v
      FROM public.challenge_data_entries
     WHERE challenge_id = _challenge_id AND profile_id = _profile_id
     GROUP BY data_date) d;
  SELECT NULLIF(target_value,0) INTO tgt FROM public.challenges WHERE id = _challenge_id;
  UPDATE public.challenge_participants
     SET progress = total,
         completed = (tgt IS NOT NULL AND total >= tgt),
         completed_at = CASE WHEN tgt IS NOT NULL AND total >= tgt THEN COALESCE(completed_at, now()) ELSE NULL END,
         updated_at = now()
   WHERE challenge_id = _challenge_id AND profile_id = _profile_id;
END; $$;

CREATE OR REPLACE FUNCTION public.challenge_entries_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM public.challenge_recompute(r.challenge_id, r.profile_id);
  IF TG_OP <> 'DELETE' AND r.source = 'manual' THEN
    UPDATE public.challenge_participants SET last_synced_at = now(), last_source = 'manual'
     WHERE challenge_id = r.challenge_id AND profile_id = r.profile_id;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER challenge_entries_after AFTER INSERT OR UPDATE OR DELETE ON public.challenge_data_entries
  FOR EACH ROW EXECUTE FUNCTION public.challenge_entries_after();

-- participants: no direct client writes
DROP POLICY IF EXISTS "participants own all" ON public.challenge_participants;
CREATE POLICY "participants read own" ON public.challenge_participants FOR SELECT TO authenticated
  USING (profile_id = public.current_profile_id());
REVOKE INSERT, UPDATE, DELETE ON public.challenge_participants FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.invite_responded_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN NEW.responded_at := now(); END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER challenge_invites_responded BEFORE UPDATE ON public.challenge_invites
  FOR EACH ROW EXECUTE FUNCTION public.invite_responded_at();

-- status
CREATE OR REPLACE FUNCTION public.challenge_state(_c public.challenges)
RETURNS text LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _c.deleted_at IS NOT NULL OR _c.status = 'cancelled' OR NOT _c.is_active THEN 'cancelled'
    WHEN now() > _c.end_at OR _c.status = 'closed' THEN 'ended'
    WHEN now() >= _c.start_at THEN 'running'
    ELSE 'upcoming' END
$$;

-- list
CREATE OR REPLACE FUNCTION public.challenge_list(_include_hidden boolean DEFAULT false)
RETURNS TABLE(id uuid, title text, description text, challenge_code text, metric text, target_value numeric, unit text,
  start_at timestamptz, end_at timestamptz, participation_visibility challenge_participation,
  leaderboard_visibility challenge_board_visibility, owner_profile_id uuid, owner_name text, owner_picture text,
  is_owner boolean, participant_count int, joined boolean, my_value numeric, my_rank int,
  last_synced_at timestamptz, last_source text, hidden boolean, state text, invited boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT c.id, c.title, c.description, c.challenge_code, c.metric, c.target_value, c.unit,
    c.start_at, c.end_at, c.participation_visibility, c.leaderboard_visibility,
    c.owner_profile_id, o.display_name, o.picture_url,
    c.owner_profile_id = (SELECT id FROM me),
    (SELECT count(*)::int FROM public.challenge_participants cp WHERE cp.challenge_id = c.id),
    mine.id IS NOT NULL, COALESCE(mine.progress,0),
    CASE WHEN mine.id IS NULL THEN NULL ELSE
      (SELECT count(*)::int + 1 FROM public.challenge_participants x WHERE x.challenge_id = c.id AND x.progress > mine.progress) END,
    mine.last_synced_at, mine.last_source, mine.hidden_at IS NOT NULL,
    public.challenge_state(c),
    EXISTS (SELECT 1 FROM public.challenge_invites i WHERE i.challenge_id = c.id
             AND i.invitee_profile_id = (SELECT id FROM me) AND i.status = 'pending')
  FROM public.challenges c
  LEFT JOIN public.profiles o ON o.id = c.owner_profile_id
  LEFT JOIN public.challenge_participants mine ON mine.challenge_id = c.id AND mine.profile_id = (SELECT id FROM me)
  WHERE (SELECT id FROM me) IS NOT NULL AND c.deleted_at IS NULL AND c.is_active
    AND public.can_view_challenge(c.id)
    AND (_include_hidden OR mine.hidden_at IS NULL)
  ORDER BY c.end_at DESC
$$;

CREATE OR REPLACE FUNCTION public.challenge_get(_challenge_id uuid)
RETURNS SETOF record LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$ SELECT NULL::record WHERE false $$;
DROP FUNCTION public.challenge_get(uuid);

CREATE OR REPLACE FUNCTION public.challenge_by_code(_code text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.challenges;
BEGIN
  IF public.current_profile_id() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE upper(btrim(challenge_code)) = upper(btrim(_code)) AND deleted_at IS NULL;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_code_not_found'; END IF;
  IF public.challenge_state(c) IN ('ended','cancelled') THEN RAISE EXCEPTION 'challenge_expired'; END IF;
  IF c.participation_visibility = 'friends' AND c.owner_profile_id IS DISTINCT FROM public.current_profile_id()
     AND NOT public.are_friends(public.current_profile_id(), c.owner_profile_id)
     AND NOT EXISTS (SELECT 1 FROM public.challenge_invites i WHERE i.challenge_id=c.id AND i.invitee_profile_id=public.current_profile_id()) THEN
    RAISE EXCEPTION 'join_not_allowed';
  END IF;
  RETURN c.id;
END; $$;

-- code possession grants view for everyone/invite code share: extend can_view
CREATE OR REPLACE FUNCTION public.can_view_challenge(_challenge_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT EXISTS (
    SELECT 1 FROM public.challenges c
     WHERE c.id = _challenge_id AND c.deleted_at IS NULL
       AND (
         c.owner_profile_id IS NULL
         OR c.owner_profile_id = (SELECT id FROM me)
         OR c.participation_visibility = 'everyone'
         OR (c.participation_visibility = 'friends' AND public.are_friends((SELECT id FROM me), c.owner_profile_id))
         OR EXISTS (SELECT 1 FROM public.challenge_invites i WHERE i.challenge_id = c.id AND i.invitee_profile_id = (SELECT id FROM me))
         OR EXISTS (SELECT 1 FROM public.challenge_participants cp WHERE cp.challenge_id = c.id AND cp.profile_id = (SELECT id FROM me))
       ))
$$;

-- join
CREATE OR REPLACE FUNCTION public.join_challenge(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := public.current_profile_id(); c public.challenges; allowed boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id AND deleted_at IS NULL;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF public.challenge_state(c) = 'cancelled' THEN RAISE EXCEPTION 'challenge_closed'; END IF;
  IF public.challenge_state(c) = 'ended' THEN RAISE EXCEPTION 'challenge_expired'; END IF;
  IF c.owner_profile_id IS NULL OR c.owner_profile_id = me OR c.participation_visibility = 'everyone' THEN allowed := true;
  ELSIF c.participation_visibility = 'friends' THEN
    allowed := public.are_friends(me, c.owner_profile_id)
      OR EXISTS (SELECT 1 FROM public.challenge_invites i WHERE i.challenge_id=c.id AND i.invitee_profile_id=me AND i.status IN ('pending','accepted'));
  ELSE
    allowed := EXISTS (SELECT 1 FROM public.challenge_invites i WHERE i.challenge_id=c.id AND i.invitee_profile_id=me AND i.status IN ('pending','accepted'));
  END IF;
  IF NOT allowed THEN RAISE EXCEPTION 'join_not_allowed'; END IF;
  IF EXISTS (SELECT 1 FROM public.challenge_participants WHERE challenge_id=c.id AND profile_id=me) THEN RAISE EXCEPTION 'already_joined'; END IF;
  INSERT INTO public.challenge_participants (challenge_id, profile_id, progress, score) VALUES (c.id, me, 0, 0);
  UPDATE public.challenge_invites SET status='accepted' WHERE challenge_id=c.id AND invitee_profile_id=me AND status='pending';
END; $$;

-- create
CREATE OR REPLACE FUNCTION public.challenge_create(_title text, _description text, _metric text, _target numeric,
  _start_at timestamptz, _end_at timestamptz, _participation challenge_participation, _board challenge_board_visibility)
RETURNS TABLE(id uuid, challenge_code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := public.current_profile_id(); u text; cat challenge_category; new_id uuid; code text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _metric NOT IN ('steps','distance_km','active_minutes','calories_burned') THEN RAISE EXCEPTION 'invalid_metric'; END IF;
  IF coalesce(btrim(_title),'') = '' OR length(_title) > 80 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF _target IS NULL OR _target <= 0 THEN RAISE EXCEPTION 'invalid_target'; END IF;
  IF _end_at <= _start_at THEN RAISE EXCEPTION 'invalid_range'; END IF;
  IF _end_at - _start_at > interval '366 days' THEN RAISE EXCEPTION 'range_too_long'; END IF;
  u := CASE _metric WHEN 'steps' THEN 'ก้าว' WHEN 'distance_km' THEN 'กม.' WHEN 'active_minutes' THEN 'นาที' ELSE 'kcal' END;
  cat := CASE WHEN _metric IN ('steps','distance_km') THEN 'movement'::challenge_category ELSE 'exercise'::challenge_category END;
  INSERT INTO public.challenges (title, description, metric, target_value, unit, category, goal_mode,
    start_at, end_at, start_date, end_date, participation_visibility, leaderboard_visibility, owner_profile_id, reward_points)
  VALUES (btrim(_title), NULLIF(btrim(coalesce(_description,'')),''), _metric, _target, u, cat, 'cumulative',
    _start_at, _end_at, (_start_at AT TIME ZONE 'Asia/Bangkok')::date, (_end_at AT TIME ZONE 'Asia/Bangkok')::date,
    _participation, _board, me, 0)
  RETURNING challenges.id, challenges.challenge_code INTO new_id, code;
  INSERT INTO public.challenge_participants (challenge_id, profile_id) VALUES (new_id, me);
  RETURN QUERY SELECT new_id, code;
END; $$;

-- update
CREATE OR REPLACE FUNCTION public.challenge_update(_challenge_id uuid, _title text, _description text, _metric text,
  _target numeric, _start_at timestamptz, _end_at timestamptz, _participation challenge_participation, _board challenge_board_visibility)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := public.current_profile_id(); c public.challenges;
BEGIN
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id AND deleted_at IS NULL;
  IF c.id IS NULL OR c.owner_profile_id IS DISTINCT FROM me THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF coalesce(btrim(_title),'') = '' OR length(_title) > 80 THEN RAISE EXCEPTION 'invalid_title'; END IF;
  IF public.challenge_state(c) = 'upcoming' THEN
    IF _metric NOT IN ('steps','distance_km','active_minutes','calories_burned') THEN RAISE EXCEPTION 'invalid_metric'; END IF;
    IF _target IS NULL OR _target <= 0 THEN RAISE EXCEPTION 'invalid_target'; END IF;
    IF _end_at <= _start_at THEN RAISE EXCEPTION 'invalid_range'; END IF;
    UPDATE public.challenges SET title=btrim(_title), description=NULLIF(btrim(coalesce(_description,'')),''),
      metric=_metric, target_value=_target,
      unit = CASE _metric WHEN 'steps' THEN 'ก้าว' WHEN 'distance_km' THEN 'กม.' WHEN 'active_minutes' THEN 'นาที' ELSE 'kcal' END,
      start_at=_start_at, end_at=_end_at,
      start_date=(_start_at AT TIME ZONE 'Asia/Bangkok')::date, end_date=(_end_at AT TIME ZONE 'Asia/Bangkok')::date,
      participation_visibility=_participation, leaderboard_visibility=_board, updated_at=now()
     WHERE id = c.id;
  ELSE
    UPDATE public.challenges SET title=btrim(_title), description=NULLIF(btrim(coalesce(_description,'')),''), updated_at=now()
     WHERE id = c.id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.challenge_delete(_challenge_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.challenges SET deleted_at = now(), updated_at = now()
   WHERE id = _challenge_id AND owner_profile_id = public.current_profile_id() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_owner'; END IF;
  UPDATE public.challenge_invites SET status='cancelled' WHERE challenge_id=_challenge_id AND status='pending';
END; $$;

CREATE OR REPLACE FUNCTION public.challenge_hide(_challenge_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.challenge_participants SET hidden_at = now()
   WHERE challenge_id = _challenge_id AND profile_id = public.current_profile_id()
$$;

-- device sync
CREATE OR REPLACE FUNCTION public.challenge_sync_device(_challenge_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := public.current_profile_id(); c public.challenges; m text; provider text; has_device boolean; n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id AND deleted_at IS NULL;
  IF c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.challenge_participants WHERE challenge_id=c.id AND profile_id=me) THEN RAISE EXCEPTION 'not_joined'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.health_devices WHERE profile_id = me AND pair_status = 'paired'),
         (SELECT CASE WHEN platform ILIKE '%ios%' OR platform ILIKE '%apple%' THEN 'apple_health' WHEN platform IS NOT NULL THEN 'health_connect' END
            FROM public.health_devices WHERE profile_id = me ORDER BY last_sync_at DESC NULLS LAST LIMIT 1)
    INTO has_device, provider;
  m := CASE c.metric WHEN 'steps' THEN 'steps' WHEN 'distance_km' THEN 'distance_km'
         WHEN 'calories_burned' THEN 'active_calories' WHEN 'active_minutes' THEN 'exercise_minutes' ELSE NULL END;
  IF m IS NULL THEN RAISE EXCEPTION 'invalid_metric'; END IF;

  INSERT INTO public.challenge_data_entries (challenge_id, profile_id, data_date, value, unit, source, source_provider, source_record_id)
  SELECT c.id, me, (s.recorded_at AT TIME ZONE 'Asia/Bangkok')::date, round(sum(s.value)::numeric, 2), c.unit,
         'health_device', provider, m
    FROM public.health_samples s
   WHERE s.profile_id = me AND s.metric = m AND s.recorded_at >= c.start_at AND s.recorded_at <= c.end_at
   GROUP BY 3
  ON CONFLICT (challenge_id, profile_id, data_date, source)
  DO UPDATE SET value = EXCLUDED.value, source_provider = EXCLUDED.source_provider, updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;

  PERFORM public.challenge_recompute(c.id, me);
  UPDATE public.challenge_participants SET last_synced_at = now(), last_source = CASE WHEN n > 0 THEN 'health_device' ELSE last_source END
   WHERE challenge_id = c.id AND profile_id = me;
  RETURN jsonb_build_object('has_device', coalesce(has_device,false), 'days', n,
    'total', (SELECT progress FROM public.challenge_participants WHERE challenge_id=c.id AND profile_id=me));
END; $$;

-- leaderboard (real values)
CREATE OR REPLACE FUNCTION public.challenge_board(_challenge_id uuid)
RETURNS TABLE(rank int, profile_id uuid, display_name text, picture_url text, value numeric, is_self boolean, is_friend boolean, visible boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := public.current_profile_id(); c public.challenges; am boolean;
BEGIN
  IF me IS NULL THEN RETURN; END IF;
  SELECT * INTO c FROM public.challenges WHERE id = _challenge_id AND deleted_at IS NULL;
  IF c.id IS NULL OR NOT public.can_view_challenge(c.id) THEN RETURN; END IF;
  am := EXISTS (SELECT 1 FROM public.challenge_participants x WHERE x.challenge_id=c.id AND x.profile_id=me);
  IF c.leaderboard_visibility = 'participants' AND NOT am AND c.owner_profile_id IS DISTINCT FROM me THEN RETURN; END IF;
  IF c.leaderboard_visibility = 'friends' AND NOT am AND c.owner_profile_id IS DISTINCT FROM me
     AND NOT public.are_friends(me, c.owner_profile_id) THEN RETURN; END IF;
  RETURN QUERY
  WITH ranked AS (
    SELECT cp.profile_id pid, cp.progress v, (rank() OVER (ORDER BY cp.progress DESC))::int r
      FROM public.challenge_participants cp WHERE cp.challenge_id = c.id)
  SELECT rk.r, p.id,
    CASE WHEN ok THEN p.display_name ELSE 'ผู้เข้าร่วม' END,
    CASE WHEN ok THEN p.picture_url ELSE NULL END,
    rk.v, p.id = me, public.are_friends(me, p.id), ok
  FROM ranked rk JOIN public.profiles p ON p.id = rk.pid
  LEFT JOIN public.user_settings s ON s.profile_id = p.id
  CROSS JOIN LATERAL (SELECT (p.id = me
      OR COALESCE(s.privacy_level,'private'::privacy_level) = 'public'::privacy_level
      OR (COALESCE(s.privacy_level,'private'::privacy_level) = 'friends'::privacy_level AND public.are_friends(me,p.id))) AS ok) z
  ORDER BY rk.r, p.display_name;
END; $$;

-- own daily series
CREATE OR REPLACE FUNCTION public.challenge_series(_challenge_id uuid)
RETURNS TABLE(d date, device numeric, manual numeric, used numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT data_date,
    max(value) FILTER (WHERE source='health_device'),
    max(value) FILTER (WHERE source='manual'),
    COALESCE(max(value) FILTER (WHERE source='health_device'), max(value) FILTER (WHERE source='manual'))
  FROM public.challenge_data_entries
  WHERE challenge_id = _challenge_id AND profile_id = public.current_profile_id()
  GROUP BY data_date ORDER BY data_date
$$;

-- invites with details
CREATE OR REPLACE FUNCTION public.challenge_invites_detail()
RETURNS TABLE(id uuid, direction text, challenge_id uuid, title text, metric text, target_value numeric, unit text,
  start_at timestamptz, end_at timestamptz, counterpart_id uuid, counterpart_name text, counterpart_picture text,
  status challenge_invite_status, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH me AS (SELECT public.current_profile_id() AS id)
  SELECT i.id, CASE WHEN i.invitee_profile_id = (SELECT id FROM me) THEN 'incoming' ELSE 'outgoing' END,
    c.id, c.title, c.metric, c.target_value, c.unit, c.start_at, c.end_at,
    p.id, p.display_name, p.picture_url, i.status, i.created_at
  FROM public.challenge_invites i
  JOIN public.challenges c ON c.id = i.challenge_id AND c.deleted_at IS NULL
  JOIN public.profiles p ON p.id = CASE WHEN i.invitee_profile_id = (SELECT id FROM me) THEN i.inviter_profile_id ELSE i.invitee_profile_id END
  WHERE (SELECT id FROM me) IS NOT NULL
    AND (i.invitee_profile_id = (SELECT id FROM me) OR i.inviter_profile_id = (SELECT id FROM me))
  ORDER BY i.created_at DESC
$$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['challenge_list(boolean)','challenge_by_code(text)','join_challenge(uuid)',
    'challenge_create(text,text,text,numeric,timestamptz,timestamptz,challenge_participation,challenge_board_visibility)',
    'challenge_update(uuid,text,text,text,numeric,timestamptz,timestamptz,challenge_participation,challenge_board_visibility)',
    'challenge_delete(uuid)','challenge_hide(uuid)','challenge_sync_device(uuid)','challenge_board(uuid)',
    'challenge_series(uuid)','challenge_invites_detail()','can_view_challenge(uuid)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.challenge_recompute(uuid,uuid) FROM PUBLIC, anon, authenticated;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.challenge_data_entries;
