import { GEAR_PREFIX, isContainer } from "./gear";
import type { GearItem, PocketAction } from "./types";

/** Phone-only. Not part of nate.json and not the pocket-move log. */
export const SELL_LIST_KEY = GEAR_PREFIX + "sell-list";
/** Unsynced sell / unsell rows, retried until log_pocket_action accepts them. */
export const SELL_ACTIONS_KEY = GEAR_PREFIX + "sell-actions";

export type SellEntry = {
  item: string;
  /** "" when the item is a top-level pocket row, including an empty chest. */
  chest: string;
  /** How many of this row to sell. Always at least 1 while listed. */
  qty: number;
};

export type SellChange = {
  list: SellEntry[];
  added: SellEntry[];
  removed: SellEntry[];
};

export type SellCandidate = {
  name: string;
  chest: string;
  max: number;
  /** True when the row's qty is a number greater than 1. */
  picker: boolean;
};

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

export function sellKey(chest: string, name: string): string {
  return `${chest}\n${name}`;
}

/** Positive integer qty, including "x6" and a bare number. "1 coil" and "several" are not counts. */
export function numericQty(qty: unknown): number | null {
  if (typeof qty === "number" && Number.isFinite(qty)) {
    const n = Math.trunc(qty);
    return n > 0 ? n : null;
  }
  if (typeof qty !== "string") return null;
  const match = /^(?:x\s*)?(\d+)$/i.exec(qty.trim());
  if (!match) return null;
  const n = Number(match[1]);
  return n > 0 ? n : null;
}

export function itemCount(item: { qty: unknown }): number {
  return numericQty(item.qty) ?? 1;
}

export function clampSellQty(qty: number, max: number): number {
  const cap = Number.isFinite(max) ? Math.max(1, Math.trunc(max)) : 1;
  const n = Number.isFinite(qty) ? Math.trunc(qty) : 1;
  if (n < 1) return 1;
  return Math.min(n, cap);
}

export function sellQtyText(qty: number): string {
  return `x${qty}`;
}

function row(item: GearItem, chest: string): SellCandidate {
  const numeric = numericQty(item.qty);
  return {
    name: item.name,
    chest,
    max: numeric ?? 1,
    picker: numeric !== null && numeric > 1,
  };
}

/** Top-level rows and chest contents. A chest is listed only when it is empty. */
export function sellCandidates(pocket: GearItem[]): SellCandidate[] {
  const out: SellCandidate[] = [];
  const chests = pocket.filter(isContainer);
  const loose = pocket.filter((item) => !isContainer(item));
  for (const chest of chests) {
    const contents = Array.isArray(chest.contents) ? chest.contents : [];
    if (!contents.length) {
      out.push(row(chest, ""));
      continue;
    }
    for (const inner of contents) {
      if (!inner || typeof inner.name !== "string" || !inner.name) continue;
      out.push(row(inner, chest.name));
    }
  }
  for (const item of loose) out.push(row(item, ""));
  return out;
}

export function locateSellItem(pocket: GearItem[], chest: string, item: string): GearItem | null {
  if (chest) {
    const box = pocket.find((entry) => entry.name === chest && isContainer(entry));
    return box?.contents?.find((entry) => entry.name === item) ?? null;
  }
  const top = pocket.find((entry) => entry.name === item);
  if (!top) return null;
  if (isContainer(top) && (top.contents?.length || 0) > 0) return null;
  return top;
}

