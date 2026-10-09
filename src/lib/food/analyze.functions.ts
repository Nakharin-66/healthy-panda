import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FoodAnalysisRequest, FoodAnalysisResult } from "@/types/food";

function validate(input: unknown): FoodAnalysisRequest {
  const value = input as Partial<FoodAnalysisRequest> | null;
  if (!value || typeof value.image_base64 !== "string" || value.image_base64.length < 32) {
    throw new Error("invalid image payload");
  }
  if (value.image_base64.length > 8_000_000) throw new Error("image too large");
  return {
    image_base64: value.image_base64,
    mime_type: typeof value.mime_type === "string" ? value.mime_type : "image/jpeg",
    ...(typeof value.hint === "string" ? { hint: value.hint.slice(0, 120) } : {}),
    locale: "th-TH",
  };
}

/** Client entry point for AI food analysis. Never calls Gemini from the browser. */
export const analyzeFoodImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data }): Promise<FoodAnalysisResult> => {
    const { requestFoodAnalysis } = await import("./analyze.server");
    return requestFoodAnalysis(data);
  });
