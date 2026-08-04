import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type DailyGoals = Tables<"daily_goals">;
export type FoodLog = Tables<"food_logs">;
export type ExerciseLog = Tables<"exercise_logs">;
export type WaterLog = Tables<"water_logs">;
export type Challenge = Tables<"challenges">;
export type AiMessage = Tables<"ai_conversations">;

export const DEFAULT_GOALS = {
  steps_goal: 8000,
  calories_goal: 2100,
  water_goal_ml: 2500,
  sleep_goal_minutes: 480,
  protein_goal_g: 120,
  fat_goal_g: 65,
  carb_goal_g: 240,
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the current user's profile row, creating it when missing. */
async function fetchProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      user_id: user.id,
      display_name:
        (user.user_metadata?.["display_name"] as string) ??
        (user.user_metadata?.["name"] as string) ??
        user.email?.split("@")[0] ??
        "Panda Friend",
      email: user.email ?? null,
      picture_url: (user.user_metadata?.["avatar_url"] as string) ?? null,
    })
    .select("*")
    .single();
  if (insertError) throw insertError;
  return created;
}

export function useProfile() {
  return useQuery({ queryKey: ["profile"], queryFn: fetchProfile, staleTime: 30_000 });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await supabase.from("profiles").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useGoals(profileId?: string) {
  return useQuery({
    queryKey: ["daily_goals", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_goals")
        .select("*")
        .eq("profile_id", profileId!)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: insertError } = await supabase
        .from("daily_goals")
        .insert({ profile_id: profileId!, effective_date: todayDate(), ...DEFAULT_GOALS })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useTodayWater(profileId?: string) {
  return useQuery({
    queryKey: ["water_logs", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("amount_ml, recorded_at")
        .eq("profile_id", profileId!)
        .gte("recorded_at", startOfToday())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      const total = (data ?? []).reduce((sum, row) => sum + row.amount_ml, 0);
      return { total, count: data?.length ?? 0 };
    },
  });
}

export function useAddWater(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amount_ml: number) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("water_logs").insert({ profile_id: profileId, amount_ml });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["water_logs"] }),
  });
}

export function useTodayFood(profileId?: string) {
  return useQuery({
    queryKey: ["food_logs", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("food_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("recorded_at", startOfToday())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      const logs = data ?? [];
      const totals = logs.reduce(
        (acc, l) => ({
          calories: acc.calories + Number(l.calories),
          protein: acc.protein + Number(l.protein_g),
          carbs: acc.carbs + Number(l.carbohydrates_g),
          fat: acc.fat + Number(l.fat_g),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return { logs, totals };
    },
  });
}

export function useAddFoodLog(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      food_name: string;
      meal_type: FoodLog["meal_type"];
      calories: number;
      protein_g: number;
      carbohydrates_g: number;
      fat_g: number;
      ai_confidence?: number;
      image_url?: string | null;
    }) => {
      if (!profileId) throw new Error("no profile");
      const { data, error } = await supabase
        .from("food_logs")
        .insert({ profile_id: profileId, ...input })
        .select("id, calories")
        .single();
      if (error) throw error;
      await supabase.from("ai_scan_history").insert({
        profile_id: profileId,
        food_log_id: data.id,
        image_url: input.image_url ?? null,
        calories: input.calories,
        ai_result: { food_name: input.food_name, ai_confidence: input.ai_confidence ?? null },
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["food_logs"] });
      qc.invalidateQueries({ queryKey: ["scan_history"] });
    },
  });
}

export function useScanHistory(profileId?: string) {
  return useQuery({
    queryKey: ["scan_history", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_scan_history")
        .select("id, image_url, calories, ai_result, created_at")
        .eq("profile_id", profileId!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useWeekExercise(profileId?: string) {
  return useQuery({
    queryKey: ["exercise_logs", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("exercise_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      const logs = data ?? [];
      const minutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
      const calories = logs.reduce((s, l) => s + Number(l.calories), 0);
      const days = new Set(logs.map((l) => l.recorded_at.slice(0, 10))).size;
      return { logs, minutes, calories, days };
    },
  });
}

export function useAddExercise(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      activity_type: string;
      duration_minutes: number;
      calories: number;
      average_heart_rate?: number | null;
    }) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("exercise_logs").insert({ profile_id: profileId, ...input });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercise_logs"] }),
  });
}

export function useLatestVitals(profileId?: string) {
  return useQuery({
    queryKey: ["health_samples", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("health_samples")
        .select("metric, value, unit, recorded_at")
        .eq("profile_id", profileId!)
        .order("recorded_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const latest: Record<string, { value: number; unit: string | null; recorded_at: string }> = {};
      for (const s of data ?? []) {
        if (!latest[s.metric]) {
          latest[s.metric] = { value: Number(s.value), unit: s.unit, recorded_at: s.recorded_at };
        }
      }
      return latest;
    },
  });
}

export function useChallenges() {
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

export function useMyChallengeProgress(profileId?: string) {
  return useQuery({
    queryKey: ["challenge_participants", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenge_participants")
        .select("challenge_id, progress, completed")
        .eq("profile_id", profileId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useJoinChallenge(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase
        .from("challenge_participants")
        .upsert(
          { profile_id: profileId, challenge_id: challengeId, progress: 0 },
          { onConflict: "challenge_id,profile_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["challenge_participants"] }),
  });
}

export function useDailyStats(profileId?: string, days = 7) {
  return useQuery({
    queryKey: ["daily_statistics", profileId, days],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_statistics")
        .select("*")
        .eq("profile_id", profileId!)
        .order("stat_date", { ascending: false })
        .limit(days);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useChat(profileId?: string) {
  return useQuery({
    queryKey: ["ai_conversations", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("profile_id", profileId!)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSendChat(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ message, reply }: { message: string; reply: string }) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("ai_conversations").insert([
        { profile_id: profileId, role: "user" as const, message },
        { profile_id: profileId, role: "assistant" as const, message: reply },
      ]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai_conversations"] }),
  });
}

export function useSettings(profileId?: string) {
  return useQuery({
    queryKey: ["user_settings", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("profile_id", profileId!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data;
      const { data: created, error: insertError } = await supabase
        .from("user_settings")
        .insert({ profile_id: profileId! })
        .select("*")
        .single();
      if (insertError) throw insertError;
      return created;
    },
  });
}

export function useUpdateSettings(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Tables<"user_settings">>) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("user_settings").update(patch).eq("profile_id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_settings"] }),
  });
}
