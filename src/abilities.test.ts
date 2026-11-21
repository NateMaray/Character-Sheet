import backup from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import { abilityEssence, essenceCountLabel, groupAbilities, rankFromLabel, rankLadder } from "./abilities";
import { parseSheet, validateSheet } from "./sheet";
import type { Ability, SheetData } from "./types";

function ability(partial: Partial<Ability> & Pick<Ability, "name">): Ability {
  return {
    tag: "Lightning · Special",
    rank: "Iron 0",
    progress: 0,
    detail: "Iron text.",
    ...partial,
  };
}

describe("abilityEssence", () => {
  it("lets essence win over the tag", () => {
    expect(abilityEssence({ essence: "Star", tag: "Lightning · Special · Movement" })).toBe("Star");
    expect(abilityEssence({ essence: "  wind ", tag: "Lightning · Special" })).toBe("Wind");
    expect(abilityEssence({ essence: "   ", tag: "Comet · Aura" })).toBe("Comet");
  });

  it("reads the first tag segment when essence is absent", () => {
    expect(abilityEssence({ tag: "Lightning · Special · Movement" })).toBe("Lightning");
    expect(abilityEssence({ tag: "Outworlder · Gift" })).toBe("Outworlder");
    expect(abilityEssence({ tag: "star•perception" })).toBe("Star");
    expect(abilityEssence({})).toBe("");
  });
});

describe("groupAbilities", () => {
  it("orders Lightning, Star, Wind, and Comet, then anything else", () => {
    const groups = groupAbilities([
      ability({ name: "Gift", tag: "Outworlder · Gift" }),
      ability({ name: "Comet Strike", tag: "Comet · Attack" }),
      ability({ name: "Arc Step", tag: "Lightning · Special" }),
      ability({ name: "Star Mark", essence: "Star", tag: "Lightning · Special" }),
      ability({ name: "Veil", tag: "Wind · Special" }),
      ability({ name: "Untagged", tag: undefined }),
      ability({ name: "Heads-Up", tag: "Racial · Boon" }),
    ]);
    expect(groups.map((group) => group.essence)).toEqual(["Lightning", "Star", "Wind", "Comet", "Outworlder", "Other", "Racial"]);
    expect(groups.find((group) => group.essence === "Lightning")?.abilities.map((entry) => entry.name)).toEqual(["Arc Step"]);
    expect(groups.find((group) => group.essence === "Star")?.abilities.map((entry) => entry.name)).toEqual(["Star Mark"]);
    expect(essenceCountLabel("Lightning", 2)).toBe("2/5");
    expect(essenceCountLabel("Comet", 3)).toBe("3/5");
    expect(essenceCountLabel("Outworlder", 1)).toBe("1");
    expect(essenceCountLabel("Other", 1)).toBe("1");
  });

  it("groups the backup, and leaves an ability with no tag under Other", () => {
    const sheet = parseSheet(backup);
    const groups = groupAbilities(sheet.abilities);
    expect(groups.map((group) => [group.essence, essenceCountLabel(group.essence, group.abilities.length)])).toEqual([
      ["Lightning", "2/5"],
      ["Star", "3/5"],
      ["Wind", "2/5"],
      ["Comet", "3/5"],
      ["Other", "1"],
    ]);
    expect(groups[0].abilities.map((entry) => entry.name)).toEqual(["Arc Step", "Thunderhead"]);
    expect(groups[1].abilities.map((entry) => entry.name)).toEqual(["Star Mark", "Moonwell", "Starward Gaze"]);
    expect(groups[2].abilities.map((entry) => entry.name)).toEqual(["Windward Veil", "Second Wind"]);
    expect(groups[3].abilities.map((entry) => entry.name)).toEqual(["Comet Strike", "Harbinger", "Quarry's Wake"]);
    expect(groups[4].abilities.map((entry) => entry.name)).toEqual(["Sky Stair"]);
    expect(sheet.abilityMeta.slotsLabel).toBe("LIGHTNING 2/5 · STAR 3/5 · WIND 3/5 · COMET 3/5 AWAKENED");
  });
});

