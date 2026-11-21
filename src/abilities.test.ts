import backup from "../public/data/nate.json";
import sheet from "./fixtures/campaign.json";
import { describe, expect, it } from "vitest";
import { ESSENCE_ORDER, abilityEssence, essenceCountLabel, groupAbilities, rankFromLabel, rankLadder } from "./abilities";
import { parseSheet, validateSheet } from "./sheet";
import type { Ability } from "./types";

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
    expect(groups.find((group) => group.essence === "Other")?.abilities.map((entry) => entry.name)).toEqual(["Untagged"]);
    expect(essenceCountLabel("Lightning", 2)).toBe("2/5");
    expect(essenceCountLabel("Comet", 3)).toBe("3/5");
    expect(essenceCountLabel("Outworlder", 1)).toBe("1");
    expect(essenceCountLabel("Other", 1)).toBe("1");
  });

  it("files an essence with no tag under that essence, and an ability with neither under Other", () => {
    const groups = groupAbilities([
      ability({ name: "Bolt", tag: "Lightning · Special" }),
      ability({ name: "Storm", tag: "Lightning · Spell" }),
      ability({ name: "Mark", tag: "Star · Special" }),
      ability({ name: "Well", tag: "Star · Spell" }),
      ability({ name: "Gaze", tag: "Star · Special" }),
      ability({ name: "Veil", tag: "Wind · Special" }),
      ability({ name: "Gust", tag: "Wind · Special" }),
      ability({ name: "Stair", essence: "Wind", tag: undefined }),
      ability({ name: "Strike", tag: "Comet · Attack" }),
      ability({ name: "Wake", tag: "Comet · Special" }),
      ability({ name: "Trail", tag: "Comet · Aura" }),
      ability({ name: "Loose", tag: undefined }),
    ]);
    expect(groups.map((group) => [group.essence, essenceCountLabel(group.essence, group.abilities.length)])).toEqual([
      ["Lightning", "2/5"],
      ["Star", "3/5"],
      ["Wind", "3/5"],
      ["Comet", "3/5"],
      ["Other", "1"],
    ]);
    expect(groups.find((group) => group.essence === "Wind")?.abilities.map((entry) => entry.name)).toEqual(["Veil", "Gust", "Stair"]);
    expect(groups.find((group) => group.essence === "Other")?.abilities.map((entry) => entry.name)).toEqual(["Loose"]);
  });

  it("groups every ability in the synced backup, in essence order", () => {
    const live = parseSheet(backup);
    const groups = groupAbilities(live.abilities);
    const listed = groups.flatMap((group) => group.abilities);
    expect(listed).toHaveLength(live.abilities.length);
    for (const entry of live.abilities) expect(listed).toContain(entry);
    const known = groups.map((group) => group.essence).filter((name) => (ESSENCE_ORDER as readonly string[]).includes(name));
    expect(known).toEqual(ESSENCE_ORDER.filter((name) => known.includes(name)));
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
  it("accepts the synced backup", () => {
    expect(validateSheet(backup)).toBeNull();
    expect(parseSheet(backup).abilities).toHaveLength(backup.abilities.length);
  });

  it("keeps a sheet with no essence or ranks valid", () => {
    const copy = structuredClone(parseSheet(sheet));
    for (const entry of copy.abilities) {
      delete entry.essence;
      delete entry.ranks;
    }
    expect(validateSheet(copy)).toBeNull();
    const parsed = parseSheet(copy);
    expect(parsed.abilities.length).toBeGreaterThan(0);
    expect(parsed.abilities.every((entry) => entry.essence === undefined && entry.ranks === undefined)).toBe(true);
  });

  it("accepts essence and a partial ranks object", () => {
    const copy = structuredClone(parseSheet(sheet));
    copy.abilities[0].essence = "Lightning";
    copy.abilities[0].ranks = { Bronze: "The streak reaches about 40 feet." };
    expect(validateSheet(copy)).toBeNull();
    expect(parseSheet(copy).abilities[0].ranks?.Bronze).toBe("The streak reaches about 40 feet.");
    expect(parseSheet(copy).abilities[0].essence).toBe("Lightning");
  });

  it("rejects a bad essence or ranks shape", () => {
    const copy = structuredClone(parseSheet(sheet));
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
