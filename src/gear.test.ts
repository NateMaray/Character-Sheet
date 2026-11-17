import sheet from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import {
  ACTIONS_KEY,
  applyPocketActions,
  deleteLoadout,
  equipItem,
  equipToSlot,
  itemsForSlot,
  loadLoadout,
  pocketActionsForDm,
  readPins,
  readPocketActions,
  resolveGear,
  sanitizePins,
  saveLoadout,
  togglePin,
  unequip,
  writePins,
  writePocketActions,
  type TabId,
} from "./gear";
import { validateSheet } from "./sheet";
import { pocketActionRpcMissing } from "./supabase";
import type { GearItem, GearSource, GearState, PocketAction, SheetData } from "./types";

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
  it("refuses a slot the sheet does not have and leaves the item in the pocket", () => {
    const state = fresh();
    const broken: GearState = {
      ...state,
      equipped: state.equipped.map((slot) => (slot.slot === "Belt / sheath" ? { ...slot, slot: "" } : slot)),
    };
    const knife = broken.pocket.find((item) => item.name === "Kitchen knife") as GearItem;
    expect(equipToSlot(broken, gear, knife, "Belt / sheath")).toBeNull();
    const next = equipItem(broken, gear, knife);
    expect(next?.pocket.some((item) => item.name === "Kitchen knife")).toBe(false);
    expect(next?.equipped.some((slot) => slot.name === "Kitchen knife")).toBe(true);
  });

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

function move(partial: Pick<PocketAction, "id" | "kind" | "item"> & Partial<PocketAction>): PocketAction {
  return {
    qty: "",
    chest: "",
    at: "2026-11-17T00:00:00.000Z",
    baseRev: sheet.rev,
    ...partial,
  };
}

