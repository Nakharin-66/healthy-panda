import { bkkAddDays, bkkDate } from "./bkk";

export const DEFAULT_WATER_GOAL_ML = 5000;

export function waterSegmentFill(amount: number, goal: number, index: number) {
  return Math.max(0, Math.min(1, amount / ((goal > 0 ? goal : DEFAULT_WATER_GOAL_ML) / 10) - index));
}

export function waterInRange(recordedAt: string, today: string, days = 1) {
  const day = bkkDate(recordedAt);
  return day >= bkkAddDays(today, 1 - days) && day <= today;
}

export function waterDayLabel(day: string, today = bkkDate()) {
  if (day === today) return "วันนี้";
  if (day === bkkAddDays(today, -1)) return "เมื่อวาน";
  return new Date(`${day}T12:00:00+07:00`).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric",
  });
}