export function sameSellList(left: SellEntry[], right: SellEntry[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((entry, index) => {
    const other = right[index];
    return entry.item === other.item && entry.chest === other.chest && entry.qty === other.qty;
  });
}

export function addSellEntries(list: SellEntry[], incoming: SellEntry[]): SellChange {
  const next = list.map((entry) => ({ ...entry }));
  const added: SellEntry[] = [];
  const removed: SellEntry[] = [];
  for (const raw of incoming) {
    if (!raw || typeof raw.item !== "string" || !raw.item) continue;
    const qty = Math.trunc(raw.qty);
    if (!Number.isFinite(qty) || qty < 1) continue;
    const chest = typeof raw.chest === "string" ? raw.chest : "";
    const entry: SellEntry = { item: raw.item, chest, qty };
    const index = next.findIndex((row) => row.item === entry.item && row.chest === entry.chest);
    if (index >= 0) {
      if (next[index].qty === entry.qty) continue;
      removed.push(next[index]);
      next[index] = entry;
      added.push(entry);
      continue;
    }
    next.push(entry);
    added.push(entry);
  }
  return { list: next, added, removed };
}

export function removeSellEntry(list: SellEntry[], item: string, chest: string): SellEntry[] {
  return list.filter((entry) => entry.item !== item || entry.chest !== chest);
}

export function clearSellList(list: SellEntry[]): SellChange {
  return { list: [], added: [], removed: list.map((entry) => ({ ...entry })) };
}

/** Drop rows the pocket no longer has, and lower a count when the stack shrank. */
export function pruneSellList(list: SellEntry[], pocket: GearItem[]): SellEntry[] {
  const next: SellEntry[] = [];
  for (const entry of list) {
    const found = locateSellItem(pocket, entry.chest, entry.item);
    if (!found) continue;
    const qty = Math.min(entry.qty, itemCount(found));
    if (qty < 1) continue;
    next.push(qty === entry.qty ? entry : { item: entry.item, chest: entry.chest, qty });
  }
  return next;
}

export function formatSellList(list: SellEntry[]): string {
  if (!list.length) return "Selling: nothing";
  const parts = list.map((entry) => {
    const place = entry.chest ? ` (${entry.chest})` : "";
    return `${entry.item} x${entry.qty}${place}`;
  });
  return `Selling: ${parts.join(", ")}`;
}

export function sanitizeSellList(raw: unknown): SellEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: SellEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Partial<SellEntry>;
    if (typeof record.item !== "string" || !record.item) continue;
    const chest = typeof record.chest === "string" ? record.chest : "";
    const qty = typeof record.qty === "number" ? Math.trunc(record.qty) : numericQty(record.qty);
    if (qty === null || !Number.isFinite(qty) || qty < 1) continue;
    const next: SellEntry = { item: record.item, chest, qty };
    const index = out.findIndex((row) => row.item === next.item && row.chest === next.chest);
    if (index >= 0) out[index] = next;
    else out.push(next);
  }
  return out;
}

function readJson(store: Store | null, key: string): unknown {
  try {
    if (!store) return null;
    const raw = store.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function readSellList(store?: Store | null): SellEntry[] {
  const resolved = store === undefined ? browserStore() : store;
  return sanitizeSellList(readJson(resolved, SELL_LIST_KEY));
}

export function writeSellList(list: SellEntry[], store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(SELL_LIST_KEY, JSON.stringify(sanitizeSellList(list)));
  } catch {
    // Keep the in-memory list if storage is blocked.
  }
}

export function sanitizeSellActions(raw: unknown): PocketAction[] {
  if (!Array.isArray(raw)) return [];
  const actions: PocketAction[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const action = entry as Partial<PocketAction>;
    if (action.kind !== "sell" && action.kind !== "unsell") continue;
    if (typeof action.id !== "string" || !action.id) continue;
    if (typeof action.item !== "string" || !action.item) continue;
    actions.push({
      id: action.id,
      kind: action.kind,
      item: action.item,
      qty: typeof action.qty === "string" ? action.qty : "",
      chest: typeof action.chest === "string" ? action.chest : "",
      at: typeof action.at === "string" ? action.at : "",
      baseRev: typeof action.baseRev === "string" ? action.baseRev : "",
      synced: action.synced === true,
    });
  }
  return actions;
}

export function readSellActions(store?: Store | null): PocketAction[] {
  const resolved = store === undefined ? browserStore() : store;
  return sanitizeSellActions(readJson(resolved, SELL_ACTIONS_KEY));
}

export function writeSellActions(actions: PocketAction[], store?: Store | null): void {
  const resolved = store === undefined ? browserStore() : store;
  if (!resolved) return;
  try {
    resolved.setItem(SELL_ACTIONS_KEY, JSON.stringify(sanitizeSellActions(actions)));
  } catch {
    // Keep the in-memory queue if storage is blocked.
  }
}
