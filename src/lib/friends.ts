import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAX_FRIENDS = 50;

export const FRIEND_ERROR_TH: Record<string, string> = {
  code_not_found: "ไม่พบรหัสเพื่อนนี้",
  cannot_add_self: "ไม่สามารถเพิ่มตัวเองเป็นเพื่อนได้",
  already_friends: "ผู้ใช้นี้เป็นเพื่อนของคุณอยู่แล้ว",
  request_exists: "มีคำขอเป็นเพื่อนระหว่างคุณทั้งสองอยู่แล้ว",
  friend_limit_reached: `คุณมีเพื่อนครบ ${MAX_FRIENDS} คนแล้ว`,
  request_not_found: "ไม่พบคำขอนี้ อาจถูกยกเลิกไปแล้ว",
  not_allowed: "คุณไม่มีสิทธิ์ดำเนินการนี้",
  not_authenticated: "กรุณาเข้าสู่ระบบก่อน",
};

export function friendErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  for (const key of Object.keys(FRIEND_ERROR_TH)) {
    if (raw.includes(key)) return FRIEND_ERROR_TH[key]!;
  }
  return "ไม่สามารถดำเนินการได้ กรุณาลองใหม่อีกครั้ง";
}

export function useFriendSummary(enabled = true) {
  return useQuery({
    queryKey: ["friend_summary"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("friend_summary");
      if (error) throw error;
      return data?.[0] ?? { friend_count: 0, pending_incoming: 0, pending_outgoing: 0 };
    },
  });
}

export function useFriends(enabled = true) {
  return useQuery({
    queryKey: ["friends"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_friends");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useFriendRequests(enabled = true) {
  return useQuery({
    queryKey: ["friend_requests"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_friend_requests");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLookupFriendCode() {
  return useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc("lookup_friend_code", { _code: code });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

export function useSendFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const { error } = await supabase.rpc("send_friend_request", { _code: code });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend_requests"] });
      qc.invalidateQueries({ queryKey: ["friend_summary"] });
    },
  });
}

export function useRespondFriendRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "accept" | "reject" | "cancel" }) => {
      const { error } = await supabase.rpc("respond_friend_request", {
        _request_id: id,
        _action: action,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friend_requests"] });
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend_summary"] });
    },
  });
}

export function useRemoveFriend() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileId: string) => {
      const { error } = await supabase.rpc("remove_friend", { _friend_profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["friends"] });
      qc.invalidateQueries({ queryKey: ["friend_summary"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

/** Friend codes are permanent: created once with the profile and never regenerated. */

export function useFriendProfile(profileId?: string) {
  return useQuery({
    queryKey: ["friend_profile", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("friend_public_profile", {
        _profile_id: profileId!,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}

/** Keeps friend lists, requests and leaderboards live without reloading. */
export function useFriendRealtime(enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase
      .channel("friends-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        qc.invalidateQueries({ queryKey: ["friends"] });
        qc.invalidateQueries({ queryKey: ["friend_summary"] });
        qc.invalidateQueries({ queryKey: ["leaderboard"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => {
        qc.invalidateQueries({ queryKey: ["friend_requests"] });
        qc.invalidateQueries({ queryKey: ["friend_summary"] });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "challenge_participants" },
        () => {
          qc.invalidateQueries({ queryKey: ["leaderboard"] });
          qc.invalidateQueries({ queryKey: ["challenge_participants"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, enabled]);
}

export const PRIVACY_LABEL_TH: Record<string, string> = {
  private: "ส่วนตัว",
  friends: "เพื่อน",
  public: "สาธารณะ",
};
