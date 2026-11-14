import type { EquipSlot, GearItem, GearLoadout, GearSource, GearState } from "./types";

export type { GearState };

export const GEAR_PREFIX = "hwfwm-nate-maray-gear-v1:";
export const PINS_KEY = "hwfwm-nate-maray-ui-v1:pins";

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

export function fillSlot(slot: string, item: GearItem): EquipSlot {
  return { slot, name: item.name, empty: "", note: item.note, qty: item.qty };
}

export function toGear(slot: EquipSlot): GearItem {
  return { name: slot.name, qty: slot.qty, note: slot.note };
}

export function removeOne(items: GearItem[], name: string): GearItem[] {
  const i = items.findIndex((it) => it.name === name);
  if (i < 0) return items;
  return items.filter((_, j) => j !== i);
}

export function sourceCatalog(gear: GearSource): GearItem[] {
  const byName: Record<string, GearItem> = {};
  for (const p of gear.pocket) byName[p.name] = { name: p.name, qty: p.qty, note: p.note };
  for (const e of gear.equipped) {
    if (e.name && !byName[e.name] && !isBorrowed(e.name, gear.borrowed)) {
      byName[e.name] = { name: e.name, qty: e.qty || "", note: e.note };
    }
  }
  return Object.keys(byName).map((key) => byName[key]);
}

function withSourceItem(catalog: GearItem[], item: GearItem): GearItem {
  const src = catalog.filter((p) => p.name === item.name)[0];
  return src ? { name: src.name, qty: src.qty, note: src.note } : item;
}

export function initialEquipped(gear: GearSource): EquipSlot[] {
  return gear.equipped.map((slot) => ({
    slot: slot.slot,
    name: slot.name,
    empty: slot.name ? "" : slot.empty || emptySlot(slot.slot, gear.emptyLabels).empty,
    note: slot.note || "",
    qty: slot.qty || "",
  }));
}

export function initialPocket(gear: GearSource): GearItem[] {
  const worn = new Set(gear.equipped.filter((slot) => slot.name).map((slot) => slot.name));
  return gear.pocket
    .filter((item) => !worn.has(item.name))
    .map((item) => ({ name: item.name, qty: item.qty, note: item.note }));
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
    if (saved && saved.name && sourceNames[saved.name]) return fillSlot(slot, withSourceItem(catalog, saved));
    return emptySlot(slot, gear.emptyLabels);
  });
  const displaced: GearItem[] = [];
  const equipped = slots.map((slot, index) => {
    const current = kept[index];
    const src = gear.equipped.filter((entry) => entry.slot === slot)[0];
    if (src && src.name && isBorrowed(src.name, gear.borrowed)) {
      if (current.name && current.name !== src.name && !isBorrowed(current.name, gear.borrowed)) displaced.push(toGear(current));
      return { slot, name: src.name, empty: "", note: src.note, qty: src.qty || "" };
    }
    if (current.name && isBorrowed(current.name, gear.borrowed)) return emptySlot(slot, gear.emptyLabels);
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
  for (const item of catalog) {
    if (!present[item.name]) pocket = pocket.concat([withSourceItem(catalog, item)]);
  }
  const loadouts = savedLoadouts.map((loadout) => ({
    name: loadout.name,
    equipped: (loadout.equipped.length ? loadout.equipped : initial).map((slot) => {
      if (slot.name && !sourceNames[slot.name]) return emptySlot(slot.slot, gear.emptyLabels);
      if (slot.name) return fillSlot(slot.slot, withSourceItem(catalog, slot));
      return { ...slot, qty: slot.qty || "", empty: slot.empty || emptySlot(slot.slot, gear.emptyLabels).empty, note: slot.note || "" };
    }),
  }));
  return { equipped, pocket, loadouts };
}

export type StoredGear = {
  rev: string | null;
  equipped: EquipSlot[] | null;
  pocket: GearItem[] | null;
  loadouts: GearLoadout[] | null;
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
  };
}

export function writeGearStore(state: GearState, store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(GEAR_PREFIX + "equipped", JSON.stringify(state.equipped));
    resolved.setItem(GEAR_PREFIX + "pocket", JSON.stringify(state.pocket));
    resolved.setItem(GEAR_PREFIX + "loadouts", JSON.stringify(state.loadouts));
    resolved.setItem(GEAR_PREFIX + "rev", JSON.stringify(state.rev));
  } catch {
    // Keep the in-memory sheet if storage is blocked.
  }
}

