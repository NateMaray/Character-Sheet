import backup from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import { describeLoadError } from "./supabase";
import { changedVitalLabels, parseSheet, shouldApplySheet, validateSheet } from "./sheet";
import { timeIconFor } from "./worldTime";

describe("changedVitalLabels", () => {
  const before = [
    { label: "HEALTH", pct: 92 },
    { label: "MANA", pct: 70 },
    { label: "STAMINA", pct: 78 },
  ];

  it("does not flash the first reading", () => {
    expect(changedVitalLabels(null, before)).toEqual([]);
  });

  it("names only the bars whose percent moved", () => {
    expect(changedVitalLabels(before, [
      { label: "HEALTH", pct: 80 },
      { label: "MANA", pct: 70 },
      { label: "STAMINA", pct: 60 },
    ])).toEqual(["HEALTH", "STAMINA"]);
  });
});

describe("describeLoadError", () => {
  it("names a timeout and an HTTP status", () => {
    expect(describeLoadError(new DOMException("The operation was aborted", "AbortError"))).toMatch(/timed out after 10 seconds/);
    expect(describeLoadError(new Error("Supabase HTTP 503"))).toBe("Supabase HTTP 503");
    expect(describeLoadError(new TypeError("Failed to fetch"))).toMatch(/network error/);
  });
});

describe("shouldApplySheet", () => {
  it("lets a newer live rev replace the backup and ignores an older backup", () => {
    expect(shouldApplySheet(null, "2026-11-17-t393", "fallback")).toBe(true);
    expect(shouldApplySheet("2026-11-17-t393", "2026-11-17-t508", "live")).toBe(true);
    expect(shouldApplySheet("2026-11-17-t508", "2026-11-17-t473", "fallback")).toBe(false);
    expect(shouldApplySheet("2026-11-17-t100", "2026-11-17-t99", "live")).toBe(false);
    expect(shouldApplySheet("2026-11-17-t508", "2026-11-18-t1", "live")).toBe(true);
    expect(shouldApplySheet("2026-11-17-t508", "2026-11-17-t508", "fallback")).toBe(true);
  });
});

describe("parseSheet", () => {
  it("rejects a row that is not a sheet", () => {
    expect(() => parseSheet({ rev: "" })).toThrow(/rev/);
  });
});

describe("worldTime", () => {
  const clock = {
    day: 4,
    dayLabel: "4 days after the assessment",
    time: "Night",
    detail: "About an hour before midnight",
  };

  it("keeps a sheet with no worldTime valid", () => {
    expect(validateSheet(backup)).toBeNull();
    expect(parseSheet(backup).worldTime).toBeUndefined();
    const copy = { ...backup } as Record<string, unknown>;
    delete copy.worldTime;
    expect(validateSheet(copy)).toBeNull();
  });

  it("accepts the clock, including when detail is left off", () => {
    const withDetail = { ...backup, worldTime: clock };
    expect(validateSheet(withDetail)).toBeNull();
    expect(parseSheet(withDetail).worldTime).toEqual(clock);
    const noDetail = { ...backup, worldTime: { day: 1, dayLabel: "Assessment day", time: "Dawn" } };
    expect(validateSheet(noDetail)).toBeNull();
    expect(parseSheet(noDetail).worldTime).toEqual({ day: 1, dayLabel: "Assessment day", time: "Dawn" });
    expect(validateSheet({ ...backup, worldTime: { day: 2, dayLabel: "Later", time: "Highsun" } })).toBeNull();
  });

  it("rejects a malformed worldTime only", () => {
    expect(validateSheet({ ...backup, worldTime: "Night" })).toMatch(/worldTime/);
    expect(validateSheet({ ...backup, worldTime: null })).toMatch(/worldTime/);
    expect(validateSheet({ ...backup, worldTime: { dayLabel: "x", time: "Night" } })).toMatch(/worldTime/);
    expect(validateSheet({ ...backup, worldTime: { day: "4", dayLabel: "x", time: "Night" } })).toMatch(/worldTime/);
    expect(validateSheet({ ...backup, worldTime: { day: Number.NaN, dayLabel: "x", time: "Night" } })).toMatch(/worldTime/);
    expect(validateSheet({ ...backup, worldTime: { day: 4, dayLabel: "x", time: "Night", detail: 1 } })).toMatch(/worldTime/);
  });

  it("picks a sun, moon, or clock from the time of day", () => {
    expect(timeIconFor("Dawn")).toBe("dawn");
    expect(timeIconFor("Morning")).toBe("morning");
    expect(timeIconFor("Midday")).toBe("midday");
    expect(timeIconFor("Afternoon")).toBe("afternoon");
    expect(timeIconFor("Dusk")).toBe("dusk");
    expect(timeIconFor("Evening")).toBe("evening");
    expect(timeIconFor("Night")).toBe("night");
    expect(timeIconFor("  Late   night ")).toBe("late-night");
    expect(timeIconFor("Highsun")).toBe("clock");
  });
});
