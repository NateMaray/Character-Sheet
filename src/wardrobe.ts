import type { GearSource, WardrobeItem, WardrobeOutfit, WardrobeSlot } from "./types";

/** Head to toe. The wardrobe view and its filter buttons use this order. */
export const WARDROBE_SLOTS = ["Head", "Face", "Neck", "Torso", "Wrist", "Waist", "Legs", "Shoes"] as const satisfies readonly WardrobeSlot[];

export type WardrobeFilter = "All" | WardrobeSlot;

const SLOT_SET = new Set<string>(WARDROBE_SLOTS);

export function isWardrobeSlot(value: unknown): value is WardrobeSlot {
  return typeof value === "string" && SLOT_SET.has(value);
}

/** Missing or empty wardrobe is an empty list. Bad rows are skipped; the validator rejects them first. */
export function readWardrobe(gear: Pick<GearSource, "wardrobe">): WardrobeItem[] {
  if (!Array.isArray(gear.wardrobe)) return [];
  const items: WardrobeItem[] = [];
  for (const entry of gear.wardrobe) {
    if (!entry || typeof entry.name !== "string" || !isWardrobeSlot(entry.slot)) continue;
    const item: WardrobeItem = { name: entry.name, slot: entry.slot };
    if (typeof entry.qty === "string") item.qty = entry.qty;
    if (typeof entry.note === "string") item.note = entry.note;
    items.push(item);
  }
  return items;
}

export function readOutfits(gear: Pick<GearSource, "outfits">): WardrobeOutfit[] {
  if (!Array.isArray(gear.outfits)) return [];
  const outfits: WardrobeOutfit[] = [];
  for (const entry of gear.outfits) {
    if (!entry || typeof entry.name !== "string" || !Array.isArray(entry.items)) continue;
    if (!entry.items.every((name) => typeof name === "string")) continue;
    outfits.push({ name: entry.name, items: entry.items.slice() });
  }
  return outfits;
}

/** Groups in head-to-toe order. All hides empty slots. A single category stays, even when empty. */
export function wardrobeGroups(items: WardrobeItem[], filter: WardrobeFilter): { slot: WardrobeSlot; items: WardrobeItem[] }[] {
  const slots: readonly WardrobeSlot[] = filter === "All" ? WARDROBE_SLOTS : [filter];
  const groups = slots.map((slot) => ({ slot, items: items.filter((item) => item.slot === slot) }));
  if (filter === "All") return groups.filter((group) => group.items.length > 0);
  return groups;
}

export function wardrobeShapeOk(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || row.name.length === 0) return false;
    if (!isWardrobeSlot(row.slot)) return false;
    if (row.qty !== undefined && typeof row.qty !== "string") return false;
    if (row.note !== undefined && typeof row.note !== "string") return false;
    return true;
  });
}

export function outfitsShapeOk(value: unknown): boolean {
  if (value === undefined) return true;
  if (!Array.isArray(value)) return false;
  return value.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const row = item as Record<string, unknown>;
    if (typeof row.name !== "string" || row.name.length === 0) return false;
    if (!Array.isArray(row.items) || !row.items.every((name) => typeof name === "string")) return false;
    return true;
  });
}
