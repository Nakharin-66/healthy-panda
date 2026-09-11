import type { FoodAnalysisRequest, FoodAnalysisResult } from "@/types/food";

/**
 * Server-only bridge to the n8n workflow:
 *   n8n Webhook → Gemini Vision → food identification → portion estimation
 *   → Thai food database match → nutrition calculation → back to the app.
 *
 * The AI backend is not wired yet: without N8N_FOOD_WEBHOOK_URL we report
 * `not_configured` instead of inventing calorie values.
 */
export async function requestFoodAnalysis(
  input: FoodAnalysisRequest,
): Promise<FoodAnalysisResult> {
  const webhook = process.env["N8N_FOOD_WEBHOOK_URL"];
  if (!webhook) {
    return {
      status: "not_configured",
      message: "ยังไม่ได้เชื่อมต่อระบบวิเคราะห์ภาพด้วย AI",
      foods: [],
    };
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env["N8N_FOOD_WEBHOOK_TOKEN"]
          ? { Authorization: `Bearer ${process.env["N8N_FOOD_WEBHOOK_TOKEN"]}` }
          : {}),
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      return {
        status: "error",
        message: `ระบบวิเคราะห์ภาพตอบกลับผิดพลาด (${res.status})`,
        foods: [],
      };
    }

    const payload = (await res.json()) as Partial<FoodAnalysisResult>;
    return {
      status: "ok",
      foods: Array.isArray(payload.foods) ? payload.foods : [],
      ...(payload.source ? { source: payload.source } : {}),
      ...(payload.model ? { model: payload.model } : {}),
    };
  } catch {
    return { status: "error", message: "เชื่อมต่อระบบวิเคราะห์ภาพไม่สำเร็จ", foods: [] };
  }
}
