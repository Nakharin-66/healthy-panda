import { describe, expect, it } from "vitest";
import {
  CoachInput,
  COACH_HISTORY_LIMIT,
  contextText,
  coachDay,
  mean,
  afterConversationStart,
} from "./coach.rules";
import { bkkAddDays, bkkDayStart } from "@/lib/bkk";
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
  it("excludes old messages and the exact new-chat boundary", () => {
    const start = "2026-10-18T20:20:00.000Z";
    expect(afterConversationStart("2026-10-18T20:19:59.999Z", start)).toBe(false);
    expect(afterConversationStart(start, start)).toBe(false);
    expect(afterConversationStart("2026-10-18T20:20:00.001Z", start)).toBe(true);
  });
  it("keeps existing history before any new-chat action", () => {
    expect(afterConversationStart("2026-10-01T00:00:00Z", null)).toBe(true);
  });
  it("accepts the new-chat timestamp but rejects malformed timestamps", () => {
    expect(
      CoachInput.parse({ message: "สวัสดี", conversationStartedAt: "2026-10-18T20:20:00.000Z" })
        .conversationStartedAt,
    ).toBe("2026-10-18T20:20:00.000Z");
    expect(
      CoachInput.safeParse({ message: "สวัสดี", conversationStartedAt: "not-a-date" }).success,
    ).toBe(false);
  });
  it("defines deletion as a full Bangkok day with an exclusive next-day boundary", () => {
    expect(bkkDayStart("2026-10-19")).toBe("2026-10-18T17:00:00.000Z");
    expect(bkkDayStart(bkkAddDays("2026-10-19", 1))).toBe("2026-10-19T17:00:00.000Z");
  });
});
