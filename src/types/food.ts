/** Shared contracts for the food logging + (future) AI vision pipeline. */

export type FoodLogSource = "manual" | "ai_scan";

/** Payload the app sends to the server, which forwards it to n8n → Gemini Vision. */
export interface FoodAnalysisRequest {
  /** base64 data URL of the captured/selected photo. */
  image_base64: string;
  mime_type: string;
  /** Optional hint typed by the user ("ผัดกะเพรา"). */
  hint?: string;
  locale?: string;
}

export interface FoodAnalysisNutrients {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  sodium_mg?: number;
}

export interface FoodAnalysisItem {
  name: string;
  estimated_quantity: number;
  estimated_unit: string;
  /** 0..1 */
  confidence: number;
  /** food_items.id when n8n matched the menu to the Thai food database. */
  matched_food_id: string | null;
  estimated_nutrients: FoodAnalysisNutrients | null;
}

export interface FoodAnalysisResult {
  status: "ok" | "not_configured" | "error";
  message?: string;
  foods: FoodAnalysisItem[];
  /** Where the nutrition numbers came from, e.g. "Thai Food Composition Database". */
  source?: string;
  model?: string;
}

export const NUTRITION_SOURCE_LABEL =
  "Thai Food Composition Database — Institute of Nutrition, Mahidol University";

export const AI_DISCLAIMER =
  "ผลการวิเคราะห์จากภาพเป็นค่าประมาณ อาจคลาดเคลื่อนตามชนิดอาหาร ปริมาณ ส่วนประกอบ และมุมภาพ กรุณาตรวจสอบก่อนบันทึก";
