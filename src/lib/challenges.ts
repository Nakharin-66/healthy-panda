import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Challenge = Tables<"challenges">;

export const METRIC_LABEL: Record<string, string> = {
  steps: "จำนวนก้าว",
  water_ml: "การดื่มน้ำ",
  calories_burned: "แคลอรีที่เผาผลาญ",
  exercise_minutes: "นาทีออกกำลังกาย",
  active_days: "จำนวนวันที่เคลื่อนไหว",
};

export const METRIC_UNIT: Record<string, string> = {
  steps: "ก้าว",
  water_ml: "มล.",
  calories_burned: "kcal",
  exercise_minutes: "นาที",
  active_days: "วัน",
};

export function metricUnit(c: Pick<Challenge, "metric" | "unit">) {
  return c.unit?.trim() ? c.unit : (METRIC_UNIT[c.metric] ?? "");
}

export function challengeStatus(
  c: Pick<Challenge, "start_date" | "end_date">,
  joined: boolean,
  completed: boolean,
) {
  const today = new Date().toISOString().slice(0, 10);
  if (completed) return { key: "completed", label: "เสร็จสิ้น" } as const;
  if (c.end_date < today) return { key: "expired", label: "หมดเวลา" } as const;
  if (c.start_date > today) return { key: "upcoming", label: "ยังไม่เริ่ม" } as const;
  if (joined) return { key: "joined", label: "เข้าร่วมแล้ว" } as const;
  return { key: "open", label: "ยังไม่เข้าร่วม" } as const;
}

export function useActiveChallenges() {
  return useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges")
        .select("*")
        .eq("is_active", true)
        .order("end_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyParticipation(profileId?: string) {
  return useQuery({
    queryKey: ["challenge_participants", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_participants")
        .select("challenge_id, progress, completed, completed_at")
        .eq("profile_id", profileId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Recalculates the signed-in user's progress from real logs, server-side. */
export function useSyncProgress(enabled: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    supabase.rpc("sync_challenge_progress").then(({ error }) => {
      if (!active || error) return;
      qc.invalidateQueries({ queryKey: ["challenge_participants"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    });
    return () => {
      active = false;
    };
  }, [enabled, qc]);
}

export function useJoinChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const { error } = await supabase.rpc("join_challenge", { _challenge_id: challengeId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["challenge_participants"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}

export function useLeaderboard(challengeId?: string, friendsOnly = false) {
  return useQuery({
    queryKey: ["leaderboard", challengeId, friendsOnly],
    enabled: !!challengeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("challenge_leaderboard", {
        _challenge_id: challengeId!,
        _friends_only: friendsOnly,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}
