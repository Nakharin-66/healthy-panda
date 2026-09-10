CREATE OR REPLACE FUNCTION public.can_view_avatar_folder(_folder text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _folder = auth.uid()::text
      OR EXISTS (
        SELECT 1
          FROM public.friendships f
          JOIN public.profiles p ON p.id = f.friend_profile_id
         WHERE f.profile_id = public.current_profile_id()
           AND p.user_id::text = _folder
      )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_avatar_folder(text) FROM anon;

DROP POLICY IF EXISTS "friends can view avatars" ON storage.objects;
CREATE POLICY "friends can view avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND public.can_view_avatar_folder((storage.foldername(name))[1]));
