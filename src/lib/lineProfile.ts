import { supabase } from "@/integrations/supabase/client";

type Liff = { isLoggedIn(): boolean; getProfile(): Promise<{ userId: string; displayName: string; pictureUrl?: string }> };

/** Fills the signed-in user's own profile with LINE name/photo only where no value was chosen yet. */
export async function syncLineProfile(liff: Liff): Promise<boolean> {
  if (!liff.isLoggedIn()) return false;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return false;
  const line = await liff.getProfile();
  const { data: row, error } = await supabase
    .from("profiles")
    .select("id, display_name, picture_url, line_user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !row) return false;
  if (row.line_user_id && row.line_user_id !== line.userId) return false;

  const autoNames = new Set(["", "Panda Friend", user.email?.split("@")[0] ?? ""]);
  const patch: { display_name?: string; picture_url?: string; line_user_id?: string } = {};
  const name = line.displayName?.trim();
  if (name && autoNames.has((row.display_name ?? "").trim()) && row.display_name !== name) patch.display_name = name.slice(0, 60);
  if (line.pictureUrl && !row.picture_url) patch.picture_url = line.pictureUrl;
  if (!row.line_user_id) patch.line_user_id = line.userId;
  if (!Object.keys(patch).length) return false;
  const { error: updateError } = await supabase.from("profiles").update(patch).eq("id", row.id);
  if (updateError) throw updateError;
  return true;
}
