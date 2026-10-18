import type {
  FoodAnalysisItem,
  FoodAnalysisNutrients,
  FoodAnalysisRequest,
  FoodAnalysisResult,
} from "@/types/food";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-2.5-flash";

const SYSTEM_PROMPT = [
  "คุณคือผู้เชี่ยวชาญด้านโภชนาการอาหารไทยและอาหารทั่วไป",
  "วิเคราะห์อาหารทุกรายการที่เห็นในภาพ แล้วตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่นนอก JSON",
  'รูปแบบ: {"foods":[{"name":"ชื่ออาหารภาษาไทย","estimated_quantity":ตัวเลข,"estimated_unit":"จาน/ชาม/แก้ว/ชิ้น/ถ้วย","confidence":ตัวเลข0ถึง1,"estimated_nutrients":{"calories":ตัวเลข,"protein_g":ตัวเลข,"carbs_g":ตัวเลข,"fat_g":ตัวเลข,"fiber_g":ตัวเลข,"sodium_mg":ตัวเลข}}]}',
  "ค่าโภชนาการคือค่าประมาณต่อจำนวนที่ระบุใน estimated_quantity ทั้งหมด (ไม่ใช่ต่อ 100 กรัม)",
  'ถ้าในภาพไม่มีอาหาร ให้ตอบ {"foods":[]}',
].join("\n");

export async function requestFoodAnalysis(
  input: FoodAnalysisRequest,
): Promise<FoodAnalysisResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[food-analysis] LOVABLE_API_KEY is missing");
    return {
      status: "not_configured",
      message: "ยังไม่ได้เปิดใช้ Lovable AI ในโปรเจกต์นี้ (ไม่พบ LOVABLE_API_KEY) กรุณาเปิดใช้ Lovable AI หรือเพิ่มคีย์ Gemini ตามที่ระบบแนะนำ",
      foods: [],
    };
  }

  const match = /^data:([^;,]+);base64,(.*)$/s.exec(input.image_base64);
  const mimeType = match ? match[1] : input.mime_type || "image/jpeg";
  const base64 = match ? match[2] : input.image_base64;
  if (!base64) {
    return { status: "error", message: "ไม่พบข้อมูลรูปภาพ", foods: [] };
  }

  let res: Response;
  try {
    res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "วิเคราะห์อาหารในภาพนี้" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.error("[food-analysis] request failed", err);
    return { status: "error", message: "เชื่อมต่อระบบวิเคราะห์ภาพไม่สำเร็จ หรือใช้เวลานานเกินไป", foods: [] };
  }

  const text = await res.text();
  if (!res.ok) {
    console.error("[food-analysis] AI gateway responded", res.status, text.slice(0, 500));
    const message =
      res.status === 429
        ? "มีการใช้งานระบบวิเคราะห์ภาพถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
        : res.status === 402
          ? "เครดิตการใช้งาน AI ไม่เพียงพอ"
          : `ระบบวิเคราะห์ภาพตอบกลับผิดพลาด (${res.status})`;
    return { status: "error", message, foods: [] };
  }

  let content = "";
  try {
    const data = JSON.parse(text) as { choices?: { message?: { content?: unknown } }[] };
    const c = data.choices?.[0]?.message?.content;
    content = typeof c === "string" ? c : "";
  } catch {
    console.error("[food-analysis] gateway returned non-JSON", text.slice(0, 500));
    return { status: "error", message: "ระบบวิเคราะห์ภาพตอบกลับในรูปแบบที่อ่านไม่ได้", foods: [] };
  }

  let parsed: unknown;
  try {
    const cleaned = content.replace(/```json|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    parsed = JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned);
  } catch {
    console.error("[food-analysis] cannot parse model output", content.slice(0, 500));
    return { status: "error", message: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้ กรุณาลองถ่ายภาพใหม่", foods: [] };
  }

  const obj = parsed as Record<string, unknown> | null;
  const rawFoods = obj && Array.isArray(obj["foods"]) ? (obj["foods"] as unknown[]) : [];
  const foods = rawFoods.map(normalizeItem).filter(Boolean) as FoodAnalysisItem[];

  return {
    status: "ok",
    foods,
    ...(foods.length === 0 ? { message: "AI ไม่พบอาหารในภาพนี้" } : {}),
    source: "lovable-ai",
    model: AI_MODEL,
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
