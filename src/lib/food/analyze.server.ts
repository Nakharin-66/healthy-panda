import type {
  FoodAnalysisItem,
  FoodAnalysisNutrients,
  FoodAnalysisRequest,
  FoodAnalysisResult,
} from "@/types/food";

/**
 * Server-only bridge to the n8n workflow (Webhook with Header Auth).
 * Required server secrets:
 *   N8N_FOOD_WEBHOOK_URL          production webhook URL
 *   N8N_FOOD_WEBHOOK_HEADER_NAME  header name configured in the n8n Header Auth credential
 *   N8N_FOOD_WEBHOOK_TOKEN        header value configured in that credential (sent verbatim)
 * Nothing is saved here — the user reviews results before food logging saves them.
 */
export async function requestFoodAnalysis(
  input: FoodAnalysisRequest,
): Promise<FoodAnalysisResult> {
  const webhook = process.env["N8N_FOOD_WEBHOOK_URL"];
  const headerName = process.env["N8N_FOOD_WEBHOOK_HEADER_NAME"];
  const token = process.env["N8N_FOOD_WEBHOOK_TOKEN"];
  if (!webhook || !headerName || !token) {
    console.error("[food-analysis] missing config", {
      url: !!webhook,
      headerName: !!headerName,
      token: !!token,
    });
    return {
      status: "not_configured",
      message: "ยังไม่ได้เชื่อมต่อระบบวิเคราะห์ภาพด้วย AI",
      foods: [],
    };
  }

  // n8n expects plain base64; strip a data URI prefix and take its mime type.
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(input.image_base64);
  const body = {
    image_base64: match ? match[2] : input.image_base64,
    mime_type: match ? match[1] : input.mime_type,
    locale: input.locale ?? "th-TH",
  };

  let res: Response;
  try {
    res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json", [headerName]: token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("[food-analysis] request failed", err);
    return { status: "error", message: "เชื่อมต่อระบบวิเคราะห์ภาพไม่สำเร็จ หรือใช้เวลานานเกินไป", foods: [] };
  }

  const text = await res.text();
  if (!res.ok) {
    console.error("[food-analysis] n8n responded", res.status, text.slice(0, 500));
    const message =
      res.status === 403 || res.status === 401
        ? "ระบบวิเคราะห์ภาพปฏิเสธการเชื่อมต่อ (ตรวจสอบการตั้งค่า Header Auth)"
        : `ระบบวิเคราะห์ภาพตอบกลับผิดพลาด (${res.status})`;
    return { status: "error", message, foods: [] };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    console.error("[food-analysis] non-JSON response", text.slice(0, 500));
    return { status: "error", message: "ระบบวิเคราะห์ภาพตอบกลับในรูปแบบที่อ่านไม่ได้", foods: [] };
  }

  const obj = (Array.isArray(payload) ? payload[0] : payload) as Record<string, unknown> | null;
  if (!obj || !Array.isArray(obj["foods"])) {
    console.error("[food-analysis] response has no top-level foods array", text.slice(0, 500));
    return { status: "error", message: "ผลวิเคราะห์ไม่มีรายการอาหาร (foods)", foods: [] };
  }

  const foods = (obj["foods"] as unknown[]).map(normalizeItem).filter(Boolean) as FoodAnalysisItem[];
  return {
    status: "ok",
    foods,
    ...(foods.length === 0 ? { message: "AI ไม่พบอาหารในภาพนี้" } : {}),
    ...(typeof obj["source"] === "string" ? { source: obj["source"] } : {}),
    ...(typeof obj["model"] === "string" ? { model: obj["model"] } : {}),
  };
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;

const KNOWN_ITEM = new Set([
  "name", "estimated_quantity", "estimated_unit", "confidence", "matched_food_id", "estimated_nutrients",
]);
const NUTRIENT_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sodium_mg"] as const;

function normalizeItem(raw: unknown): FoodAnalysisItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r["name"] === "string" ? r["name"].trim() : "";
  if (!name) return null;

  const n = r["estimated_nutrients"];
  let nutrients: FoodAnalysisNutrients | null = null;
  if (n && typeof n === "object") {
    const src = n as Record<string, unknown>;
    nutrients = Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, num(src[k])])) as unknown as FoodAnalysisNutrients;
  }

  const extra: Record<string, string> = Object.fromEntries(
    Object.entries(r)
      .filter(([k]) => !KNOWN_ITEM.has(k))
      .map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]),
  );
  const conf = num(r["confidence"]);
  return {
    name,
    estimated_quantity: num(r["estimated_quantity"]) ?? 1,
    estimated_unit: typeof r["estimated_unit"] === "string" && r["estimated_unit"] ? r["estimated_unit"] : "จาน",
    confidence: conf === null ? null : conf > 1 ? conf / 100 : conf,
    matched_food_id: typeof r["matched_food_id"] === "string" ? r["matched_food_id"] : null,
    estimated_nutrients: nutrients,
    ...(Object.keys(extra).length ? { extra } : {}),
  };
}
