import { describe, expect, it } from "vitest";
import { describeLoadError } from "./supabase";
import { changedVitalLabels, parseSheet } from "./sheet";

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

describe("parseSheet", () => {
  it("rejects a row that is not a sheet", () => {
    expect(() => parseSheet({ rev: "" })).toThrow(/rev/);
  });
});