describe("chests and pocket actions", () => {
  const coin = gear.pocket.find((item) => item.name === "Coin pouch") as GearItem;

  function withChest(contents: GearItem[] = []): GearSource {
    return {
      ...gear,
      pocket: [
        { name: "Strongbox", qty: "", note: "Banded wood.", contents },
        ...gear.pocket.filter((item) => !contents.some((entry) => entry.name === item.name)),
      ],
    };
  }

  it("keeps source chest contents in the chest instead of lifting them into the pocket", () => {
    const chestGear = withChest([coin]);
    const older = fresh();
    const next = resolveGear("rev-chest", chestGear, emptyStore, older);
    expect(next.state.pocket.some((item) => item.name === "Coin pouch")).toBe(false);
    expect(next.state.pocket.find((item) => item.name === "Strongbox")?.contents?.map((item) => item.name)).toEqual(["Coin pouch"]);
    expect(next.state.equipped.find((entry) => entry.slot === "Main hand")?.name).toBe("War Hammer");
  });

  it("replays a discard across a rev change, and drops it once the DM has applied it", () => {
    const first = fresh();
    const stored = {
      rev: sheet.rev,
      equipped: first.equipped,
      pocket: first.pocket.filter((item) => item.name !== "Vane ledger"),
      loadouts: first.loadouts,
    };
    const discard = move({ id: "discard-ledger", kind: "discard", item: "Vane ledger" });
    const kept = resolveGear(sheet.rev, gear, stored, null, [discard]);
    expect(kept.dirty).toBe(false);
    expect(kept.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(kept.actions.map((action) => action.id)).toEqual(["discard-ledger"]);

    const replayed = resolveGear("rev-next", gear, stored, null, [discard]);
    expect(replayed.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(resolveGear("rev-next", gear, stored, null, []).state.pocket.some((item) => item.name === "Vane ledger")).toBe(true);

    const acked: GearSource = { ...gear, appliedActions: ["discard-ledger"] };
    const dropped = resolveGear("rev-acked", acked, stored, null, [discard]);
    expect(dropped.actions).toEqual([]);
    expect(dropped.state.pocket.some((item) => item.name === "Vane ledger")).toBe(true);

    const removed: GearSource = { ...acked, pocket: gear.pocket.filter((item) => item.name !== "Vane ledger") };
    const gone = resolveGear("rev-gone", removed, stored, null, [discard]);
    expect(gone.actions).toEqual([]);
    expect(gone.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
  });

  it("replays chest moves and skips ones whose item or chest is gone", () => {
    const chestGear = withChest([]);
    const base = resolveGear(sheet.rev, chestGear, emptyStore, null).state;
    const into = move({ id: "into", kind: "to_chest", item: "Vane ledger", chest: "Strongbox" });
    const out = move({ id: "out", kind: "from_chest", item: "Coin pouch", chest: "Strongbox" });
    const packed = applyPocketActions(base.pocket, [into], 40);
    expect(packed.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(packed.find((item) => item.name === "Strongbox")?.contents?.map((item) => item.name)).toEqual(["Vane ledger"]);

    const stored = { rev: sheet.rev, equipped: base.equipped, pocket: packed, loadouts: base.loadouts };
    const next = resolveGear("rev-pack", chestGear, stored, null, [into]);
    expect(next.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(next.state.pocket.find((item) => item.name === "Strongbox")?.contents?.map((item) => item.name)).toEqual(["Vane ledger"]);

    const sourced = withChest([coin]);
    const carried = resolveGear(sheet.rev, sourced, emptyStore, null).state;
    const removed = applyPocketActions(carried.pocket, [out], 40);
    expect(removed.some((item) => item.name === "Coin pouch")).toBe(true);
    expect(removed.find((item) => item.name === "Strongbox")?.contents).toEqual([]);
    const restored = resolveGear("rev-out", sourced, { rev: sheet.rev, equipped: carried.equipped, pocket: removed, loadouts: carried.loadouts }, null, [out]);
    expect(restored.state.pocket.some((item) => item.name === "Coin pouch")).toBe(true);
    expect(restored.state.pocket.find((item) => item.name === "Strongbox")?.contents).toEqual([]);

    const missingChest = applyPocketActions(base.pocket, [move({ id: "x", kind: "to_chest", item: "Vane ledger", chest: "No such chest" })], 40);
    expect(missingChest).toBe(base.pocket);
    const chestInChest = applyPocketActions(
      [
        { name: "Strongbox", qty: "", note: "", contents: [] },
        { name: "Crate", qty: "", note: "", contents: [] },
      ],
      [move({ id: "nest", kind: "to_chest", item: "Crate", chest: "Strongbox" })],
      40,
    );
    expect(chestInChest.map((item) => item.name)).toEqual(["Strongbox", "Crate"]);
    expect(chestInChest[0].contents).toEqual([]);

    const full: GearItem[] = [
      { name: "Strongbox", qty: "", note: "", contents: [{ name: "Marble", qty: "", note: "" }] },
      ...Array.from({ length: 39 }, (_, index) => ({ name: `Rock ${index}`, qty: "", note: "" })),
    ];
    const blocked = applyPocketActions(full, [move({ id: "full", kind: "from_chest", item: "Marble", chest: "Strongbox" })], 40);
    expect(blocked).toBe(full);
    expect(applyPocketActions(base.pocket, [move({ id: "ghost", kind: "discard", item: "Not real" })], 40)).toBe(base.pocket);

    const thenDiscard = applyPocketActions(base.pocket, [into, move({ id: "burn", kind: "discard", item: "Vane ledger", chest: "Strongbox" })], 40);
    expect(thenDiscard.some((item) => item.name === "Vane ledger")).toBe(false);
    expect(thenDiscard.find((item) => item.name === "Strongbox")?.contents).toEqual([]);
  });

  it("hides chest contents from equipment picks and strips them when a loadout equips that item", () => {
    const pocket: GearItem[] = [
      { name: "Strongbox", qty: "", note: "", contents: [{ name: "Kitchen knife", qty: "", note: "Retired from fighting." }] },
      { name: "Spare clothes", qty: "", note: "A bit short", contents: [] },
    ];
    expect(itemsForSlot(pocket, gear, "Belt / sheath").map((item) => item.name)).toEqual([]);
    expect(itemsForSlot(pocket, gear, "Body").map((item) => item.name)).toEqual([]);

    const state = fresh();
    const knife = state.pocket.find((item) => item.name === "Kitchen knife") as GearItem;
    const boxed: GearState = {
      ...state,
      pocket: [{ name: "Strongbox", qty: "", note: "", contents: [knife] }, ...state.pocket.filter((item) => item.name !== "Kitchen knife")],
    };
    const wearingKnife: GearState = {
      ...boxed,
      loadouts: [
        {
          name: "Knife",
          equipped: state.equipped.map((slot) =>
            slot.slot === "Belt / sheath" ? { ...slot, name: knife.name, note: knife.note, qty: knife.qty, empty: "" } : slot,
          ),
        },
      ],
    };
    const loaded = loadLoadout(wearingKnife, gear, wearingKnife.loadouts[0]);
    expect(loaded.equipped.find((slot) => slot.slot === "Belt / sheath")?.name).toBe("Kitchen knife");
    expect(loaded.pocket.find((item) => item.name === "Strongbox")?.contents).toEqual([]);
    expect(loaded.pocket.some((item) => item.name === "Kitchen knife")).toBe(false);
    expect(loaded.pocket.some((item) => item.name === "Fighting Knife")).toBe(true);
  });

  it("accepts chest contents and applied actions, and rejects a bad contents list", () => {
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear.pocket[0] = { ...copy.gear.pocket[0], contents: [{ name: "Gem", qty: "", note: "Red." }] };
    copy.gear.appliedActions = ["discard-ledger"];
    expect(validateSheet(copy)).toBeNull();
    copy.gear.pocket[0] = { ...copy.gear.pocket[0], contents: "sack" as unknown as GearItem[] };
    expect(validateSheet(copy)).toMatch(/contents/);
    copy.gear.pocket[0] = { ...copy.gear.pocket[0], contents: [{ qty: "x1" } as GearItem] };
    expect(validateSheet(copy)).toMatch(/contents/);
    copy.gear.pocket[0] = { ...sheet.gear.pocket[0] };
    copy.gear.appliedActions = "discard-ledger" as unknown as string[];
    expect(validateSheet(copy)).toMatch(/appliedActions/);
  });

  it("stores the pending log and copies it without the synced flag", () => {
    const store = memory();
    const discard = move({ id: "discard-ledger", kind: "discard", item: "Vane ledger", synced: true });
    writePocketActions([discard, { ...discard, id: "", kind: "discard" }], store);
    expect(readPocketActions(store)).toEqual([discard]);
    store.setItem(ACTIONS_KEY, "{");
    expect(readPocketActions(store)).toEqual([]);
    const parsed = JSON.parse(pocketActionsForDm([discard])) as PocketAction[];
    expect(parsed).toEqual([{ id: "discard-ledger", kind: "discard", item: "Vane ledger", qty: "", chest: "", at: discard.at, baseRev: sheet.rev }]);
    expect(Object.hasOwn(parsed[0], "synced")).toBe(false);
    expect(pocketActionRpcMissing({ code: "PGRST202", message: "missing" })).toBe(true);
    expect(pocketActionRpcMissing({ status: 404, message: "not found" })).toBe(true);
    expect(pocketActionRpcMissing({ message: "Failed to fetch" })).toBe(false);
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
