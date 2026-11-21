import sheet from "./fixtures/campaign.json";
import backup from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import { equipItem, gearChangeActions, resolveGear, unequip, unwearWardrobeItem, wearWardrobeItem } from "./gear";
import { validateSheet } from "./sheet";
import type { GearSource, GearState, SheetData } from "./types";
import { readOutfits, readWardrobe, wardrobeGroups, wardrobeShapeOk, WARDROBE_SLOTS } from "./wardrobe";

const gear = sheet.gear as GearSource;
const emptyStore = { rev: null, equipped: null, pocket: null, loadouts: null };

const sample = [
  { name: "Worn boots", slot: "Shoes" as const, note: "The pair he arrived in." },
  { name: "Soft cap", slot: "Head" as const },
  { name: "Linen shirt", slot: "Torso" as const, qty: "", note: "Everyday." },
  { name: "Dark trousers", slot: "Legs" as const, qty: "x2" },
];

function withWardrobe(extra?: Partial<GearSource>): GearSource {
  return { ...gear, wardrobe: sample, outfits: [{ name: "Town", items: ["Soft cap", "Linen shirt", "Dark trousers", "Worn boots"] }], ...extra };
}

describe("wardrobe", () => {
  it("keeps a sheet with no wardrobe valid, and accepts clothes plus outfits", () => {
    expect(validateSheet(backup)).toBeNull();
    expect(validateSheet(sheet)).toBeNull();
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear = withWardrobe();
    expect(validateSheet(copy)).toBeNull();
    expect(validateSheet({ ...copy, gear: { ...copy.gear, wardrobe: [], outfits: [] } })).toBeNull();
  });

  it("rejects a bad slot, a missing name, a qty that is not text or a number, and a bad outfit list", () => {
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear = { ...gear, wardrobe: [{ name: "Gloves", slot: "Hands" as "Head" }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ name: "", slot: "Head" }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ slot: "Head" }] as unknown as GearSource["wardrobe"] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ name: "Soft cap", slot: "Head", qty: true as unknown as string }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ name: "Soft cap", slot: "Head", qty: Number.POSITIVE_INFINITY as unknown as string }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: "cap" as unknown as GearSource["wardrobe"] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, outfits: [{ name: "Town", items: ["Soft cap", 1 as unknown as string] }] };
    expect(validateSheet(copy)).toMatch(/outfits/);
    copy.gear = { ...gear, outfits: { name: "Town" } as unknown as GearSource["outfits"] };
    expect(validateSheet(copy)).toMatch(/outfits/);
  });

  it("lists clothes head to toe and does not spend pocket slots", () => {
    const clothes = readWardrobe({ wardrobe: sample });
    expect(wardrobeGroups(clothes, "All").map((group) => group.slot)).toEqual(["Head", "Torso", "Legs", "Shoes"]);
    expect(wardrobeGroups(clothes, "All").map((group) => group.items.map((item) => item.name))).toEqual([
      ["Soft cap"],
      ["Linen shirt"],
      ["Dark trousers"],
      ["Worn boots"],
    ]);
    expect(wardrobeGroups(clothes, "Face")).toEqual([{ slot: "Face", items: [] }]);
    expect(wardrobeGroups(clothes, "Head")[0].items.map((item) => item.name)).toEqual(["Soft cap"]);
    expect(readWardrobe({})).toEqual([]);
    expect(readWardrobe({ wardrobe: [] })).toEqual([]);
    expect(readOutfits({})).toEqual([]);
    expect(readOutfits({ outfits: [{ name: "Town", items: ["Soft cap"] }] })).toEqual([{ name: "Town", items: ["Soft cap"] }]);
    expect(readOutfits({ outfits: [{ name: "Town", items: ["Soft cap"], pieces: [{ name: "Soft cap", slot: "Head", source: "wardrobe" }] }] })[0].pieces).toEqual([
      { name: "Soft cap", slot: "Head", source: "wardrobe" },
    ]);

    const source = withWardrobe();
    const plain = resolveGear(sheet.rev, gear, emptyStore, null).state;
    const dressed = resolveGear(sheet.rev, source, emptyStore, null).state;
    expect(dressed.pocket.map((item) => item.name)).toEqual(plain.pocket.map((item) => item.name));
    expect(dressed.equipped).toEqual(plain.equipped);
    expect(dressed.loadouts).toEqual(plain.loadouts);
    expect(dressed.pocket.some((item) => item.name === "Soft cap" || item.name === "Worn boots")).toBe(false);
    const slots = source.pocketSlots || 40;
    expect(dressed.pocket.length).toBe(plain.pocket.length);
    expect(dressed.pocket.length).toBeLessThanOrEqual(slots);
    expect(dressed.pocket.length + clothes.length).toBeGreaterThan(dressed.pocket.length);

    const knife = dressed.pocket.find((item) => item.name === "Kitchen knife") as GearState["pocket"][number];
    const equipped = equipItem(dressed, source, knife);
    expect(equipped?.equipped.some((slot) => slot.name === "Kitchen knife")).toBe(true);
    expect(equipped?.pocket.some((item) => item.name === "Soft cap")).toBe(false);
    const belt = equipped?.equipped.find((slot) => slot.name === "Kitchen knife")?.slot;
    const back = unequip(equipped as GearState, source, belt || "");
    expect(back?.pocket.some((item) => item.name === "Kitchen knife")).toBe(true);
    expect(back?.pocket.some((item) => item.name === "Linen shirt")).toBe(false);
  });

  it("accepts an Outfit and keeps a numeric qty without hiding the rest of the wardrobe", () => {
    expect(WARDROBE_SLOTS[0]).toBe("Outfit");
    const rows = [
      { name: "Bespoke armour set", slot: "Outfit" as const, qty: 1 as unknown as string, note: "Worn as one." },
      { name: "Soft cap", slot: "Head" as const, qty: "x1" },
    ];
    expect(wardrobeShapeOk(rows)).toBe(true);
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear = { ...gear, wardrobe: rows };
    expect(validateSheet(copy)).toBeNull();
    const items = readWardrobe({ wardrobe: rows });
    expect(items).toEqual([
      { name: "Bespoke armour set", slot: "Outfit", qty: "1", note: "Worn as one." },
      { name: "Soft cap", slot: "Head", qty: "x1" },
    ]);
    expect(wardrobeGroups(items, "All").map((group) => group.slot)).toEqual(["Outfit", "Head"]);
    expect(wardrobeGroups(items, "Outfit")).toEqual([{ slot: "Outfit", items: [items[0]] }]);
  });

  it("equips an Outfit on Body and unequips it back to the wardrobe, not the pocket", () => {
    const outfit = { name: "Bespoke armour set", slot: "Outfit" as const };
    const shirt = { name: "Linen shirt", slot: "Torso" as const };
    const source = withWardrobe({ wardrobe: [outfit, shirt] });
    const state = resolveGear(sheet.rev, source, emptyStore, null).state;
    const withShirt = wearWardrobeItem(state, shirt);
    const worn = wearWardrobeItem(withShirt as GearState, outfit);
    expect(withShirt && worn).toBeTruthy();
    const dressed = worn as GearState;
    expect(dressed.equipped.find((slot) => slot.slot === "Body")?.clothes).toEqual([
      { name: "Bespoke armour set", slot: "Outfit" },
      { name: "Linen shirt", slot: "Torso" },
    ]);
    expect(dressed.pocket.map((item) => item.name)).toEqual(state.pocket.map((item) => item.name));
    expect(gearChangeActions(state, dressed).map((action) => `${action.kind}:${action.item}:${action.slot}`)).toEqual([
      "equip:Bespoke armour set:Body",
      "equip:Linen shirt:Body",
    ]);

    const withoutOutfit = unwearWardrobeItem(dressed, outfit.name);
    const off = unwearWardrobeItem(withoutOutfit as GearState, shirt.name) as GearState;
    expect(off.equipped.find((slot) => slot.slot === "Body")?.clothes ?? []).toEqual([]);
    expect(off.pocket).toEqual(state.pocket);
    expect(off.pocket.some((item) => item.name === outfit.name || item.name === shirt.name)).toBe(false);
    expect(readWardrobe(source).map((item) => item.name)).toEqual([outfit.name, shirt.name]);
    const removed = gearChangeActions(dressed, off);
    expect(removed.map((action) => `${action.kind}:${action.item}:${action.slot}`)).toEqual([
      "unequip:Bespoke armour set:Body",
      "unequip:Linen shirt:Body",
    ]);

    const replayed = resolveGear(
      "rev-outfit-off",
      source,
      { rev: sheet.rev, equipped: dressed.equipped, pocket: dressed.pocket, loadouts: dressed.loadouts },
      null,
      removed,
    );
    expect(replayed.state.equipped.find((slot) => slot.slot === "Body")?.clothes ?? []).toEqual([]);
    expect(replayed.state.pocket.some((item) => item.name === outfit.name || item.name === shirt.name)).toBe(false);
    expect(replayed.state.pocket.map((item) => item.name)).toEqual(state.pocket.map((item) => item.name));
  });

  it("does not pocket a wardrobe piece that was the doll slot's name", () => {
    const source = withWardrobe({ wardrobe: [{ name: "Travel clothes", slot: "Outfit" as const }] });
    const state = resolveGear(sheet.rev, source, emptyStore, null).state;
    expect(state.equipped.find((slot) => slot.slot === "Body")?.name).toBe("Travel clothes");
    expect(state.pocket.some((item) => item.name === "Travel clothes")).toBe(false);

    const off = unequip(state, source, "Body");
    expect(off?.equipped.find((slot) => slot.slot === "Body")?.name).toBe("");
    expect(off?.pocket.some((item) => item.name === "Travel clothes")).toBe(false);
    expect(readWardrobe(source).some((item) => item.name === "Travel clothes" && item.slot === "Outfit")).toBe(true);

    const next = resolveGear(
      "rev-outfit-name",
      source,
      { rev: sheet.rev, equipped: off?.equipped ?? [], pocket: off?.pocket ?? [], loadouts: off?.loadouts ?? [] },
      null,
      gearChangeActions(state, off as GearState),
    );
    expect(next.state.equipped.find((slot) => slot.slot === "Body")?.name).toBe("");
    expect(next.state.pocket.some((item) => item.name === "Travel clothes")).toBe(false);
  });
});
