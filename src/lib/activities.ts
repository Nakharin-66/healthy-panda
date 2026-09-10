import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ActivityType = Tables<"activity_types">;
export type ActivityLog = Tables<"activity_logs">;
export type ExerciseGoal = Tables<"exercise_goals">;

export const DEFAULT_WEIGHT_KG = 60;

/** Calories = MET x weight(kg) x duration(hours) — never user-editable. */
export function calcCalories(met: number, weightKg: number, minutes: number) {
  return Math.round(met * weightKg * (minutes / 60));
}

/* ---------------- distance (extension, optional) ---------------- */

export const KM_PER_MILE = 1.609344;
export const MAX_DISTANCE_KM = 999;

export type DistanceSource = "health_connect" | "apple_health" | "smartwatch" | "manual" | "unknown";

export const DISTANCE_SOURCE_LABELS: Record<DistanceSource, string> = {
  health_connect: "ซิงก์จาก Health Connect",
  apple_health: "ซิงก์จาก Apple Health",
  smartwatch: "ซิงก์จากสมาร์ทวอทช์",
  manual: "กรอกเอง",
  unknown: "ไม่ทราบแหล่งที่มา",
};

/** Activities where distance is meaningful (name keyword or category based). */
const DISTANCE_KEYWORDS = [
  "เดิน",
  "วิ่ง",
  "จ๊อก",
  "ปั่น",
  "จักรยาน",
  "ว่ายน้ำ",
  "เดินป่า",
  "พาย",
  "กรรเชียง",
  "โรว",
  "สเก็ต",
  "รถเข็น",
  "walk",
  "run",
  "jog",
  "cycl",
  "bike",
  "swim",
  "hik",
  "row",
  "skat",
  "wheelchair",
];

export function supportsDistance(type?: { name: string; category: string } | null) {
  if (!type) return false;
  const n = type.name.toLowerCase();
  return DISTANCE_KEYWORDS.some((k) => n.includes(k));
}

export function kmToUnit(km: number, unit: "km" | "mi") {
  return unit === "mi" ? km / KM_PER_MILE : km;
}

export function unitToKm(value: number, unit: "km" | "mi") {
  return unit === "mi" ? value * KM_PER_MILE : value;
}

export function formatDistanceKm(km: number) {
  return `${km.toLocaleString("th-TH", { maximumFractionDigits: 2 })} กม.`;
}

type DistanceSample = {
  value: number;
  recorded_at: string;
  source: string | null;
  device_kind: string | null;
};

function sampleSource(s: DistanceSample): DistanceSource {
  const raw = `${s.device_kind ?? ""} ${s.source ?? ""}`.toLowerCase();
  if (raw.includes("health_connect")) return "health_connect";
  if (raw.includes("apple")) return "apple_health";
  if (raw.includes("watch")) return "smartwatch";
  return "unknown";
}

/** Synced distance samples (Health Connect / Apple Health / smartwatch) for matching logs. */
export function useDistanceSamples(profileId?: string) {
  return useQuery({
    queryKey: ["distance_samples", profileId],
    enabled: !!profileId,
    queryFn: async (): Promise<DistanceSample[]> => {
      const since = new Date();
      since.setDate(since.getDate() - 60);
      const { data, error } = await supabase
        .from("health_samples")
        .select("value, recorded_at, source, health_devices(device_kind)")
        .eq("profile_id", profileId!)
        .eq("metric", "distance_km")
        .gte("recorded_at", since.toISOString())
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        value: Number(r.value),
        recorded_at: r.recorded_at,
        source: r.source,
        device_kind:
          (r as { health_devices?: { device_kind: string } | null }).health_devices?.device_kind ?? null,
      }));
    },
  });
}

const SOURCE_PRIORITY: DistanceSource[] = ["health_connect", "apple_health", "smartwatch", "unknown"];

/** Picks the best synced distance overlapping an activity window; null when none. */
export function matchSyncedDistance(
  samples: DistanceSample[] | undefined,
  performedAt: string,
  durationMinutes: number,
): { km: number; source: DistanceSource } | null {
  if (!samples?.length) return null;
  const start = new Date(performedAt).getTime();
  const end = start + Math.max(durationMinutes, 1) * 60_000;
  const pad = 15 * 60_000;
  const inWindow = samples.filter((s) => {
    const t = new Date(s.recorded_at).getTime();
    return t >= start - pad && t <= end + pad;
  });
  if (!inWindow.length) return null;

  for (const src of SOURCE_PRIORITY) {
    const bucket = inWindow.filter((s) => sampleSource(s) === src);
    if (bucket.length) {
      const km = bucket.reduce((s, x) => s + x.value, 0);
      if (km > 0) return { km: Math.round(km * 100) / 100, source: src };
    }
  }
  return null;
}