describe("rankLadder", () => {
  it("reads the rank word from the label", () => {
    expect(rankFromLabel("Iron 0")).toBe("Iron");
    expect(rankFromLabel("  bronze 2")).toBe("Bronze");
    expect(rankFromLabel("Silver")).toBe("Silver");
    expect(rankFromLabel("Normal")).toBeNull();
  });

  it("highlights the current rank, shows a filled future rank, and seals the rest", () => {
    const rungs = rankLadder({
      rank: "Iron 0",
      detail: "A short streak.",
      ranks: { Bronze: "The streak reaches about 40 feet." },
    });
    expect(rungs.map((rung) => [rung.name, rung.state, rung.text])).toEqual([
      ["Iron", "current", "A short streak."],
      ["Bronze", "future", "The streak reaches about 40 feet."],
      ["Silver", "sealed", "Sealed: revealed on reaching Silver"],
      ["Gold", "sealed", "Sealed: revealed on reaching Gold"],
      ["Diamond", "sealed", "Sealed: revealed on reaching Diamond"],
    ]);
  });

  it("uses ranks.Iron when present, and detail when it is missing", () => {
    expect(rankLadder({ rank: "Iron 0", detail: "From detail." })[0]).toEqual({
      name: "Iron",
      state: "current",
      text: "From detail.",
    });
    const bronze = rankLadder({
      rank: "Bronze 2",
      detail: "Old iron text.",
      ranks: { Iron: "Written iron.", Bronze: "Written bronze." },
    });
    expect(bronze.map((rung) => [rung.name, rung.state, rung.text])).toEqual([
      ["Iron", "past", "Written iron."],
      ["Bronze", "current", "Written bronze."],
      ["Silver", "sealed", "Sealed: revealed on reaching Silver"],
      ["Gold", "sealed", "Sealed: revealed on reaching Gold"],
      ["Diamond", "sealed", "Sealed: revealed on reaching Diamond"],
    ]);
  });

  it("does not seal a rank he has already passed when that text is missing", () => {
    const silver = rankLadder({ rank: "Silver 1", detail: "Iron only." });
    expect(silver.find((rung) => rung.name === "Bronze")).toEqual({ name: "Bronze", state: "past", text: "" });
    expect(silver.find((rung) => rung.name === "Silver")?.state).toBe("current");
    expect(silver.find((rung) => rung.name === "Gold")?.state).toBe("sealed");
  });
});

describe("ability fields on the sheet", () => {
  it("keeps a sheet with no essence or ranks valid", () => {
    expect(validateSheet(backup)).toBeNull();
    const sheet = parseSheet(backup);
    expect(sheet.abilities.every((entry) => entry.essence === undefined && entry.ranks === undefined)).toBe(true);
  });

  it("accepts essence and a partial ranks object", () => {
    const copy = structuredClone(parseSheet(backup)) as SheetData;
    copy.abilities[0].essence = "Lightning";
    copy.abilities[0].ranks = { Bronze: "The streak reaches about 40 feet." };
    expect(validateSheet(copy)).toBeNull();
    expect(parseSheet(copy).abilities[0].ranks?.Bronze).toBe("The streak reaches about 40 feet.");
  });

  it("rejects a bad essence or ranks shape", () => {
    const copy = structuredClone(parseSheet(backup)) as SheetData;
    (copy.abilities[0] as { essence: unknown }).essence = 1;
    expect(validateSheet(copy)).toMatch(/essence/);
    copy.abilities[0].essence = "Lightning";
    (copy.abilities[0] as { ranks: unknown }).ranks = ["Iron"];
    expect(validateSheet(copy)).toMatch(/ranks/);
    copy.abilities[0].ranks = { Iron: "ok" };
    (copy.abilities[0].ranks as Record<string, string>).Mythic = "no";
    expect(validateSheet(copy)).toMatch(/ranks/);
    (copy.abilities[0].ranks as { Iron: unknown }).Iron = 2;
    expect(validateSheet(copy)).toMatch(/ranks/);
  });
});
