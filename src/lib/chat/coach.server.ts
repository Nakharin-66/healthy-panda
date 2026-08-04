import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type DB = SupabaseClient<Database>;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

export const COACH_SYSTEM_PROMPT = `You are "Healthy Panda AI Coach", a friendly, professional, motivational and evidence-based health coach inside a Thai health app.

Rules:
- ALWAYS analyse the user's own data provided in the USER CONTEXT block before answering. Reference concrete numbers from it.
- If a data point is missing from the context, say it is not recorded yet and invite the user to log it. NEVER invent or estimate data as if it were recorded.
- NEVER diagnose diseases or replace medical professionals. If asked for a diagnosis or medical treatment, kindly recommend consulting a healthcare professional.
- Reply in the same language the user writes in (Thai users get Thai).
- Use markdown, and structure answers with these headings when relevant:
  **สรุป (Summary)** / **วิเคราะห์ (Analysis)** / **คำแนะนำ (Recommendation)** / **ก้าวต่อไป (Next Step)**
- Keep it concise (under ~250 words), use bullet points, and end with encouragement.`;

/** Anything the coach knows about the user. Extended later by Health Connect. */
export type UserContext = Record<string, unknown>;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function round(n: number, digits = 1) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function age(birthday: string | null) {
  if (!birthday) return null;
  const b = new Date(birthday);
  if (Number.isNaN(b.getTime())) return null;
  return Math.floor((Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000));
}

/**
 * Collects the signed-in user's health data. Every section is optional —
 * missing data is omitted rather than faked. Health Connect metrics arrive
 * through `health_samples` and are picked up here automatically.
 */