export const ACTIVITY_CATEGORIES = [
  { value: "cardio", label: "คาร์ดิโอ" },
  { value: "strength", label: "เวท/กล้ามเนื้อ" },
  { value: "flexibility", label: "ยืดเหยียด" },
  { value: "sport", label: "กีฬา" },
  { value: "other", label: "อื่น ๆ" },
] as const;

export const GOAL_TYPES = [
  { value: "minutes", label: "นาทีออกกำลังกาย", unit: "นาที" },
  { value: "calories", label: "แคลอรีที่เผาผลาญ", unit: "kcal" },
  { value: "steps", label: "จำนวนก้าว", unit: "ก้าว" },
  { value: "sessions", label: "จำนวนครั้ง", unit: "ครั้ง" },
  { value: "distance", label: "ระยะทาง", unit: "กม." },
  { value: "days", label: "จำนวนวัน", unit: "วัน" },
  { value: "custom", label: "กำหนดเอง", unit: "หน่วย" },
] as const;

export const GOAL_TEMPLATES = [
  { name: "ออกกำลังกาย 150 นาที/สัปดาห์", goal_type: "minutes", target_value: 150, unit: "นาที", period: "weekly" },
  { name: "เผาผลาญ 2,000 kcal สัปดาห์นี้", goal_type: "calories", target_value: 2000, unit: "kcal", period: "weekly" },
  { name: "เดิน 10,000 ก้าวทุกวัน", goal_type: "steps", target_value: 10000, unit: "ก้าว", period: "daily" },
  { name: "ออกกำลังกาย 5 ครั้งสัปดาห์นี้", goal_type: "sessions", target_value: 5, unit: "ครั้ง", period: "weekly" },
  { name: "วิ่ง 20 กม. เดือนนี้", goal_type: "distance", target_value: 20, unit: "กม.", period: "monthly" },
  { name: "ว่ายน้ำ 2 ครั้งสัปดาห์นี้", goal_type: "sessions", target_value: 2, unit: "ครั้ง", period: "weekly" },
  { name: "ออกกำลังกาย 4 วันต่อสัปดาห์", goal_type: "days", target_value: 4, unit: "วัน", period: "weekly" },
] as const;

const ACTIVITY_KEYS = [["activity_types"], ["activity_logs"], ["exercise_goals"]];

