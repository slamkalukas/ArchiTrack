import { describe, expect, it } from "vitest";
import { dayKey, isExpiringSoon, isOverdue } from "@/components/shared/date-helpers";

const NOW = new Date("2026-07-02T12:00:00.000Z");

describe("isOverdue", () => {
  it("returns false when there is no due date", () => {
    expect(isOverdue(null, NOW)).toBe(false);
    expect(isOverdue(undefined, NOW)).toBe(false);
  });

  it("returns true for a due date in the past", () => {
    expect(isOverdue("2026-06-01T00:00:00.000Z", NOW)).toBe(true);
  });

  it("returns false for a due date in the future", () => {
    expect(isOverdue("2026-08-01T00:00:00.000Z", NOW)).toBe(false);
  });
});

describe("isExpiringSoon", () => {
  it("returns false when there is no validUntil date", () => {
    expect(isExpiringSoon(null, NOW)).toBe(false);
  });

  it("returns false once the date has already passed", () => {
    expect(isExpiringSoon("2026-06-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("returns true when the date is within the next 30 days", () => {
    expect(isExpiringSoon("2026-07-20T00:00:00.000Z", NOW)).toBe(true);
  });

  it("returns false when the date is more than 30 days out", () => {
    expect(isExpiringSoon("2026-09-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("treats the boundary (exactly today) as expiring", () => {
    expect(isExpiringSoon("2026-07-02T12:00:00.000Z", NOW)).toBe(true);
  });
});

describe("dayKey", () => {
  it("returns the same key for two timestamps on the same calendar day", () => {
    expect(dayKey("2026-07-02T08:00:00.000Z")).toBe(dayKey("2026-07-02T20:00:00.000Z"));
  });

  it("returns different keys for timestamps on different days", () => {
    expect(dayKey("2026-07-02T08:00:00.000Z")).not.toBe(dayKey("2026-07-03T08:00:00.000Z"));
  });
});
