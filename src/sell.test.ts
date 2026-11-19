import sheet from "./fixtures/campaign.json";
import { describe, expect, it } from "vitest";
import { ACTIONS_KEY, applyPocketActions, readPocketActions, resolveGear, writePocketActions } from "./gear";
import {
  SELL_ACTIONS_KEY,
  SELL_LIST_KEY,
  addSellEntries,
  clearSellList,
  formatSellList,
  numericQty,
  pruneSellList,
  readSellActions,
  readSellList,
  removeSellEntry,
  sellCandidates,
  writeSellActions,
  writeSellList,
} from "./sell";
import { pocketActionRpcMissing } from "./supabase";
import type { GearItem, GearSource, PocketAction } from "./types";

const gear = sheet.gear as GearSource;
const emptyStore = { rev: null, equipped: null, pocket: null, loadouts: null };

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => (data.has(key) ? data.get(key) || null : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function fresh() {
  return resolveGear(sheet.rev, gear, emptyStore, null).state;
}

const core: GearItem = { name: "Rune tortoise core", qty: "x1", note: "" };
const thorns: GearItem = { name: "Frog thorns", qty: "x6", note: "" };

describe("sell list", () => {
  it("adds rows, replaces a count, and ignores the same count", () => {
    const first = addSellEntries([], [
      { item: "Rune tortoise core", chest: "", qty: 1 },
      { item: "Frog thorns", chest: "", qty: 6 },
    ]);
    expect(first.added.map((entry) => entry.item)).toEqual(["Rune tortoise core", "Frog thorns"]);
    expect(first.removed).toEqual([]);
    expect(formatSellList(first.list)).toBe("Selling: Rune tortoise core x1, Frog thorns x6");

    const same = addSellEntries(first.list, [{ item: "Frog thorns", chest: "", qty: 6 }]);
    expect(same.added).toEqual([]);
    expect(same.removed).toEqual([]);
    expect(same.list).toEqual(first.list);

    const changed = addSellEntries(first.list, [{ item: "Frog thorns", chest: "", qty: 2 }]);
    expect(changed.removed).toEqual([{ item: "Frog thorns", chest: "", qty: 6 }]);
    expect(changed.added).toEqual([{ item: "Frog thorns", chest: "", qty: 2 }]);
    expect(formatSellList(changed.list)).toBe("Selling: Rune tortoise core x1, Frog thorns x2");
  });

  it("removes one row and clears the rest", () => {
    const listed = addSellEntries([], [
      { item: "Rune tortoise core", chest: "", qty: 1 },
      { item: "Frog thorns", chest: "", qty: 6 },
    ]).list;
    const left = removeSellEntry(listed, "Rune tortoise core", "");
    expect(left).toEqual([{ item: "Frog thorns", chest: "", qty: 6 }]);
    expect(formatSellList(left)).toBe("Selling: Frog thorns x6");
    const cleared = clearSellList(left);
    expect(cleared.list).toEqual([]);
    expect(cleared.removed).toEqual(left);
    expect(formatSellList(cleared.list)).toBe("Selling: nothing");
  });

  it("drops a listed item the next rev no longer has, and clamps when the qty falls", () => {
    const first = fresh();
    const listed = addSellEntries([], [
      { item: "Waterskins", chest: "", qty: 2 },
      { item: "Vane ledger", chest: "", qty: 1 },
      { item: "Coin pouch", chest: "Strongbox", qty: 1 },
    ]).list;
    const nextGear: GearSource = {
      ...gear,
      pocket: [
        {
          name: "Strongbox",
          qty: "",
          note: "",
          contents: [{ name: "Coin pouch", qty: "x1", note: "Still here." }],
        },
        ...gear.pocket
          .filter((item) => item.name !== "Vane ledger" && item.name !== "Coin pouch")
          .map((item) => (item.name === "Waterskins" ? { ...item, qty: "x1" } : item)),
      ],
    };
    const next = resolveGear("rev-sold-some", nextGear, emptyStore, first);
    expect(next.state.pocket.some((item) => item.name === "Vane ledger")).toBe(false);
    const pruned = pruneSellList(listed, next.state.pocket);
    expect(pruned).toEqual([
      { item: "Waterskins", chest: "", qty: 1 },
      { item: "Coin pouch", chest: "Strongbox", qty: 1 },
    ]);

    const raised = pruneSellList([{ item: "Frog thorns", chest: "", qty: 3 }], [{ ...thorns, qty: "x6" }]);
    expect(raised[0].qty).toBe(3);
    const clamped = pruneSellList([{ item: "Frog thorns", chest: "", qty: 6 }], [{ ...thorns, qty: "x4" }, core]);
    expect(clamped).toEqual([{ item: "Frog thorns", chest: "", qty: 4 }]);
    expect(pruneSellList(clamped, [core])).toEqual([]);
  });

  it("lists loose items and chest contents, and skips a chest that still has something in it", () => {
    const pocket: GearItem[] = [
      { name: "Crate", qty: "", note: "", contents: [] },
      { name: "Strongbox", qty: "", note: "", contents: [{ name: "Gem", qty: "x3", note: "" }] },
      { name: "Rope", qty: "1 coil", note: "" },
      { name: "Chalk sticks", qty: "several", note: "" },
      { name: "Barbs", qty: 26 as unknown as string, note: "" },
      { name: "Bandages", qty: "2", note: "" },
      { name: "Shard", qty: "", note: "" },
    ];
    expect(sellCandidates(pocket)).toEqual([
      { name: "Crate", chest: "", max: 1, picker: false },
      { name: "Gem", chest: "Strongbox", max: 3, picker: true },
      { name: "Rope", chest: "", max: 1, picker: false },
      { name: "Chalk sticks", chest: "", max: 1, picker: false },
      { name: "Barbs", chest: "", max: 26, picker: true },
      { name: "Bandages", chest: "", max: 2, picker: true },
      { name: "Shard", chest: "", max: 1, picker: false },
    ]);
    expect(numericQty("x2")).toBe(2);
    expect(numericQty("1 coil")).toBeNull();
    expect(formatSellList([{ item: "Gem", chest: "Strongbox", qty: 2 }])).toBe("Selling: Gem x2 (Strongbox)");
  });

  it("does not replay sell or unsell as a pocket move", () => {
    const first = fresh();
    const sell: PocketAction = {
      id: "sell-water",
      kind: "sell",
      item: "Waterskins",
      qty: "x2",
      chest: "",
      at: "2026-11-19T00:00:00.000Z",
      baseRev: sheet.rev,
    };
    const unsell: PocketAction = { ...sell, id: "unsell-water", kind: "unsell" };
    expect(applyPocketActions(first.pocket, [sell, unsell], 40)).toBe(first.pocket);

    const kept = resolveGear("rev-sell", gear, emptyStore, first, [sell, unsell]);
    expect(kept.state.pocket.some((item) => item.name === "Waterskins")).toBe(true);
    expect(kept.state.pocket.find((item) => item.name === "Waterskins")?.qty).toBe("x2");

    const discard: PocketAction = { ...sell, id: "drop-water", kind: "discard" };
    const dropped = resolveGear("rev-drop", gear, emptyStore, first, [sell, discard]);
    expect(dropped.state.pocket.some((item) => item.name === "Waterskins")).toBe(false);
    expect(pocketActionRpcMissing({ code: "P0001", message: "bad kind" })).toBe(false);
  });

  it("stores the sell list in its own key and leaves the pocket-move log alone", () => {
    const store = memory();
    writeSellList(
      [
        { item: "Frog thorns", chest: "", qty: 6 },
        { item: "", chest: "", qty: 1 },
        { item: "Nope", chest: "", qty: 0 },
      ],
      store,
    );
    expect(readSellList(store)).toEqual([{ item: "Frog thorns", chest: "", qty: 6 }]);
    expect(store.data.has(SELL_LIST_KEY)).toBe(true);
    expect(store.data.has(ACTIONS_KEY)).toBe(false);
    expect(SELL_LIST_KEY).toBe("hwfwm-nate-maray-gear-v1:sell-list");
    expect(SELL_ACTIONS_KEY).not.toBe(ACTIONS_KEY);

    const sell: PocketAction = {
      id: "sell-1",
      kind: "sell",
      item: "Frog thorns",
      qty: "x6",
      chest: "",
      at: "2026-11-19T00:00:00.000Z",
      baseRev: sheet.rev,
    };
    writeSellActions([sell, { ...sell, id: "nope", kind: "discard" }], store);
    expect(readSellActions(store)).toEqual([{ ...sell, synced: false }]);
    writePocketActions([sell], store);
    expect(readPocketActions(store)).toEqual([]);
    store.setItem(SELL_LIST_KEY, "{");
    expect(readSellList(store)).toEqual([]);
  });
});
