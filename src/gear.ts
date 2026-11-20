import { deleteLook, lookFromPieces, normalizeLooks, renameLook, saveLook } from "./looks";
import type { EquipSlot, GearItem, GearLoadout, GearSource, GearState, LookDetail, LookPiece, PocketAction, WardrobeItem, WardrobeOutfit, WornCloth } from "./types";
import { dollSlotForWardrobe, isWardrobeSlot, readWardrobe, sanitizePieces, WARDROBE_SLOTS } from "./wardrobe";

export type { GearState };

export const GEAR_PREFIX = "hwfwm-nate-maray-gear-v1:";
export const ACTIONS_KEY = GEAR_PREFIX + "actions";
export const LOOKS_KEY = GEAR_PREFIX + "looks";
export const PINS_KEY = "hwfwm-nate-maray-ui-v1:pins";

/** Kinds the phone still keeps locally when log_pocket_action rejects them. */
export const SOFT_SYNC_KINDS = ["equip", "unequip", "save_look", "delete_look", "wear_look", "rename_look"] as const;

export function softSyncKind(kind: string): boolean {
  return (SOFT_SYNC_KINDS as readonly string[]).indexOf(kind) >= 0;
}

export const TABS = [
  { value: "map", label: "Map", short: "Map" },
  { value: "status", label: "Status", short: "Status" },
  { value: "abilities", label: "Abilities", short: "Abilities" },
  { value: "pocket", label: "Pocket Space", short: "Pocket" },
  { value: "equipment", label: "Equipment", short: "Equip" },
  { value: "missions", label: "Missions", short: "Missions" },
  { value: "essences", label: "Essences", short: "Essences" },
  { value: "feats", label: "Achievements", short: "Feats" },
  { value: "profile", label: "Profile", short: "Profile" },
] as const;

export type TabId = (typeof TABS)[number]["value"];

export const DEFAULT_PINS: TabId[] = ["map", "status", "equipment", "pocket"];
export const MAX_PINS = 5;

export const DEFAULT_DOLL: string[][] = [
  ["", "Head", ""],
  ["Back", "Body", "Armour"],
  ["Main hand", "Belt / sheath", "Off hand"],
];

type Store = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function browserStore(): Store | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isBorrowed(name: string, borrowed: string[]): boolean {
  return borrowed.indexOf(name) >= 0;
}

export function emptySlot(slot: string, labels: Record<string, string>): EquipSlot {
  return { slot, name: "", empty: labels[slot] || "empty", note: "", qty: "" };
}

export function withClothes(slot: EquipSlot, clothes: WornCloth[] | undefined): EquipSlot {
  const next: EquipSlot = { slot: slot.slot, name: slot.name, empty: slot.empty, note: slot.note, qty: slot.qty };
  if (clothes?.length) next.clothes = clothes.map((piece) => ({ name: piece.name, slot: piece.slot }));
  return next;
}

/** Keep only pieces that are still in the wardrobe. The wardrobe row supplies the category. */
export function cleanClothes(value: unknown, gear: Pick<GearSource, "wardrobe">): WornCloth[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const known = new Map(readWardrobe(gear).map((item) => [item.name, item.slot]));
  const clothes: WornCloth[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const name = (entry as { name?: unknown }).name;
    if (typeof name !== "string" || !known.has(name)) continue;
    if (clothes.some((piece) => piece.name === name)) continue;
    const slot = known.get(name);
    if (!slot || !isWardrobeSlot(slot)) continue;
    clothes.push({ name, slot });
  }
  if (!clothes.length) return undefined;
  return clothes.sort((a, b) => WARDROBE_SLOTS.indexOf(a.slot) - WARDROBE_SLOTS.indexOf(b.slot));
}

export function fillSlot(slot: string, item: GearItem, clothes?: WornCloth[]): EquipSlot {
  return withClothes({ slot, name: item.name, empty: "", note: item.note, qty: item.qty }, clothes);
}

export function toGear(slot: EquipSlot): GearItem {
  return { name: slot.name, qty: slot.qty, note: slot.note };
}

