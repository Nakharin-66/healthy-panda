import { z } from "zod";
export const CoachInput = z.object({
  message: z
    .string()
    .trim()
    .min(1, "กรุณาพิมพ์ข้อความ")
    .max(1000, "ข้อความต้องไม่เกิน 1000 ตัวอักษร"),
  conversationStartedAt: z.string().datetime().optional(),
});
export const COACH_HISTORY_LIMIT = 20;
export const COACH_CONTEXT_LIMIT = 1500;
export const coachDay = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
export function contextText(sections: string[]) {
  return (sections.length ? sections.join("\n") : "ยังไม่มีข้อมูลสุขภาพที่บันทึกไว้").slice(
    0,
    COACH_CONTEXT_LIMIT,
  );
}
export const mean = (values: number[]) =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;

/** Shared strict boundary for the visible conversation and server AI history. */
export function afterConversationStart(createdAt: string, startedAt?: string | null) {
  return !startedAt || Date.parse(createdAt) > Date.parse(startedAt);
}