/** Live-refreshes every exercise surface (dashboard, stats, goals) on any change. */
export function useActivityRealtime(profileId?: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`activity-sync-${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_logs" }, () => {
        qc.invalidateQueries({ queryKey: ["activity_logs"] });
        qc.invalidateQueries({ queryKey: ["exercise_goals"] });
        qc.invalidateQueries({ queryKey: ["daily_statistics"] });
        qc.invalidateQueries({ queryKey: ["exercise_logs"] });
        qc.invalidateQueries({ queryKey: ["ai_recommendations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_types" }, () => {
        qc.invalidateQueries({ queryKey: ["activity_types"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "exercise_goals" }, () => {
        qc.invalidateQueries({ queryKey: ["exercise_goals"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "health_samples" }, () => {
        qc.invalidateQueries({ queryKey: ["distance_samples"] });
        qc.invalidateQueries({ queryKey: ["health_samples"] });
        qc.invalidateQueries({ queryKey: ["activity_logs"] });
        qc.invalidateQueries({ queryKey: ["exercise_goals"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, qc]);
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ACTIVITY_KEYS) qc.invalidateQueries({ queryKey: key });
  qc.invalidateQueries({ queryKey: ["daily_statistics"] });
  qc.invalidateQueries({ queryKey: ["exercise_logs"] });
}

/* ---------------- activity types ---------------- */

export function useActivityTypes(profileId?: string) {
  return useQuery({
    queryKey: ["activity_types", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_types")
        .select("*")
        .order("is_builtin", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ActivityTypeInput = {
  name: string;
  category: string;
  icon: string;
  met_value: number;
  description?: string | null;
};

export function useSaveActivityType(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ActivityTypeInput & { id?: string }) => {
      if (!profileId) throw new Error("no profile");
      if (id) {
        const { error } = await supabase.from("activity_types").update(input).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("activity_types")
        .insert({ ...input, profile_id: profileId, is_builtin: false });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activity_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

/* ---------------- activity logs ---------------- */

export function useActivityLogs(profileId?: string, days = 30) {
  return useQuery({
    queryKey: ["activity_logs", profileId, days],
    enabled: !!profileId,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - (days - 1));
      since.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("profile_id", profileId!)
        .is("deleted_at", null)
        .gte("performed_at", since.toISOString())
        .order("performed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ActivityLogInput = {
  id?: string;
  activity_type_id: string;
  activity_name: string;
  met_value: number;
  duration_minutes: number;
  performed_at: string;
  notes?: string | null;
  distance_km?: number | null;
  distance_source?: DistanceSource | null;
  distance_synced?: boolean;
};

export function useSaveActivityLog(profileId?: string, weightKg?: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ActivityLogInput) => {
      if (!profileId) throw new Error("no profile");
      const weight = Number(weightKg) > 0 ? Number(weightKg) : DEFAULT_WEIGHT_KG;
      const row = {
        ...input,
        weight_kg: weight,
        calories: calcCalories(input.met_value, weight, input.duration_minutes),
      };
      if (id) {
        const { error } = await supabase.from("activity_logs").update(row).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("activity_logs").insert({ ...row, profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useSoftDeleteActivityLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, restore }: { id: string; restore?: boolean }) => {
      const { error } = await supabase
        .from("activity_logs")
        .update({ deleted_at: restore ? null : new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, restore }) => {
      if (restore) return;
      await qc.cancelQueries({ queryKey: ["activity_logs"] });
      qc.setQueriesData<ActivityLog[]>({ queryKey: ["activity_logs"] }, (old) =>
        (old ?? []).filter((l) => l.id !== id),
      );
    },
    onSettled: () => invalidateAll(qc),
  });
}

/* ---------------- goals ---------------- */

export function useExerciseGoals(profileId?: string) {
  return useQuery({
    queryKey: ["exercise_goals", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_goals")
        .select("*")
        .eq("profile_id", profileId!)
        .neq("status", "archived")
        .order("end_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type GoalInput = {
  id?: string;
  name: string;
  goal_type: string;
  target_value: number;
  unit: string;
  period: string;
  start_date: string;
  end_date: string;
};

export function useSaveGoal(profileId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: GoalInput) => {
      if (!profileId) throw new Error("no profile");
      if (id) {
        const { error } = await supabase.from("exercise_goals").update(input).eq("id", id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("exercise_goals").insert({ ...input, profile_id: profileId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercise_goals"] }),
  });
}

export function useArchiveGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercise_goals").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise_goals"] });
      qc.invalidateQueries({ queryKey: ["exercise_goals_archived"] });
    },
  });
}

/** Archived goals = "ประวัติเป้าหมายของฉัน" (goal history / คลัง). */
export function useArchivedGoals(profileId?: string) {
  return useQuery({
    queryKey: ["exercise_goals_archived", profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exercise_goals")
        .select("*")
        .eq("profile_id", profileId!)
        .eq("status", "archived")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRestoreGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("exercise_goals").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise_goals"] });
      qc.invalidateQueries({ queryKey: ["exercise_goals_archived"] });
    },
  });
}

/** Permanent delete — removes linked progress rows first (FK). */
export function useDeleteGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: pErr } = await supabase.from("goal_progress").delete().eq("goal_id", id);
      if (pErr) throw pErr;
      const { error } = await supabase.from("exercise_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exercise_goals"] });
      qc.invalidateQueries({ queryKey: ["exercise_goals_archived"] });
    },
  });
}

/** Days left (>=0) or days overdue for a goal's end date. */
export function goalDeadline(goal: ExerciseGoal) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(goal.end_date);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  return {
    daysLeft: diff,
    expired: diff < 0,
    daysOverdue: diff < 0 ? -diff : 0,
    isLastDay: diff === 0,
  };
}

/** Progress derived from activity logs — goals never influence calorie math. */
export function goalProgress(goal: ExerciseGoal, logs: ActivityLog[]) {
  const start = new Date(goal.start_date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(goal.end_date);
  end.setHours(23, 59, 59, 999);
  const inRange = logs.filter((l) => {
    const t = new Date(l.performed_at);
    return t >= start && t <= end;
  });

  let value = 0;
  switch (goal.goal_type) {
    case "minutes":
      value = inRange.reduce((s, l) => s + l.duration_minutes, 0);
      break;
    case "calories":
      value = inRange.reduce((s, l) => s + Number(l.calories), 0);
      break;
    case "sessions":
      value = inRange.length;
      break;
    case "days":
      value = new Set(inRange.map((l) => l.performed_at.slice(0, 10))).size;
      break;
    case "distance":
      value = inRange.reduce((s, l) => s + Number(l.distance_km ?? 0), 0);
      break;
    default:
      value = inRange.length;
  }
  const target = Number(goal.target_value) || 1;
  const pct = Math.min(Math.round((value / target) * 100), 100);
  const rounded = goal.goal_type === "distance" ? Math.round(value * 100) / 100 : Math.round(value);
  return { value: rounded, pct, done: pct >= 100 };
}

/** Total distance (km) across logs — 0 when no log carries distance. */
export function totalDistanceKm(logs: ActivityLog[]) {
  return Math.round(logs.reduce((s, l) => s + Number(l.distance_km ?? 0), 0) * 100) / 100;
}