export function removeOne(items: GearItem[], name: string): GearItem[] {
  const i = items.findIndex((it) => it.name === name);
  if (i < 0) return items;
  return items.filter((_, j) => j !== i);
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/** A container is any pocket item whose `contents` array is present, including an empty chest. */
export function isContainer(item: GearItem): boolean {
  return Array.isArray(item.contents);
}

function copyItem(item: GearItem): GearItem {
  const next: GearItem = { name: item.name, qty: asText(item.qty), note: asText(item.note) };
  if (Array.isArray(item.contents)) {
    next.contents = item.contents
      .filter((entry) => entry && typeof entry.name === "string")
      .map((entry) => ({ name: entry.name, qty: asText(entry.qty), note: asText(entry.note) }));
  }
  return next;
}

/** Owned pocket and worn items. Wardrobe clothes stay on `gear.wardrobe` and never take a pocket slot. */
export function sourceCatalog(gear: GearSource): GearItem[] {
  const byName: Record<string, GearItem> = {};
  for (const item of gear.pocket) byName[item.name] = copyItem(item);
  for (const slot of gear.equipped) {
    if (slot.name && !byName[slot.name] && !isBorrowed(slot.name, gear.borrowed)) {
      byName[slot.name] = { name: slot.name, qty: slot.qty || "", note: slot.note };
    }
  }
  return Object.keys(byName).map((key) => byName[key]);
}

function withSourceItem(catalog: GearItem[], item: GearItem): GearItem {
  const src = catalog.filter((entry) => entry.name === item.name)[0];
  return copyItem(src || item);
}

export function initialEquipped(gear: GearSource): EquipSlot[] {
  return gear.equipped.map((slot) =>
    withClothes(
      {
        slot: slot.slot,
        name: slot.name,
        empty: slot.name ? "" : slot.empty || emptySlot(slot.slot, gear.emptyLabels).empty,
        note: slot.note || "",
        qty: slot.qty || "",
      },
      cleanClothes(slot.clothes, gear),
    ),
  );
}

export function initialPocket(gear: GearSource): GearItem[] {
  const worn = new Set(gear.equipped.filter((slot) => slot.name).map((slot) => slot.name));
  return gear.pocket.filter((item) => !worn.has(item.name)).map(copyItem);
}

export function defaultLoadouts(gear: GearSource): GearLoadout[] {
  if (gear.defaultLoadouts && gear.defaultLoadouts.length) {
    return gear.defaultLoadouts.map((loadout) => ({
      name: loadout.name,
      equipped: loadout.equipped.map((slot) => ({
        slot: slot.slot,
        name: slot.name,
        empty: slot.name ? "" : slot.empty || emptySlot(slot.slot, gear.emptyLabels).empty,
        note: slot.note || "",
        qty: slot.qty || "",
      })),
    }));
  }
  const initial = initialEquipped(gear);
  return [
    {
      name: "Combat",
      equipped: initial.map((slot) => (isBorrowed(slot.name, gear.borrowed) ? emptySlot(slot.slot, gear.emptyLabels) : { ...slot })),
    },
    {
      name: "Travel",
      equipped: initial.map((slot) =>
        slot.slot === "Main hand" || slot.slot === "Off hand" ? emptySlot(slot.slot, gear.emptyLabels) : { ...slot },
      ),
    },
  ];
}

export function reconcileGear(
  savedEquipped: EquipSlot[],
  savedPocket: GearItem[],
  savedLoadouts: GearLoadout[],
  gear: GearSource,
): { equipped: EquipSlot[]; pocket: GearItem[]; loadouts: GearLoadout[] } {
  const catalog = sourceCatalog(gear);
  const sourceNames: Record<string, boolean> = {};
  for (const item of catalog) sourceNames[item.name] = true;
  const initial = initialEquipped(gear);
  const slots = initial.map((slot) => slot.slot);
  const kept = slots.map((slot) => {
    const saved = savedEquipped.filter((entry) => entry.slot === slot)[0];
    const clothes = cleanClothes(saved?.clothes, gear);
    if (saved && saved.name && sourceNames[saved.name]) return withClothes(fillSlot(slot, withSourceItem(catalog, saved)), clothes);
    return withClothes(emptySlot(slot, gear.emptyLabels), clothes);
  });
  const displaced: GearItem[] = [];
  const equipped = slots.map((slot, index) => {
    const current = kept[index];
    const src = gear.equipped.filter((entry) => entry.slot === slot)[0];
    if (src && src.name && isBorrowed(src.name, gear.borrowed)) {
      if (current.name && current.name !== src.name && !isBorrowed(current.name, gear.borrowed)) displaced.push(toGear(current));
      return withClothes({ slot, name: src.name, empty: "", note: src.note, qty: src.qty || "" }, current.clothes);
    }
    if (current.name && isBorrowed(current.name, gear.borrowed)) return withClothes(emptySlot(slot, gear.emptyLabels), current.clothes);
    return current;
  });
  const held: Record<string, boolean> = {};
  for (const slot of equipped) if (slot.name) held[slot.name] = true;
  let pocket = displaced.concat(
    savedPocket.filter((item) => sourceNames[item.name] && !held[item.name]).map((item) => withSourceItem(catalog, item)),
  );
  const present: Record<string, boolean> = {};
  for (const slot of equipped) if (slot.name) present[slot.name] = true;
  for (const item of pocket) present[item.name] = true;
  // Catalog rows are top-level only, so an item that exists solely inside a source chest is not added again.
  for (const item of catalog) {
    if (!present[item.name]) pocket = pocket.concat([withSourceItem(catalog, item)]);
  }
  const loadouts = savedLoadouts.map((loadout) => ({
    name: loadout.name,
    equipped: (loadout.equipped.length ? loadout.equipped : initial).map((slot) => {
      if (slot.name && !sourceNames[slot.name]) return emptySlot(slot.slot, gear.emptyLabels);
      if (slot.name) return fillSlot(slot.slot, withSourceItem(catalog, slot));
      return withClothes(
        { ...slot, qty: slot.qty || "", empty: slot.empty || emptySlot(slot.slot, gear.emptyLabels).empty, note: slot.note || "" },
        undefined,
      );
    }),
  }));
  return { equipped, pocket, loadouts };
}

export type StoredGear = {
  rev: string | null;
  equipped: EquipSlot[] | null;
  pocket: GearItem[] | null;
  loadouts: GearLoadout[] | null;
  /** Null when this phone has never stored looks. Omitted on older saves. */
  looks?: WardrobeOutfit[] | null;
};

function readJson<T>(store: Store | null, key: string, fallback: T): T {
  try {
    if (!store) return fallback;
    const raw = store.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // Fall back when storage is blocked or the value is not JSON.
  }
  return fallback;
}

export function readGearStore(store?: Store | null): StoredGear {
  const resolved = store === undefined ? browserStore() : store;
  return {
    rev: readJson<string | null>(resolved, GEAR_PREFIX + "rev", null),
    equipped: readJson<EquipSlot[] | null>(resolved, GEAR_PREFIX + "equipped", null),
    pocket: readJson<GearItem[] | null>(resolved, GEAR_PREFIX + "pocket", null),
    loadouts: readJson<GearLoadout[] | null>(resolved, GEAR_PREFIX + "loadouts", null),
    looks: readStoredLooks(resolved),
  };
}

function readStoredLooks(store: Store | null): WardrobeOutfit[] | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(LOOKS_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    return normalizeLooks(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeGearStore(state: GearState, store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(GEAR_PREFIX + "equipped", JSON.stringify(state.equipped));
    resolved.setItem(GEAR_PREFIX + "pocket", JSON.stringify(state.pocket));
    resolved.setItem(GEAR_PREFIX + "loadouts", JSON.stringify(state.loadouts));
    resolved.setItem(LOOKS_KEY, JSON.stringify(state.looks));
    resolved.setItem(GEAR_PREFIX + "rev", JSON.stringify(state.rev));
  } catch {
    // Keep the in-memory sheet if storage is blocked.
  }
}

function asItems(value: GearItem[] | null | undefined, fallback: GearItem[]): GearItem[] {
  return Array.isArray(value) ? value : fallback;
}

function asLoadouts(value: GearLoadout[] | null | undefined, fallback: GearLoadout[]): GearLoadout[] {
  return Array.isArray(value) ? value : fallback;
}

function looksFor(gear: GearSource, stored: WardrobeOutfit[] | null | undefined): WardrobeOutfit[] {
  if (Array.isArray(stored)) return normalizeLooks(stored);
  return normalizeLooks(gear.outfits);
}

/**
 * Same `rev`: keep the phone's doll, pocket, looks, and loadouts.
 * New `rev`: `gear.equipped` and `gear.outfits` are the base, then replay
 * pocket, equip, and look actions the DM has not listed in `appliedActions`.
 */
export function resolveGear(
  rev: string,
  gear: GearSource,
  stored: StoredGear,
  live: GearState | null,
  actions: PocketAction[] = [],
): { state: GearState; dirty: boolean; actions: PocketAction[] } {
  const kept = settlePocketActions(actions, gear.appliedActions);
  if (live && live.rev === rev) {
    if (Array.isArray(live.looks)) return { state: live, dirty: false, actions: kept };
    return { state: { ...live, looks: looksFor(gear, null) }, dirty: false, actions: kept };
  }
  const initialE = initialEquipped(gear);
  const initialP = initialPocket(gear);
  const initialL = defaultLoadouts(gear);
  if (!live && stored.rev === rev && Array.isArray(stored.equipped) && Array.isArray(stored.pocket) && Array.isArray(stored.loadouts)) {
    return {
      state: {
        rev,
        equipped: stored.equipped,
        pocket: stored.pocket,
        loadouts: stored.loadouts,
        looks: looksFor(gear, stored.looks),
      },
      dirty: false,
      actions: kept,
    };
  }
  const baseP = live ? live.pocket : asItems(stored.pocket, initialP);
  const baseL = live ? live.loadouts : asLoadouts(stored.loadouts, initialL);
  const next = reconcileGear(initialE, baseP, baseL, gear);
  const replayed = applyGearActions(
    { rev, equipped: next.equipped, pocket: next.pocket, loadouts: next.loadouts, looks: normalizeLooks(gear.outfits) },
    kept,
    gear,
  );
  return { state: replayed, dirty: true, actions: kept };
}

export function itemsForSlot(pocket: GearItem[], gear: GearSource, slotName: string): GearItem[] {
  return pocket.filter((item) => !isContainer(item) && (gear.equipTargets[item.name] || []).indexOf(slotName) >= 0);
}

export function equipToSlot(state: GearState, gear: GearSource, item: GearItem, slotName: string): GearState | null {
  const allowed = gear.equipTargets[item.name] || [];
  if (allowed.indexOf(slotName) < 0) return null;
  if (!state.equipped.some((slot) => slot.slot === slotName)) return null;
  const previous = state.equipped.find((slot) => slot.slot === slotName);
  let pocket = removeOne(state.pocket, item.name);
  if (previous && previous.name && !isBorrowed(previous.name, gear.borrowed)) pocket = [...pocket, toGear(previous)];
  return {
    ...state,
    pocket,
    equipped: state.equipped.map((slot) => (slot.slot === slotName ? withClothes(fillSlot(slot.slot, item), slot.clothes) : slot)),
  };
}

export function unequip(state: GearState, gear: GearSource, slotName: string): GearState | null {
  const current = state.equipped.find((slot) => slot.slot === slotName);
  if (!current || !current.name) return null;
  const pocket = isBorrowed(current.name, gear.borrowed) ? state.pocket : [...state.pocket, toGear(current)];
  return {
    ...state,
    pocket,
    equipped: state.equipped.map((slot) => (slot.slot === slotName ? withClothes(emptySlot(slotName, gear.emptyLabels), slot.clothes) : slot)),
  };
}

export function equipItem(state: GearState, gear: GearSource, item: GearItem): GearState | null {
  const targets = (gear.equipTargets[item.name] || []).filter((slot) => state.equipped.some((entry) => entry.slot === slot));
  if (!targets.length) return null;
  const dest = targets.find((slot) => !state.equipped.find((entry) => entry.slot === slot && entry.name)) || targets[0];
  return equipToSlot(state, gear, item, dest);
}

export function wornClothNames(equipped: EquipSlot[]): Set<string> {
  const names = new Set<string>();
  for (const slot of equipped) {
    for (const cloth of slot.clothes || []) names.add(cloth.name);
  }
  return names;
}

function insertCloth(list: WornCloth[] | undefined, cloth: WornCloth): WornCloth[] {
  const next = (list || []).filter((piece) => piece.name !== cloth.name).concat([cloth]);
  return next.sort((a, b) => WARDROBE_SLOTS.indexOf(a.slot) - WARDROBE_SLOTS.indexOf(b.slot));
}

/** Wear a wardrobe piece on Head or Body. It stays in the wardrobe and out of the pocket. */
export function wearWardrobeItem(state: GearState, item: WardrobeItem): GearState | null {
  const doll = dollSlotForWardrobe(item.slot);
  if (!state.equipped.some((slot) => slot.slot === doll)) return null;
  if (state.equipped.some((slot) => (slot.clothes || []).some((piece) => piece.name === item.name))) return state;
  const cloth: WornCloth = { name: item.name, slot: item.slot };
  return {
    ...state,
    equipped: state.equipped.map((slot) => (slot.slot === doll ? withClothes(slot, insertCloth(slot.clothes, cloth)) : slot)),
  };
}

export function unwearWardrobeItem(state: GearState, name: string): GearState | null {
  if (!state.equipped.some((slot) => (slot.clothes || []).some((piece) => piece.name === name))) return null;
  return {
    ...state,
    equipped: state.equipped.map((slot) =>
      (slot.clothes || []).some((piece) => piece.name === name) ? withClothes(slot, (slot.clothes || []).filter((piece) => piece.name !== name)) : slot,
    ),
  };
}

function setDollClothes(state: GearState, doll: "Head" | "Body", clothes: WornCloth[]): GearState {
  if (!state.equipped.some((slot) => slot.slot === doll)) return state;
  return {
    ...state,
    equipped: state.equipped.map((slot) => (slot.slot === doll ? withClothes(slot, clothes) : slot)),
  };
}

function moveGearToSlot(state: GearState, gear: GearSource, name: string, slotName: string): GearState {
  const current = state.equipped.find((slot) => slot.name === name);
  if (current?.slot === slotName) return state;
  let working = state;
  if (current) {
    const cleared = unequip(working, gear, current.slot);
    if (!cleared) return state;
    working = cleared;
  }
  const item = working.pocket.find((entry) => entry.name === name && !isContainer(entry));
  if (!item) return state;
  return equipToSlot(working, gear, item, slotName) ?? working;
}

function clothesForDoll(pieces: LookPiece[], doll: "Head" | "Body", gear: GearSource): WornCloth[] {
  const wardrobe = readWardrobe(gear);
  const clothes: WornCloth[] = [];
  for (const piece of pieces) {
    if (piece.source !== "wardrobe" || piece.slot !== doll) continue;
    const found = wardrobe.find((item) => item.name === piece.name);
    if (!found || clothes.some((cloth) => cloth.name === found.name)) continue;
    clothes.push({ name: found.name, slot: found.slot });
  }
  return clothes.sort((a, b) => WARDROBE_SLOTS.indexOf(a.slot) - WARDROBE_SLOTS.indexOf(b.slot));
}

/** Put on every piece in the look. Wardrobe clothes replace Head and Body clothes. Other doll slots stay. */
export function wearLook(state: GearState, pieces: LookPiece[], gear: GearSource): GearState {
  let next = setDollClothes(state, "Head", clothesForDoll(pieces, "Head", gear));
  next = setDollClothes(next, "Body", clothesForDoll(pieces, "Body", gear));
  for (const piece of pieces) {
    if (piece.source !== "gear") continue;
    next = moveGearToSlot(next, gear, piece.name, piece.slot);
  }
  return next;
}

export function loadLoadout(state: GearState, gear: GearSource, loadout: GearLoadout): GearState {
  const keep = new Set(loadout.equipped.filter((slot) => slot.name).map((slot) => slot.name));
  const held = state.equipped.filter((slot) => slot.name && !isBorrowed(slot.name, gear.borrowed)).map(toGear);
  const initial = initialEquipped(gear);
  return {
    ...state,
    pocket: stripNames([...held, ...state.pocket], keep),
    equipped: initial.map((slot) => {
      const found = loadout.equipped.find((entry) => entry.slot === slot.slot);
      const clothes = state.equipped.find((entry) => entry.slot === slot.slot)?.clothes;
      const next = found && found.name ? { ...found, qty: found.qty || "" } : emptySlot(slot.slot, gear.emptyLabels);
      return withClothes(next, clothes);
    }),
  };
}

export function saveLoadout(state: GearState, name: string): GearState | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const snap: GearLoadout = { name: trimmed, equipped: state.equipped.map((slot) => withClothes(slot, undefined)) };
  return { ...state, loadouts: [...state.loadouts.filter((loadout) => loadout.name !== trimmed), snap] };
}

export function deleteLoadout(state: GearState, name: string): GearState {
  return { ...state, loadouts: state.loadouts.filter((loadout) => loadout.name !== name) };
}

function stripNames(pocket: GearItem[], names: Set<string>): GearItem[] {
  return pocket
    .filter((item) => !names.has(item.name))
    .map((item) =>
      Array.isArray(item.contents)
        ? { ...item, contents: item.contents.filter((entry) => !names.has(entry.name)).map((entry) => ({ name: entry.name, qty: entry.qty, note: entry.note })) }
        : item,
    );
}

function plainItem(item: GearItem): GearItem {
  return { name: item.name, qty: item.qty || "", note: item.note || "" };
}

function applyDiscard(pocket: GearItem[], action: PocketAction): GearItem[] {
  if (action.chest) {
    const chest = pocket.find((item) => item.name === action.chest && isContainer(item));
    if (!chest?.contents?.some((entry) => entry.name === action.item)) return pocket;
    return pocket.map((item) =>
      item.name === chest.name ? { ...item, contents: item.contents?.filter((entry) => entry.name !== action.item) } : item,
    );
  }
  if (!pocket.some((item) => item.name === action.item)) return pocket;
  return pocket.filter((item) => item.name !== action.item);
}

function applyToChest(pocket: GearItem[], action: PocketAction): GearItem[] {
  const dest = pocket.find((item) => item.name === action.chest && isContainer(item));
  if (!dest?.contents) return pocket;
  if (dest.contents.some((entry) => entry.name === action.item)) return pocket;
  const top = pocket.find((item) => item.name === action.item);
  if (top) {
    if (isContainer(top)) return pocket;
    const moved = plainItem(top);
    return pocket
      .filter((item) => item.name !== top.name)
      .map((item) => (item.name === dest.name ? { ...item, contents: [...(item.contents || []), moved] } : item));
  }
  let moved: GearItem | null = null;
  const stripped = pocket.map((item) => {
    if (!isContainer(item) || item.name === dest.name || !item.contents?.some((entry) => entry.name === action.item)) return item;
    const found = item.contents.find((entry) => entry.name === action.item);
    if (found) moved = plainItem(found);
    return { ...item, contents: item.contents.filter((entry) => entry.name !== action.item) };
  });
  if (!moved) return pocket;
  const taken = moved;
  return stripped.map((item) => (item.name === dest.name ? { ...item, contents: [...(item.contents || []), taken] } : item));
}

function applyFromChest(pocket: GearItem[], action: PocketAction, slotLimit: number): GearItem[] {
  if (pocket.length >= slotLimit) return pocket;
  const chest = pocket.find((item) => item.name === action.chest && isContainer(item));
  const found = chest?.contents?.find((entry) => entry.name === action.item);
  if (!chest || !found) return pocket;
  if (pocket.some((item) => item.name === found.name)) return pocket;
  return [
    ...pocket.map((item) =>
      item.name === chest.name ? { ...item, contents: item.contents?.filter((entry) => entry.name !== found.name) } : item,
    ),
    plainItem(found),
  ];
}

function applyOne(pocket: GearItem[], action: PocketAction, slotLimit: number): GearItem[] {
  // A sell list entry stays in the pocket until the DM removes it in the story.
  if (action.kind === "sell" || action.kind === "unsell") return pocket;
  if (action.kind === "discard") return applyDiscard(pocket, action);
  if (action.kind === "to_chest") return applyToChest(pocket, action);
  if (action.kind === "from_chest") return applyFromChest(pocket, action, slotLimit);
  return pocket;
}

function wardrobeCloth(gear: GearSource, name: string): WornCloth | null {
  const found = readWardrobe(gear).find((item) => item.name === name);
  if (!found) return null;
  return { name: found.name, slot: found.slot };
}

function applyEquipAction(state: GearState, gear: GearSource, action: PocketAction): GearState {
  const cloth = wardrobeCloth(gear, action.item);
  if (cloth) {
    if (action.kind === "unequip") return unwearWardrobeItem(state, cloth.name) ?? state;
    if (wornClothNames(state.equipped).has(cloth.name)) return state;
    const doll = action.slot && state.equipped.some((slot) => slot.slot === action.slot) ? action.slot : dollSlotForWardrobe(cloth.slot);
    if (!state.equipped.some((slot) => slot.slot === doll)) return state;
    return {
      ...state,
      equipped: state.equipped.map((slot) => (slot.slot === doll ? withClothes(slot, insertCloth(slot.clothes, cloth)) : slot)),
    };
  }
  if (action.kind === "equip") {
    if (!action.slot) return state;
    return moveGearToSlot(state, gear, action.item, action.slot);
  }
  const onSlot = state.equipped.find((slot) => slot.slot === action.slot && slot.name === action.item);
  if (onSlot) return unequip(state, gear, onSlot.slot) ?? state;
  const elsewhere = state.equipped.find((slot) => slot.name === action.item);
  if (elsewhere) return unequip(state, gear, elsewhere.slot) ?? state;
  return unwearWardrobeItem(state, action.item) ?? state;
}

function lookPieces(action: PocketAction): LookPiece[] {
  return sanitizePieces(action.detail);
}

function applyLookAction(state: GearState, gear: GearSource, action: PocketAction): GearState {
  if (action.kind === "save_look") {
    const look = lookFromPieces(action.item, lookPieces(action));
    if (!look) return state;
    const looks = saveLook(state.looks, look);
    if (!looks) return state;
    return { ...state, looks };
  }
  if (action.kind === "delete_look") return { ...state, looks: deleteLook(state.looks, action.item) };
  if (action.kind === "rename_look") {
    const from = action.detail && !Array.isArray(action.detail) ? action.detail.from : "";
    const looks = renameLook(state.looks, from, action.item);
    if (!looks) return state;
    return { ...state, looks };
  }
  if (action.kind === "wear_look") return wearLook(state, lookPieces(action), gear);
  return state;
}

/** Replay pocket moves, equips, and look edits in order. A move whose item is already gone is left untouched. */
export function applyGearActions(state: GearState, actions: PocketAction[], gear: GearSource): GearState {
  const limit = gear.pocketSlots || 40;
  return actions.reduce((current, action) => {
    if (action.kind === "equip" || action.kind === "unequip") return applyEquipAction(current, gear, action);
    if (action.kind === "save_look" || action.kind === "delete_look" || action.kind === "wear_look" || action.kind === "rename_look") {
      return applyLookAction(current, gear, action);
    }
    const pocket = applyOne(current.pocket, action, limit);
    if (pocket === current.pocket) return current;
    return { ...current, pocket };
  }, state);
}

/** Replay moves in order. An action whose item or chest is already gone is left untouched. */
export function applyPocketActions(pocket: GearItem[], actions: PocketAction[], slotLimit: number): GearItem[] {
  return actions.reduce((current, action) => applyOne(current, action, slotLimit), pocket);
}

export function settlePocketActions(actions: PocketAction[], applied: string[] | undefined): PocketAction[] {
  const done = new Set((Array.isArray(applied) ? applied : []).filter((id) => typeof id === "string"));
  if (!done.size) return actions.slice();
  return actions.filter((action) => !done.has(action.id));
}

export function makePocketAction(
  kind: PocketAction["kind"],
  item: { name: string; qty: string },
  chest: string,
  baseRev: string,
  extra?: { slot?: string; detail?: LookDetail; now?: Date },
): PocketAction {
  const action: PocketAction = {
    id: crypto.randomUUID(),
    kind,
    item: item.name,
    qty: item.qty || "",
    chest,
    at: (extra?.now ?? new Date()).toISOString(),
    baseRev,
    synced: false,
  };
  if (extra?.slot) action.slot = extra.slot;
  if (extra?.detail !== undefined) action.detail = extra.detail;
  return action;
}

/** Equip and unequip rows for a doll change. Borrowed pieces are included so a later rev can replay them. */
export function gearChangeActions(before: GearState, after: GearState): PocketAction[] {
  const made: PocketAction[] = [];
  for (const slot of after.equipped) {
    const prev = before.equipped.find((entry) => entry.slot === slot.slot);
    const prevName = prev?.name || "";
    const nextName = slot.name || "";
    if (prevName && prevName !== nextName) {
      made.push(makePocketAction("unequip", { name: prevName, qty: prev?.qty || "" }, "", before.rev, { slot: slot.slot }));
    }
    if (nextName && nextName !== prevName) {
      made.push(makePocketAction("equip", { name: nextName, qty: slot.qty || "" }, "", before.rev, { slot: slot.slot }));
    }
    const prevClothes = prev?.clothes ?? [];
    const nextClothes = slot.clothes ?? [];
    for (const piece of prevClothes) {
      if (!nextClothes.some((cloth) => cloth.name === piece.name)) {
        made.push(makePocketAction("unequip", { name: piece.name, qty: "" }, "", before.rev, { slot: slot.slot }));
      }
    }
    for (const piece of nextClothes) {
      if (!prevClothes.some((cloth) => cloth.name === piece.name)) {
        made.push(makePocketAction("equip", { name: piece.name, qty: "" }, "", before.rev, { slot: slot.slot }));
      }
    }
  }
  return made;
}

export function pocketActionsForDm(actions: PocketAction[]): string {
  return JSON.stringify(
    actions.map((action) => {
      const row: {
        id: string;
        kind: PocketAction["kind"];
        item: string;
        qty: string;
        chest: string;
        at: string;
        baseRev: string;
        slot?: string;
        detail?: LookDetail;
      } = {
        id: action.id,
        kind: action.kind,
        item: action.item,
        qty: action.qty,
        chest: action.chest,
        at: action.at,
        baseRev: action.baseRev,
      };
      if (action.slot) row.slot = action.slot;
      if (action.detail !== undefined) row.detail = action.detail;
      return row;
    }),
    null,
    2,
  );
}

export function samePocketActions(left: PocketAction[], right: PocketAction[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((action, index) => {
    const other = right[index];
    return (
      action.id === other.id &&
      Boolean(action.synced) === Boolean(other.synced) &&
      action.kind === other.kind &&
      action.item === other.item &&
      action.chest === other.chest &&
      action.slot === other.slot
    );
  });
}

/** Pocket, equip, and look rows. sell / unsell live in their own key and must not be replayed from this log. */
const ACTION_KINDS = new Set<string>([
  "discard",
  "to_chest",
  "from_chest",
  "equip",
  "unequip",
  "save_look",
  "delete_look",
  "wear_look",
  "rename_look",
]);

export function readPocketActions(store?: Store | null): PocketAction[] {
  const resolved = store === undefined ? browserStore() : store;
  const raw = readJson<unknown>(resolved, ACTIONS_KEY, []);
  if (!Array.isArray(raw)) return [];
  const actions: PocketAction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const action = entry as Partial<PocketAction>;
    if (typeof action.id !== "string" || !action.id) continue;
    if (typeof action.kind !== "string" || !ACTION_KINDS.has(action.kind)) continue;
    if (typeof action.item !== "string" || !action.item) continue;
    const next: PocketAction = {
      id: action.id,
      kind: action.kind as PocketAction["kind"],
      item: action.item,
      qty: typeof action.qty === "string" ? action.qty : "",
      chest: typeof action.chest === "string" ? action.chest : "",
      at: typeof action.at === "string" ? action.at : "",
      baseRev: typeof action.baseRev === "string" ? action.baseRev : "",
      synced: action.synced === true,
    };
    if (typeof action.slot === "string" && action.slot) next.slot = action.slot;
    if (next.kind === "rename_look" && action.detail && !Array.isArray(action.detail) && typeof action.detail.from === "string" && action.detail.from) {
      next.detail = { from: action.detail.from };
    } else if (next.kind === "save_look" || next.kind === "delete_look" || next.kind === "wear_look") {
      next.detail = sanitizePieces(action.detail);
    }
    actions.push(next);
  }
  return actions;
}

export function writePocketActions(actions: PocketAction[], store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(ACTIONS_KEY, JSON.stringify(actions));
  } catch {
    // Keep the in-memory log if storage is blocked.
  }
}

const TAB_VALUES = new Set<string>(TABS.map((tab) => tab.value));

export function sanitizePins(raw: unknown): TabId[] {
  const out: TabId[] = [];
  if (Array.isArray(raw)) {
    for (const pin of raw) {
      if (typeof pin === "string" && TAB_VALUES.has(pin) && out.indexOf(pin as TabId) < 0 && out.length < MAX_PINS) {
        out.push(pin as TabId);
      }
    }
  }
  return out.length ? out : DEFAULT_PINS.slice();
}

export function readPins(store?: Store | null): TabId[] {
  const resolved = store === undefined ? browserStore() : store;
  return sanitizePins(readJson<unknown>(resolved, PINS_KEY, null));
}

export function writePins(pins: TabId[], store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(PINS_KEY, JSON.stringify(pins));
  } catch {
    // Ignore blocked storage.
  }
}

export function togglePin(pins: TabId[], value: TabId): TabId[] {
  const current = sanitizePins(pins);
  if (current.indexOf(value) >= 0) return current.filter((pin) => pin !== value);
  if (current.length >= MAX_PINS) return current;
  return [...current, value];
}
