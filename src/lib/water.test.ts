import { describe, expect, it } from "vitest";
import { DEFAULT_WATER_GOAL_ML, waterInRange, waterSegmentFill } from "./water";

describe("water goals and Bangkok history", () => {
  it("defaults to 5000 ml", () => expect(DEFAULT_WATER_GOAL_ML).toBe(5000));
  it("each of ten segments represents 500 ml at the default", () => {
    expect(waterSegmentFill(500, 5000, 0)).toBe(1);
    expect(waterSegmentFill(500, 5000, 1)).toBe(0);
    expect(waterSegmentFill(750, 5000, 1)).toBe(0.5);
  });
  it("respects a user's custom goal", () => expect(waterSegmentFill(125, 2500, 0)).toBe(0.5));
  it("caps segments at the goal", () => expect(waterSegmentFill(6000, 5000, 9)).toBe(1));
  it("seven-day history includes Thai midnight and excludes the previous day", () => {
    expect(waterInRange("2026-10-12T17:00:00Z", "2026-10-19", 7)).toBe(true);
    expect(waterInRange("2026-10-12T16:59:59Z", "2026-10-19", 7)).toBe(false);
  });
  it("a previous-day edit cannot enter today's total", () => {
    expect(waterInRange("2026-10-18T09:00:00Z", "2026-10-19")).toBe(false);
    expect(waterInRange("2026-10-18T17:00:00Z", "2026-10-19")).toBe(true);
  });
});