function asSlots(value: EquipSlot[] | null | undefined, fallback: EquipSlot[]): EquipSlot[] {
  return Array.isArray(value) ? value : fallback;
}

function asItems(value: GearItem[] | null | undefined, fallback: GearItem[]): GearItem[] {
  return Array.isArray(value) ? value : fallback;
}

function asLoadouts(value: GearLoadout[] | null | undefined, fallback: GearLoadout[]): GearLoadout[] {
  return Array.isArray(value) ? value : fallback;
}

/** Keep a live equip arrangement. Reconcile only when `rev` changes. */
export function resolveGear(rev: string, gear: GearSource, stored: StoredGear, live: GearState | null): { state: GearState; dirty: boolean } {
  if (live && live.rev === rev) return { state: live, dirty: false };
  const initialE = initialEquipped(gear);
  const initialP = initialPocket(gear);
  const initialL = defaultLoadouts(gear);
  if (!live && stored.rev === rev && Array.isArray(stored.equipped) && Array.isArray(stored.pocket) && Array.isArray(stored.loadouts)) {
    return {
      state: { rev, equipped: stored.equipped, pocket: stored.pocket, loadouts: stored.loadouts },
      dirty: false,
    };
  }
  const baseE = live ? live.equipped : asSlots(stored.equipped, initialE);
  const baseP = live ? live.pocket : asItems(stored.pocket, initialP);
  const baseL = live ? live.loadouts : asLoadouts(stored.loadouts, initialL);
  const next = reconcileGear(baseE, baseP, baseL, gear);
  return { state: { rev, ...next }, dirty: true };
}

export function itemsForSlot(pocket: GearItem[], gear: GearSource, slotName: string): GearItem[] {
  return pocket.filter((item) => (gear.equipTargets[item.name] || []).indexOf(slotName) >= 0);
}

export function equipToSlot(state: GearState, gear: GearSource, item: GearItem, slotName: string): GearState | null {
  const allowed = gear.equipTargets[item.name] || [];
  if (allowed.indexOf(slotName) < 0) return null;
  const previous = state.equipped.find((slot) => slot.slot === slotName);
  let pocket = removeOne(state.pocket, item.name);
  if (previous && previous.name && !isBorrowed(previous.name, gear.borrowed)) pocket = [...pocket, toGear(previous)];
  return {
    ...state,
    pocket,
    equipped: state.equipped.map((slot) => (slot.slot === slotName ? fillSlot(slot.slot, item) : slot)),
  };
}

export function unequip(state: GearState, gear: GearSource, slotName: string): GearState | null {
  const current = state.equipped.find((slot) => slot.slot === slotName);
  if (!current || !current.name) return null;
  const pocket = isBorrowed(current.name, gear.borrowed) ? state.pocket : [...state.pocket, toGear(current)];
  return {
    ...state,
    pocket,
    equipped: state.equipped.map((slot) => (slot.slot === slotName ? emptySlot(slotName, gear.emptyLabels) : slot)),
  };
}

export function equipItem(state: GearState, gear: GearSource, item: GearItem): GearState | null {
  const targets = gear.equipTargets[item.name];
  if (!targets || !targets.length) return null;
  const dest = targets.find((slot) => !state.equipped.find((entry) => entry.slot === slot && entry.name)) || targets[0];
  return equipToSlot(state, gear, item, dest);
}

export function loadLoadout(state: GearState, gear: GearSource, loadout: GearLoadout): GearState {
  const keep = new Set(loadout.equipped.filter((slot) => slot.name).map((slot) => slot.name));
  const held = state.equipped.filter((slot) => slot.name && !isBorrowed(slot.name, gear.borrowed)).map(toGear);
  const initial = initialEquipped(gear);
  return {
    ...state,
    pocket: [...held, ...state.pocket].filter((item) => !keep.has(item.name)),
    equipped: initial.map((slot) => {
      const found = loadout.equipped.find((entry) => entry.slot === slot.slot);
      return found && found.name ? { ...found, qty: found.qty || "" } : emptySlot(slot.slot, gear.emptyLabels);
    }),
  };
}

export function saveLoadout(state: GearState, name: string): GearState | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const snap: GearLoadout = { name: trimmed, equipped: state.equipped.map((slot) => ({ ...slot })) };
  return { ...state, loadouts: [...state.loadouts.filter((loadout) => loadout.name !== trimmed), snap] };
}

export function deleteLoadout(state: GearState, name: string): GearState {
  return { ...state, loadouts: state.loadouts.filter((loadout) => loadout.name !== name) };
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
