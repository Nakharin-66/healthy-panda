import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { bkkAddDays, bkkDate, bkkDayEnd, bkkDayStart } from "@/lib/bkk";
import { DEFAULT_WATER_GOAL_ML, waterInRange } from "./water";

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
  water_goal_ml: DEFAULT_WATER_GOAL_ML,
  sleep_goal_minutes: 480,
  protein_goal_g: 120,
  fat_goal_g: 65,
  carb_goal_g: 240,
};

function startOfToday() {
  return bkkDayStart(bkkDate());
}

function todayDate() {
  return bkkDate();
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

export type WaterEntry = { id: string; amount_ml: number; recorded_at: string };
export type WaterDay = { total: number; count: number; logs: WaterEntry[] };

function summarizeWater(logs: WaterEntry[]): WaterDay {
  const sorted = [...logs].sort((a, b) => (a.recorded_at < b.recorded_at ? 1 : -1));
  return { logs: sorted, total: sorted.reduce((s, r) => s + r.amount_ml, 0), count: sorted.length };
}

const waterKey = (profileId?: string, date = bkkDate()) => ["water_logs", profileId, date];

/** Water logs of one Bangkok calendar day (default: today), newest first. */
export function useTodayWater(profileId?: string, date = bkkDate()) {
  return useQuery({
    queryKey: waterKey(profileId, date),
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("water_logs")
        .select("id, amount_ml, recorded_at")
        .eq("profile_id", profileId!)
        .gte("recorded_at", bkkDayStart(date))
        .lte("recorded_at", bkkDayEnd(date))
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return summarizeWater(data ?? []);
    },
  });
}

export function useWaterHistory(profileId: string | undefined, days: number, enabled: boolean) {
  const today = bkkDate();
  return useQuery({
    queryKey: ["water_logs", profileId, today, days],
    enabled: !!profileId && enabled,
    queryFn: async () => {
      if (!profileId) return summarizeWater([]);
      const { data, error } = await supabase.from("water_logs")
        .select("id, amount_ml, recorded_at").eq("profile_id", profileId)
        .gte("recorded_at", bkkDayStart(bkkAddDays(today, 1 - days)))
        .lte("recorded_at", bkkDayEnd(today)).order("recorded_at", { ascending: false });
      if (error) throw error;
      return summarizeWater(data ?? []);
    },
  });
}

function useWaterMutation<V>(
  profileId: string | undefined,
  run: (v: V) => Promise<void>,
  apply: (logs: WaterEntry[], v: V) => WaterEntry[],
) {
  const qc = useQueryClient();
  const prefix = ["water_logs", profileId];
  return useMutation({
    mutationFn: async (v: V) => {
      if (!profileId) throw new Error("no profile");
      await run(v);
    },
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: prefix });
      const previous = qc.getQueriesData<WaterDay>({ queryKey: prefix });
      for (const [key, prev] of previous) {
        if (!prev) continue;
        const date = typeof key[2] === "string" ? key[2] : bkkDate();
        const days = typeof key[3] === "number" ? key[3] : 1;
        qc.setQueryData(key, summarizeWater(apply(prev.logs, v).filter((l) => waterInRange(l.recorded_at, date, days))));
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      for (const [key, previous] of ctx?.previous ?? []) qc.setQueryData(key, previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["water_logs"] }),
  });
}

export function useAddWater(profileId?: string) {
  return useWaterMutation<number>(
    profileId,
    async (amount_ml) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("water_logs").insert({ profile_id: profileId, amount_ml });
      if (error) throw error;
    },
    (logs, amount_ml) => [
      { id: `local-${Date.now()}`, amount_ml, recorded_at: new Date().toISOString() },
      ...logs,
    ],
  );
}

export function useUpdateWater(profileId?: string) {
  return useWaterMutation<{ id: string; amount_ml: number; recorded_at: string }>(
    profileId,
    async ({ id, amount_ml, recorded_at }) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase
        .from("water_logs")
        .update({ amount_ml, recorded_at })
        .eq("id", id).eq("profile_id", profileId).select("id").single();
      if (error) throw error;
    },
    (logs, v) =>
      logs
        .map((l) => (l.id === v.id ? { ...l, ...v } : l)),
  );
}

export function useDeleteWater(profileId?: string) {
  return useWaterMutation<string>(
    profileId,
    async (id) => {
      if (!profileId) throw new Error("no profile");
      const { error } = await supabase.from("water_logs").delete().eq("id", id).eq("profile_id", profileId).select("id").single();
      if (error) throw error;
    },
    (logs, id) => logs.filter((l) => l.id !== id),
  );
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
