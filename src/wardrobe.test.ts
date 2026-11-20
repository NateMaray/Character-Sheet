import sheet from "./fixtures/campaign.json";
import backup from "../public/data/nate.json";
import { describe, expect, it } from "vitest";
import { equipItem, resolveGear, unequip } from "./gear";
import { validateSheet } from "./sheet";
import type { GearSource, GearState, SheetData } from "./types";
import { readOutfits, readWardrobe, wardrobeGroups } from "./wardrobe";

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

  it("rejects a bad slot, a missing name, a non-string qty, and a bad outfit list", () => {
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear = { ...gear, wardrobe: [{ name: "Gloves", slot: "Hands" as "Head" }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ name: "", slot: "Head" }] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ slot: "Head" }] as unknown as GearSource["wardrobe"] };
    expect(validateSheet(copy)).toMatch(/wardrobe/);
    copy.gear = { ...gear, wardrobe: [{ name: "Soft cap", slot: "Head", qty: 2 as unknown as string }] };
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
});
