import { describe, expect, it } from "vitest";
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

describe("parseSheet", () => {
  it("rejects a row that is not a sheet", () => {
    expect(() => parseSheet({ rev: "" })).toThrow(/rev/);
  });
});
