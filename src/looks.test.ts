import sheet from "./fixtures/campaign.json";
import { describe, expect, it } from "vitest";
import { resolveGear, wearLook } from "./gear";
import { MAX_LOOKS, capturePieces, deleteLook, lookFromPieces, normalizeLooks, piecesFromLook, renameLook, saveLook } from "./looks";
import { validateSheet } from "./sheet";
import { pocketActionRpcArgs } from "./supabase";
import type { GearSource, LookPiece, PocketAction, SheetData, WardrobeOutfit } from "./types";

const gear = sheet.gear as GearSource;
const emptyStore = { rev: null, equipped: null, pocket: null, loadouts: null };

const wardrobe = [
  { name: "Soft cap", slot: "Head" as const },
  { name: "Linen shirt", slot: "Torso" as const },
  { name: "Dark trousers", slot: "Legs" as const },
];

function source(): GearSource {
  return { ...gear, wardrobe };
}

function fresh() {
  return resolveGear(sheet.rev, source(), emptyStore, null).state;
}

function move(partial: Pick<PocketAction, "id" | "kind" | "item"> & Partial<PocketAction>): PocketAction {
  return {
    qty: "",
    chest: "",
    at: "2026-11-20T00:00:00.000Z",
    baseRev: sheet.rev,
    ...partial,
  };
}

describe("saved looks", () => {
  it("captures worn clothes and owned gear, skips borrowed gear, and caps at 10", () => {
    const state = fresh();
    const shirt = source().wardrobe?.find((item) => item.name === "Linen shirt");
    const wearing = {
      ...state,
      equipped: state.equipped.map((slot) =>
        slot.slot === "Body" ? { ...slot, clothes: [{ name: shirt!.name, slot: shirt!.slot }] } : slot,
      ),
    };
    const pieces = capturePieces(wearing.equipped, source().borrowed);
    expect(pieces).toContainEqual({ name: "Linen shirt", slot: "Body", source: "wardrobe" });
    expect(pieces).toContainEqual({ name: "War Hammer", slot: "Main hand", source: "gear" });
    expect(pieces.some((piece) => piece.name === "Tanner's lantern")).toBe(false);

    let looks: WardrobeOutfit[] = [];
    for (let index = 0; index < MAX_LOOKS; index += 1) {
      const look = lookFromPieces(`Look ${index}`, pieces);
      expect(look).not.toBeNull();
      looks = saveLook(looks, look!)!;
    }
    expect(looks).toHaveLength(10);
    expect(saveLook(looks, lookFromPieces("One more", pieces)!)).toBeNull();
    const replaced = saveLook(looks, lookFromPieces("Look 0", [{ name: "Soft cap", slot: "Head", source: "wardrobe" }])!);
    expect(replaced).toHaveLength(10);
    expect(replaced?.find((look) => look.name === "Look 0")?.items).toEqual(["Soft cap"]);
    expect(renameLook(replaced!, "Look 1", "Market")).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Market" })]),
    );
    expect(renameLook(replaced!, "Look 1", "Look 2")).toBeNull();
    expect(deleteLook(replaced!, "Look 3").some((look) => look.name === "Look 3")).toBe(false);
    expect(normalizeLooks([...(replaced || []), { name: "Look 0", items: ["dup"] }])).toHaveLength(10);
  });

  it("wears a look onto the doll and replays save, wear, and delete until they are applied", () => {
    const dressed = source();
    const state = fresh();
    const pieces: LookPiece[] = [
      { name: "Linen shirt", slot: "Body", source: "wardrobe" },
      { name: "Dark trousers", slot: "Body", source: "wardrobe" },
      { name: "Kitchen knife", slot: "Belt / sheath", source: "gear" },
    ];
    const worn = wearLook(state, pieces, dressed);
    expect(worn.equipped.find((slot) => slot.slot === "Body")?.clothes?.map((piece) => piece.name)).toEqual(["Linen shirt", "Dark trousers"]);
    expect(worn.equipped.find((slot) => slot.slot === "Belt / sheath")?.name).toBe("Kitchen knife");
    expect(worn.pocket.some((item) => item.name === "Linen shirt" || item.name === "Dark trousers")).toBe(false);
    expect(worn.pocket.some((item) => item.name === "Fighting Knife")).toBe(true);
    expect(worn.pocket.length).toBe(state.pocket.length);

    const look = lookFromPieces("Town", pieces)!;
    const save = move({ id: "save-town", kind: "save_look", item: "Town", detail: look.pieces });
    const wear = move({ id: "wear-town", kind: "wear_look", item: "Town", detail: look.pieces });
    const replayed = resolveGear("rev-look", dressed, emptyStore, state, [save, wear]);
    expect(replayed.state.looks.map((entry) => entry.name)).toEqual(["Town"]);
    expect(replayed.state.equipped.find((slot) => slot.slot === "Body")?.clothes?.map((piece) => piece.name)).toEqual(["Linen shirt", "Dark trousers"]);
    expect(replayed.state.equipped.find((slot) => slot.slot === "Belt / sheath")?.name).toBe("Kitchen knife");
    expect(pocketActionRpcArgs(save).p_item).toBe("Town");
    expect(JSON.parse(pocketActionRpcArgs(save).p_chest)).toEqual(look.pieces);

    const applied: GearSource = {
      ...dressed,
      appliedActions: ["save-town", "wear-town"],
      outfits: [look],
      equipped: dressed.equipped.map((slot) =>
        slot.slot === "Body" ? { ...slot, clothes: [{ name: "Linen shirt", slot: "Torso" }] } : slot,
      ),
    };
    const settled = resolveGear("rev-look-acked", applied, emptyStore, worn, [save, wear]);
    expect(settled.actions).toEqual([]);
    expect(settled.state.looks.map((entry) => entry.name)).toEqual(["Town"]);
    expect(settled.state.equipped.find((slot) => slot.slot === "Body")?.clothes?.map((piece) => piece.name)).toEqual(["Linen shirt"]);
    expect(settled.state.equipped.find((slot) => slot.slot === "Belt / sheath")?.name).toBe("Fighting Knife");

    const legacy: WardrobeOutfit = { name: "Town", items: ["Soft cap", "Linen shirt"] };
    expect(piecesFromLook(legacy, dressed).map((piece) => piece.slot)).toEqual(["Head", "Body"]);
  });

  it("accepts look pieces and worn clothes, and rejects a bad piece", () => {
    const copy = structuredClone(sheet) as unknown as SheetData;
    copy.gear = {
      ...gear,
      wardrobe,
      outfits: [{ name: "Town", items: ["Linen shirt"], pieces: [{ name: "Linen shirt", slot: "Body", source: "wardrobe" }] }],
      equipped: gear.equipped.map((slot) => (slot.slot === "Body" ? { ...slot, clothes: [{ name: "Linen shirt", slot: "Torso" }] } : slot)),
    };
    expect(validateSheet(copy)).toBeNull();
    copy.gear = { ...copy.gear, outfits: [{ name: "Town", items: ["Linen shirt"], pieces: [{ name: "Linen shirt" }] as unknown as LookPiece[] }] };
    expect(validateSheet(copy)).toMatch(/outfits/);
    copy.gear = {
      ...gear,
      equipped: gear.equipped.map((slot) => (slot.slot === "Head" ? { ...slot, clothes: [{ name: "Soft cap", slot: "Hat" as "Head" }] } : slot)),
    };
    expect(validateSheet(copy)).toMatch(/clothes/);
  });
});
