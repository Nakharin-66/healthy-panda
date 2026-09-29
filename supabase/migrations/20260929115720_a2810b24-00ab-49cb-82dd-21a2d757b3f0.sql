REVOKE ALL ON FUNCTION public.validate_challenge_entry() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.challenge_entries_after() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.challenge_state(public.challenges) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.challenge_state(public.challenges) TO authenticated;