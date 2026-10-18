import { describe, expect, it } from "vitest";
import { bkkAddDays, bkkDate, bkkDayStart, bkkInstant } from "./bkk";

describe("Bangkok dates", () => {
  it("02:44 Bangkok (19:44 UTC previous day) is today in Bangkok", () => {
    expect(bkkDate("2026-10-18T19:44:00Z")).toBe("2026-10-19");
  });
  it("Bangkok day starts at 17:00 UTC of the previous day", () => {
    expect(bkkDayStart("2026-10-19")).toBe("2026-10-18T17:00:00.000Z");
  });
  it("shifts calendar days", () => {
    expect(bkkAddDays("2026-10-01", -1)).toBe("2026-09-30");
  });
  it("builds an instant from Bangkok time", () => {
    expect(bkkInstant("2026-10-19", "08:30")).toBe("2026-10-19T01:30:00.000Z");
  });
});
