import { describe, expect, it } from "vitest";
import { CoachInput, COACH_HISTORY_LIMIT, contextText, coachDay, mean } from "./coach.rules";
describe("coach rules", () => {
  it("rejects empty messages", () =>
    expect(CoachInput.safeParse({ message: "   " }).success).toBe(false));
  it("accepts 1000 characters", () =>
    expect(CoachInput.safeParse({ message: "ก".repeat(1000) }).success).toBe(true));
  it("rejects 1001 characters", () =>
    expect(CoachInput.safeParse({ message: "ก".repeat(1001) }).success).toBe(false));
  it("limits history to 20", () => expect(COACH_HISTORY_LIMIT).toBe(20));
  it("limits context to 1500", () => expect(contextText(["ก".repeat(1600)]).length).toBe(1500));
  it("uses Bangkok date for today", () =>
    expect(coachDay("2026-10-18T19:21:00Z")).toBe("2026-10-19"));
  it("does not invent an average when no data", () => expect(mean([])).toBe(null));
  it("averages only recorded values", () => expect(mean([2000, 6000])).toBe(4000));
});
