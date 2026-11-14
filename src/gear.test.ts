import sheet from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import {
  deleteLoadout,
  equipItem,
  equipToSlot,
  loadLoadout,
  readPins,
  resolveGear,
  sanitizePins,
  saveLoadout,
  togglePin,
  unequip,
  writePins,
  type TabId,
} from "./gear";
import { validateSheet } from "./sheet";
import type { GearItem, GearSource, GearState } from "./types";

const gear = sheet.gear as GearSource;
const emptyStore = { rev: null, equipped: null, pocket: null, loadouts: null };

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key) || null : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function fresh(): GearState {
  return resolveGear(sheet.rev, gear, emptyStore, null).state;
}

describe("nate.json", () => {
  it("validates and matches the nest-chamber scene", () => {
    expect(validateSheet(sheet)).toBeNull();
    expect(sheet.rev).toBe("2026-11-14-j-first-kill");
    const mana = sheet.vitals.find((vital) => vital.label === "MANA");
    const health = sheet.vitals.find((vital) => vital.label === "HEALTH");
    const stamina = sheet.vitals.find((vital) => vital.label === "STAMINA");
    expect(mana?.pct).toBe(70);
    expect(health?.pct).toBe(92);
    expect(stamina?.pct).toBe(78);
    expect(sheet.location).toMatch(/nest chamber/i);
    const names = sheet.map.battle.enemies.map((enemy) => enemy.name);
    expect(names).not.toContain("Unseen contact");
    expect(names.filter((name) => name.startsWith("Pipe beast"))).toHaveLength(4);
    expect(names.filter((name) => name === "Blind pup")).toHaveLength(3);
    expect(sheet.map.battle.note).toMatch(/skull crushed/i);
    const dead = sheet.map.battle.enemies.find((enemy) => enemy.id === "injured");
    expect(dead?.tone).toBe("dead");
    expect(dead?.status.toLowerCase()).toContain("dead");
    expect(dead && dead.x < 220 && dead.y > 250).toBe(true);
    expect(sheet.map.battle.enemies.some((enemy) => enemy.status.toLowerCase().includes("charging"))).toBe(true);
  });
});

