import type { EquipSlot, GearSource, LookPiece, WardrobeOutfit } from "./types";
import { dollSlotForWardrobe, readOutfits, readWardrobe, sanitizePieces } from "./wardrobe";

/** The phone shows ten slots and will not save an eleventh look. */
export const MAX_LOOKS = 10;

export function normalizeLooks(value: unknown): WardrobeOutfit[] {
  const parsed = Array.isArray(value) ? readOutfits({ outfits: value as WardrobeOutfit[] }) : [];
  const looks: WardrobeOutfit[] = [];
  for (const look of parsed) {
    if (looks.length >= MAX_LOOKS) break;
    if (looks.some((entry) => entry.name === look.name)) continue;
    looks.push(look);
  }
  return looks;
}

function pieceKey(piece: LookPiece): string {
  return `${piece.source}\n${piece.slot}\n${piece.name}`;
}

/** What is on the doll right now, skipping borrowed gear. Empty slots are left out. */
export function capturePieces(equipped: EquipSlot[], borrowed: string[]): LookPiece[] {
  const borrowedNames = new Set(borrowed);
  const pieces: LookPiece[] = [];
  const seen = new Set<string>();
  for (const slot of equipped) {
    for (const cloth of slot.clothes || []) {
      if (!cloth || typeof cloth.name !== "string" || !cloth.name) continue;
      const piece: LookPiece = { name: cloth.name, slot: slot.slot, source: "wardrobe" };
      const key = pieceKey(piece);
      if (seen.has(key)) continue;
      seen.add(key);
      pieces.push(piece);
    }
    if (!slot.name || borrowedNames.has(slot.name)) continue;
    const piece: LookPiece = { name: slot.name, slot: slot.slot, source: "gear" };
    const key = pieceKey(piece);
    if (seen.has(key)) continue;
    seen.add(key);
    pieces.push(piece);
  }
  return pieces;
}

export function lookFromPieces(name: string, pieces: LookPiece[]): WardrobeOutfit | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const clean = sanitizePieces(pieces);
  return { name: trimmed, items: clean.map((piece) => piece.name), pieces: clean };
}

/** Insert or overwrite by name. A new name past the cap returns null. */
export function saveLook(looks: WardrobeOutfit[], look: WardrobeOutfit): WardrobeOutfit[] | null {
  const next: WardrobeOutfit[] = looks.map((entry) => {
    const copy: WardrobeOutfit = { name: entry.name, items: entry.items.slice() };
    if (entry.pieces) copy.pieces = entry.pieces.map((piece) => ({ ...piece }));
    return copy;
  });
  const index = next.findIndex((entry) => entry.name === look.name);
  if (index >= 0) {
    next[index] = look;
    return next;
  }
  if (next.length >= MAX_LOOKS) return null;
  next.push(look);
  return next;
}

export function renameLook(looks: WardrobeOutfit[], from: string, to: string): WardrobeOutfit[] | null {
  const trimmed = to.trim();
  if (!trimmed || trimmed === from) return null;
  if (!looks.some((entry) => entry.name === from)) return null;
  if (looks.some((entry) => entry.name === trimmed)) return null;
  return looks.map((entry) => (entry.name === from ? { ...entry, name: trimmed } : entry));
}

export function deleteLook(looks: WardrobeOutfit[], name: string): WardrobeOutfit[] {
  return looks.filter((entry) => entry.name !== name);
}

/** Pieces stored on the look, or names from an older outfit row. */
export function piecesFromLook(look: WardrobeOutfit, gear: Pick<GearSource, "wardrobe" | "equipTargets">): LookPiece[] {
  if (look.pieces) return sanitizePieces(look.pieces);
  const wardrobe = readWardrobe(gear);
  const pieces: LookPiece[] = [];
  for (const name of look.items) {
    const cloth = wardrobe.find((item) => item.name === name);
    if (cloth) {
      pieces.push({ name, slot: dollSlotForWardrobe(cloth.slot), source: "wardrobe" });
      continue;
    }
    const slot = (gear.equipTargets[name] || [])[0];
    if (!slot) continue;
    pieces.push({ name, slot, source: "gear" });
  }
  return pieces;
}