export async function buildUserContext(supabase: DB, profileId: string): Promise<UserContext> {
  const today = startOfToday();
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();

  const [profileRes, goalsRes, foodRes, waterRes, activityRes, exerciseGoalsRes, samplesRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", profileId).maybeSingle(),
      supabase
        .from("daily_goals")
        .select("*")
        .eq("profile_id", profileId)
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("food_logs").select("*").eq("profile_id", profileId).gte("recorded_at", today),
      supabase.from("water_logs").select("amount_ml").eq("profile_id", profileId).gte("recorded_at", today),
      supabase
        .from("activity_logs")
        .select("activity_name, duration_minutes, calories, distance_km, performed_at")
        .eq("profile_id", profileId)
        .is("deleted_at", null)
        .gte("performed_at", weekAgo)
        .order("performed_at", { ascending: false })
        .limit(15),
      supabase
        .from("exercise_goals")
        .select("name, goal_type, target_value, unit, period, status, start_date, end_date")
        .eq("profile_id", profileId)
        .eq("status", "active"),
      supabase
        .from("health_samples")
        .select("metric, value, unit, recorded_at")
        .eq("profile_id", profileId)
        .order("recorded_at", { ascending: false })
        .limit(100),
    ]);

  const ctx: UserContext = {};

  const p = profileRes.data;
  if (p) {
    const heightM = p.height_cm ? Number(p.height_cm) / 100 : null;
    const weight = p.weight_kg ? Number(p.weight_kg) : null;
    ctx["profile"] = {
      name: p.display_name,
      age: age(p.birthday),
      gender: p.gender,
      height_cm: p.height_cm ? Number(p.height_cm) : undefined,
      weight_kg: weight ?? undefined,
      bmi: heightM && weight ? round(weight / (heightM * heightM)) : undefined,
      target_weight_kg: p.target_weight_kg ? Number(p.target_weight_kg) : undefined,
      activity_level: p.activity_level,
      streak_days: p.streak_days,
    };
  }

  if (goalsRes.data) {
    const g = goalsRes.data;
    ctx["daily_targets"] = {
      calories: g.calories_goal,
      protein_g: g.protein_goal_g,
      carbs_g: g.carb_goal_g,
      fat_g: g.fat_goal_g,
      water_ml: g.water_goal_ml,
      steps: g.steps_goal,
      sleep_minutes: g.sleep_goal_minutes,
    };
  }

  const foods = foodRes.data ?? [];
  if (foods.length) {
    const totals = foods.reduce(
      (a, f) => ({
        calories: a.calories + Number(f.calories),
        protein_g: a.protein_g + Number(f.protein_g),
        carbs_g: a.carbs_g + Number(f.carbohydrates_g),
        fat_g: a.fat_g + Number(f.fat_g),
      }),
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
    );
    ctx["nutrition_today"] = {
      totals: {
        calories: round(totals.calories),
        protein_g: round(totals.protein_g),
        carbs_g: round(totals.carbs_g),
        fat_g: round(totals.fat_g),
      },
      meals: foods.map((f) => ({
        name: f.food_name,
        meal: f.meal_type,
        calories: round(Number(f.calories)),
      })),
    };
  }

  const water = waterRes.data ?? [];
  if (water.length) {
    ctx["water_today_ml"] = water.reduce((s, w) => s + w.amount_ml, 0);
  }

  const acts = activityRes.data ?? [];
  if (acts.length) {
    ctx["exercise_last_7_days"] = {
      total_minutes: acts.reduce((s, a) => s + a.duration_minutes, 0),
      total_calories_burned: round(acts.reduce((s, a) => s + Number(a.calories), 0)),
      total_distance_km: round(acts.reduce((s, a) => s + Number(a.distance_km ?? 0), 0)),
      sessions: acts.slice(0, 8).map((a) => ({
        activity: a.activity_name,
        minutes: a.duration_minutes,
        calories: round(Number(a.calories)),
        distance_km: a.distance_km ? Number(a.distance_km) : undefined,
        at: a.performed_at,
      })),
    };
  }

  if (exerciseGoalsRes.data?.length) {
    ctx["active_goals"] = exerciseGoalsRes.data.map((g) => ({
      name: g.name,
      type: g.goal_type,
      target: `${g.target_value} ${g.unit} / ${g.period}`,
      window: `${g.start_date} → ${g.end_date}`,
    }));
  }

  const samples = samplesRes.data ?? [];
  if (samples.length) {
    const latest: Record<string, { value: number; unit: string | null; recorded_at: string }> = {};
    for (const s of samples) {
      if (!latest[s.metric]) {
        latest[s.metric] = { value: Number(s.value), unit: s.unit, recorded_at: s.recorded_at };
      }
    }
    ctx["health_metrics"] = latest;
  }

  return ctx;
}

export type CoachTurn = { role: "user" | "assistant"; content: string };

/** Calls Gemini through the Lovable AI Gateway and returns the reply text. */
export async function generateCoachReply(input: {
  prompt: string;
  history: CoachTurn[];
  userContext: UserContext;
}): Promise<{ message: string; model: string }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured");

  const contextBlock = Object.keys(input.userContext).length
    ? JSON.stringify(input.userContext, null, 1)
    : "No health data recorded yet.";

  const messages = [
    { role: "system", content: COACH_SYSTEM_PROMPT },
    {
      role: "system",
      content: `USER CONTEXT (from the user's own records, current time ${new Date().toISOString()}):\n${contextBlock}`,
    },
    ...input.history.slice(-10),
    { role: "user", content: input.prompt },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`AI gateway error [${res.status}]: ${body}`);
      if (res.status === 429) throw new Error("มีคำขอมากเกินไป กรุณาลองใหม่ในอีกสักครู่");
      if (res.status === 402) throw new Error("เครดิต AI หมด กรุณาเติมเครดิตเพื่อใช้โค้ช AI ต่อ");
      throw new Error("โค้ช AI ไม่พร้อมใช้งานชั่วคราว ลองอีกครั้งนะ");
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const message = json.choices?.[0]?.message?.content?.trim();
    if (!message) throw new Error("โค้ช AI ตอบกลับไม่สำเร็จ ลองอีกครั้งนะ");
    return { message, model: MODEL };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("หมดเวลารอคำตอบจากโค้ช AI ลองอีกครั้งนะ");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