describe("resolveGear", () => {
  it("starts from the story snapshot and keeps borrowed gear off the pocket", () => {
    const { state, dirty } = resolveGear(sheet.rev, gear, emptyStore, null);
    expect(dirty).toBe(true);
    expect(state.equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("Tanner's lantern");
    expect(state.equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("War Hammer");
    expect(state.equipped.find((entry) => entry.slot === "Body")?.name).toBe("Travel clothes");
    const pocketNames = state.pocket.map((item) => item.name);
    expect(pocketNames).not.toContain("War Hammer");
    expect(pocketNames).not.toContain("Tanner's lantern");
    expect(pocketNames).toContain("Astral Compass Shard");
    expect(pocketNames).toContain("Spare clothes");
    expect(state.loadouts.map((loadout) => loadout.name)).toEqual(["Combat", "Travel"]);
    expect(state.loadouts[0].equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("");
    expect(state.loadouts[1].equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("");
  });

  it("keeps a saved arrangement when rev does not change", () => {
    const first = fresh();
    const parked = unequip(first, gear, "Main hand");
    expect(parked).not.toBeNull();
    const stored = {
      rev: sheet.rev,
      equipped: parked!.equipped,
      pocket: parked!.pocket,
      loadouts: parked!.loadouts,
    };
    const again = resolveGear(sheet.rev, gear, stored, null);
    expect(again.dirty).toBe(false);
    expect(again.state.equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("");
    expect(again.state.pocket.some((item) => item.name === "War Hammer")).toBe(true);
    expect(resolveGear(sheet.rev, gear, emptyStore, parked).state).toBe(parked);
  });

  it("adds a new item on rev change without wiping what Nate equipped", () => {
    const first = fresh();
    const spare = first.pocket.find((item) => item.name === "Spare clothes") as GearItem;
    const wearingSpare = equipToSlot(first, gear, spare, "Body");
    expect(wearingSpare?.equipped.find((entry) => entry.slot === "Body")?.name).toBe("Spare clothes");
    const nextGear: GearSource = {
      ...gear,
      pocket: [...gear.pocket, { name: "Coil of rope", qty: "", note: "From the tannery." }],
    };
    const next = resolveGear("2026-11-14-j-rope", nextGear, emptyStore, wearingSpare);
    expect(next.dirty).toBe(true);
    expect(next.state.equipped.find((entry) => entry.slot === "Body")?.name).toBe("Spare clothes");
    expect(next.state.pocket.some((item) => item.name === "Coil of rope")).toBe(true);
    expect(next.state.pocket.some((item) => item.name === "Travel clothes")).toBe(true);
    expect(next.state.equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("Tanner's lantern");
  });

  it("removes gear the story no longer lists and forces the current borrowed piece", () => {
    const first = fresh();
    const stripped: GearSource = {
      ...gear,
      pocket: gear.pocket.filter((item) => item.name !== "Vane ledger"),
      equipped: gear.equipped.map((entry) =>
        entry.slot === "Off hand"
          ? { slot: "Off hand", name: "Foreman's lamp", empty: "", note: "Borrowed. Not Nate's.", qty: "" }
          : entry.slot === "Main hand"
            ? { ...entry, name: "" }
            : entry,
      ),
    };
    const next = resolveGear("next", stripped, emptyStore, first);
    expect(next.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(next.state.pocket.some((item) => item.name === "War Hammer")).toBe(false);
    expect(next.state.equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("");
    expect(next.state.equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("Foreman's lamp");
  });
});

describe("equip actions", () => {
  it("refuses a slot an item cannot use and does not pocket borrowed gear", () => {
    const state = fresh();
    const knife = state.pocket.find((item) => item.name === "Kitchen knife") as GearItem;
    expect(equipToSlot(state, gear, knife, "Head")).toBeNull();
    const cleared = unequip(state, gear, "Off hand");
    expect(cleared?.equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("");
    expect(cleared?.pocket.some((item) => item.name === "Tanner's lantern")).toBe(false);
    expect(unequip(state, gear, "Main hand")?.pocket.some((item) => item.name === "War Hammer")).toBe(true);
  });

  it("replaces the first fitting slot when every legal slot is full", () => {
    const state = fresh();
    const knife = state.pocket.find((item) => item.name === "Kitchen knife") as GearItem;
    const next = equipItem(state, gear, knife);
    expect(next?.equipped.find((entry) => entry.slot === "Belt / sheath")?.name).toBe("Kitchen knife");
    expect(next?.pocket.some((item) => item.name === "Fighting Knife")).toBe(true);
    const replaced = equipToSlot(state, gear, knife, "Off hand");
    expect(replaced?.equipped.find((entry) => entry.slot === "Off hand")?.name).toBe("Kitchen knife");
    expect(replaced?.pocket.some((item) => item.name === "Tanner's lantern")).toBe(false);
  });

  it("saves, loads, and deletes loadouts", () => {
    const state = fresh();
    const saved = saveLoadout(state, " Ditch ");
    expect(saved?.loadouts.some((loadout) => loadout.name === "Ditch")).toBe(true);
    const travel = saved!.loadouts.find((loadout) => loadout.name === "Travel");
    const loaded = loadLoadout(saved!, gear, travel!);
    expect(loaded.equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("");
    expect(loaded.pocket.some((item) => item.name === "War Hammer")).toBe(true);
    expect(loaded.equipped.find((entry) => entry.slot === "Body")?.name).toBe("Travel clothes");
    expect(deleteLoadout(loaded, "Ditch").loadouts.some((loadout) => loadout.name === "Ditch")).toBe(false);
    expect(saveLoadout(state, "   ")).toBeNull();
  });
});

describe("pins", () => {
  it("caps at five, drops unknown tabs, and restores the defaults when the last pin is removed", () => {
    expect(sanitizePins(["map", "nope", "map", "status"])).toEqual(["map", "status"]);
    const five: TabId[] = ["map", "status", "equipment", "pocket", "abilities"];
    expect(togglePin(five, "missions")).toEqual(five);
    expect(sanitizePins(togglePin(["map"], "map"))).toEqual(["map", "status", "equipment", "pocket"]);
    expect(sanitizePins(null)).toEqual(["map", "status", "equipment", "pocket"]);
  });

  it("round-trips pins through storage", () => {
    const store = memory();
    writePins(["feats", "profile"], store);
    expect(readPins(store)).toEqual(["feats", "profile"]);
  });
});
