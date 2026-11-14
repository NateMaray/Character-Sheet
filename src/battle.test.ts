import sheet from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import { battleRoster, isStandInAlly } from "./battle";
import { parseSheet, validateSheet } from "./sheet";
import type { BattleMap, Enemy, SheetData } from "./types";

const base = sheet as unknown as SheetData;

function enemy(partial: Partial<Enemy> & Pick<Enemy, "id" | "name" | "tone">): Enemy {
  return {
    size: "",
    rank: "",
    type: "",
    status: "",
    x: 0,
    y: 0,
    ...partial,
  };
}

describe("battle archive", () => {
  it("accepts a missing archive and a list of past battles", () => {
    expect(validateSheet(base)).toBeNull();
    expect(base.map.battleArchive).toBeUndefined();
    const withArchive = {
      ...base,
      map: { ...base.map, battleArchive: [base.map.battle, { ...base.map.battle, title: "Earlier fight" }] },
    };
    expect(validateSheet(withArchive)).toBeNull();
    const parsed = parseSheet(withArchive);
    expect(parsed.map.battleArchive?.map((battle) => battle.title)).toEqual([base.map.battle.title, "Earlier fight"]);
  });

  it("rejects an archive that is not a list of battles", () => {
    expect(validateSheet({ ...base, map: { ...base.map, battleArchive: "cleared" } })).toMatch(/battleArchive/);
    expect(validateSheet({ ...base, map: { ...base.map, battleArchive: [{ title: "No enemies" }] } })).toMatch(/battleArchive/);
  });
});

describe("allies", () => {
  const battle = {
    title: "Nest",
    note: "",
    width: 10,
    height: 10,
    reveal: [],
    fogOverlay: 0,
    player: { x: 0, y: 0, label: "Nate" },
    enemies: [
      enemy({ id: "gary", name: "Gary (ally)", tone: "neutral", x: 4, y: 5, status: "With Nate", mapLabel: "Gary" }),
      enemy({ id: "leader", name: "Pipe beast, leader", tone: "hostile", status: "Hostile" }),
    ],
  } as BattleMap;

  it("lifts the Gary stand-in out of contacts", () => {
    const roster = battleRoster(battle);
    expect(roster.contacts.map((entry) => entry.id)).toEqual(["leader"]);
    expect(roster.allies).toEqual([{ id: "gary", name: "Gary (ally)", x: 4, y: 5, label: "Gary", status: "With Nate" }]);
    expect(isStandInAlly(battle.enemies[0])).toBe(true);
  });

  it("keeps a declared ally and does not list him twice", () => {
    const roster = battleRoster({
      ...battle,
      allies: [{ id: "gary", name: "Gary", x: 8, y: 9, status: "At the mouth" }],
    });
    expect(roster.allies).toEqual([{ id: "gary", name: "Gary", x: 8, y: 9, status: "At the mouth" }]);
    expect(roster.contacts.map((entry) => entry.id)).toEqual(["leader"]);
  });

  it("accepts allies on the sheet and rejects a bad list", () => {
    const ok = { ...base, map: { ...base.map, battle: { ...base.map.battle, allies: [{ id: "gary", name: "Gary", x: 1, y: 2 }] } } };
    expect(validateSheet(ok)).toBeNull();
    expect(validateSheet({ ...base, map: { ...base.map, battle: { ...base.map.battle, allies: [{ id: "gary" }] } } })).toMatch(/allies/);
  });
});
