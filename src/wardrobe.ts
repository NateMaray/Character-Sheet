import type { GearSource, LookPiece, WardrobeItem, WardrobeOutfit, WardrobeSlot } from "./types";

/** Outfit first, then head to toe. The wardrobe view and its filter buttons use this order. */
export const WARDROBE_SLOTS = ["Outfit", "Head", "Face", "Neck", "Torso", "Wrist", "Waist", "Legs", "Shoes"] as const satisfies readonly WardrobeSlot[];

export type WardrobeFilter = "All" | WardrobeSlot;

const SLOT_SET = new Set<string>(WARDROBE_SLOTS);

export function isWardrobeSlot(value: unknown): value is WardrobeSlot {
  return typeof value === "string" && SLOT_SET.has(value);
}

/** Headwear sits on the doll's Head. Outfit and every other clothes slot share Body. */
export function dollSlotForWardrobe(slot: WardrobeSlot): "Head" | "Body" {
  return slot === "Head" ? "Head" : "Body";
}

/** A stored qty may be text or a finite number. A number is kept as its digits. */
function wardrobeQty(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

/** Missing or empty wardrobe is an empty list. Bad rows are skipped; the validator rejects them first. */
export function readWardrobe(gear: Pick<GearSource, "wardrobe">): WardrobeItem[] {
  if (!Array.isArray(gear.wardrobe)) return [];
  const items: WardrobeItem[] = [];
  for (const entry of gear.wardrobe) {
    if (!entry || typeof entry.name !== "string" || !isWardrobeSlot(entry.slot)) continue;
    const item: WardrobeItem = { name: entry.name, slot: entry.slot };
    const qty = wardrobeQty(entry.qty);
    if (qty !== undefined) item.qty = qty;
    if (typeof entry.note === "string") item.note = entry.note;
    items.push(item);
  }
  return items;
}

export function sanitizePieces(value: unknown): LookPiece[] {
  if (!Array.isArray(value)) return [];
  const pieces: LookPiece[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Partial<LookPiece>;
    if (typeof row.name !== "string" || !row.name.trim()) continue;
    if (typeof row.slot !== "string" || !row.slot.trim()) continue;
    if (row.source !== "wardrobe" && row.source !== "gear") continue;
    const piece: LookPiece = { name: row.name.trim(), slot: row.slot.trim(), source: row.source };
    if (pieces.some((item) => item.name === piece.name && item.slot === piece.slot && item.source === piece.source)) continue;
    pieces.push(piece);
  }
  return pieces;
}

export function readOutfits(gear: Pick<GearSource, "outfits">): WardrobeOutfit[] {
  if (!Array.isArray(gear.outfits)) return [];
  const outfits: WardrobeOutfit[] = [];
  for (const entry of gear.outfits) {
    if (!entry || typeof entry.name !== "string" || !entry.name.trim() || !Array.isArray(entry.items)) continue;
    if (!entry.items.every((name) => typeof name === "string")) continue;
    const outfit: WardrobeOutfit = { name: entry.name.trim(), items: entry.items.slice() };
    const pieces = sanitizePieces(entry.pieces);
    if (pieces.length || Array.isArray(entry.pieces)) outfit.pieces = pieces;
    outfits.push(outfit);
  }
  return outfits;
}

/** Groups in wardrobe order, Outfit first. All hides empty slots. A single category stays, even when empty. */
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
    if (wardrobeQty(row.qty) === undefined && row.qty !== undefined) return false;
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
    if (row.pieces === undefined) return true;
    if (!Array.isArray(row.pieces)) return false;
    return row.pieces.every((piece) => {
      if (!piece || typeof piece !== "object" || Array.isArray(piece)) return false;
      const rowPiece = piece as Record<string, unknown>;
      if (typeof rowPiece.name !== "string" || rowPiece.name.length === 0) return false;
      if (typeof rowPiece.slot !== "string" || rowPiece.slot.length === 0) return false;
      return rowPiece.source === "wardrobe" || rowPiece.source === "gear";
    });
  });
}
