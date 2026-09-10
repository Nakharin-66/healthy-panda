import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AVATAR_BUCKET = "avatars";
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) return "รองรับไฟล์ JPG, PNG หรือ WEBP เท่านั้น";
  if (file.size > MAX_AVATAR_BYTES) return "ไฟล์ใหญ่เกิน 5 MB";
  return null;
}

/**
 * profiles.picture_url stores either an external URL (e.g. Google avatar)
 * or a path inside the private "avatars" bucket. Paths need a signed URL.
 */
export function useResolvedAvatar(pictureUrl?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!pictureUrl) {
      setUrl(null);
      return;
    }
    if (/^https?:\/\//.test(pictureUrl)) {
      setUrl(pictureUrl);
      return;
    }
    supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(pictureUrl, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [pictureUrl]);

  return url;
}

/**
 * Removes the user-uploaded avatar and falls back to the picture that came
 * with the account (Google avatar) or the built-in panda avatar.
 */
export function useDeleteAvatar(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (currentPath?: string | null) => {
      if (!profileId) throw new Error("no profile");
      const { data: auth } = await supabase.auth.getUser();
      const fallback = (auth.user?.user_metadata?.["avatar_url"] as string | undefined) ?? null;

      if (currentPath && !/^https?:\/\//.test(currentPath)) {
        await supabase.storage.from(AVATAR_BUCKET).remove([currentPath]);
      }
      const { error } = await supabase
        .from("profiles")
        .update({ picture_url: fallback })
        .eq("id", profileId);
      if (error) throw error;
      return fallback;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useUploadAvatar(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!profileId) throw new Error("no profile");
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("not signed in");

      const path = `${userId}/avatar-${Date.now()}.${EXT[file.type] ?? "jpg"}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("profiles").update({ picture_url: path }).eq("id", profileId);
      if (error) throw error;
      return path;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
