import { useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PrimaryGoal = "weight" | "exercise" | "daily_activity" | "nutrition" | "overall";
export type GuestActivity = "sedentary" | "light" | "moderate" | "active";
export type GuestSex = "male" | "female" | "undisclosed";

export type GuestOnboarding = {
  nickname: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: GuestSex;
  primary_goal: PrimaryGoal;
  target_weight_kg: number | null;
  activity_level: GuestActivity;
  completed: boolean;
  saved_at: string;
};

const KEY = "hp_guest_onboarding";
const RETURN_KEY = "hp_auth_return_to";

export const GOAL_LABELS: Record<PrimaryGoal, string> = {
  weight: "ควบคุมน้ำหนัก",
  exercise: "เพิ่มการออกกำลังกาย",
  daily_activity: "เพิ่มกิจกรรมในชีวิตประจำวัน",
  nutrition: "ดูแลโภชนาการ",
  overall: "ดูแลสุขภาพโดยรวม",
};

export const ACTIVITY_LABELS: Record<GuestActivity, string> = {
  sedentary: "นั่ง/ทำงานเป็นส่วนใหญ่",
  light: "เคลื่อนไหวเล็กน้อย",
  moderate: "ออกกำลังกายเป็นประจำ",
  active: "กิจกรรมค่อนข้างสูง",
};

export function readGuest(): GuestOnboarding | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestOnboarding) : null;
  } catch {
    return null;
  }
}

export function writeGuest(data: GuestOnboarding) {
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearGuest() {
  window.localStorage.removeItem(KEY);
}

/** Starter recommendations (general guidance, editable later). */
export function starterGoals(d: Pick<GuestOnboarding, "weight_kg" | "activity_level" | "primary_goal">) {
  const baseSteps = { sedentary: 6000, light: 7500, moderate: 9000, active: 10000 }[d.activity_level];
  const bump = d.primary_goal === "weight" || d.primary_goal === "daily_activity" ? 1000 : 0;
  const steps = Math.min(12000, baseSteps + bump);
  const water = d.weight_kg ? Math.round((d.weight_kg * 33) / 100) * 100 : 2000;
  const baseEx = { sedentary: 90, light: 120, moderate: 150, active: 200 }[d.activity_level];
  const exercise = d.primary_goal === "exercise" || d.primary_goal === "weight" ? Math.max(150, baseEx) : baseEx;
  return { steps, water_ml: Math.min(4000, Math.max(1500, water)), exercise_min_week: exercise };
}

/* ---------- Auth modal store ---------- */
let modalOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
export function openAuthModal() {
  modalOpen = true;
  emit();
}
export function closeAuthModal() {
  modalOpen = false;
  emit();
}
export function useAuthModalOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => modalOpen,
    () => false,
  );
}

/* ---------- Google OAuth (same-tab redirect) ---------- */
function safePath(p: string | null | undefined) {
  if (!p || !p.startsWith("/") || p.startsWith("//") || p.startsWith("/auth")) return "/dashboard";
  return p;
}

export async function signInWithGoogle(returnTo?: string) {
  window.sessionStorage.setItem(
    RETURN_KEY,
    safePath(returnTo ?? window.location.pathname + window.location.search),
  );
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}

export function takeReturnTo() {
  const p = window.sessionStorage.getItem(RETURN_KEY);
  window.sessionStorage.removeItem(RETURN_KEY);
  return safePath(p);
}

/* ---------- Guest -> profile sync ---------- */
export async function syncGuestToProfile(): Promise<boolean> {
  const guest = readGuest();
  if (!guest?.completed) return false;
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return false;

  const { data: existing, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;

  const patch = {
    display_name: guest.nickname.trim() || user.email?.split("@")[0] || "Panda Friend",
    age: guest.age,
    gender: guest.sex,
    height_cm: guest.height_cm,
    weight_kg: guest.weight_kg,
    target_weight_kg: guest.primary_goal === "weight" ? guest.target_weight_kg : null,
    primary_goal: guest.primary_goal,
    activity_level: guest.activity_level,
    onboarding_completed: true,
  };

  if (existing) {
    const { error: e } = await supabase.from("profiles").update(patch).eq("id", existing.id);
    if (e) throw e;
  } else {
    const { error: e } = await supabase.from("profiles").insert({
      ...patch,
      user_id: user.id,
      email: user.email ?? null,
      picture_url: (user.user_metadata?.["avatar_url"] as string) ?? null,
    });
    if (e) throw e;
  }
  clearGuest();
  return true;
}
