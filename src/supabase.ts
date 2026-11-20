import { createClient, type RealtimeChannel, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { parseSheet } from "./sheet";
import type { PocketAction, SheetData } from "./types";

/** Publishable key. Safe to ship; row writes are blocked for this role. */
export const SUPABASE_URL = "https://lnbmhrfzilqzttjxvzak.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5ihjjt92t7aXYKMiMu8lgg_emNNSURG";

export const SHEET_ID = "nate";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SheetRow = { id: string; data: unknown };

/** Each try waits this long. There was no client timeout before this. */
export const SHEET_FETCH_TIMEOUT_MS = 10_000;
export const SHEET_FETCH_ATTEMPTS = 2;

export function describeLoadError(err: unknown): string {
  if ((err instanceof DOMException || err instanceof Error) && err.name === "AbortError") {
    return "Supabase timed out after 10 seconds.";
  }
  if (err instanceof TypeError) return `Supabase network error: ${err.message}`;
  if (err instanceof Error && err.message) return err.message;
  return "Supabase request failed.";
}

async function fetchRemoteOnce(): Promise<SheetData> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SHEET_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/sheet?id=eq.${encodeURIComponent(SHEET_ID)}&select=data`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
    const rows: unknown = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || typeof row !== "object" || !("data" in row)) throw new Error("Sheet row is missing.");
    return parseSheet((row as { data: unknown }).data);
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRemoteSheet(): Promise<SheetData> {
  let last: unknown;
  for (let attempt = 0; attempt < SHEET_FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchRemoteOnce();
    } catch (err) {
      last = err;
    }
  }
  throw new Error(describeLoadError(last));
}

export function sheetFromChange(payload: RealtimePostgresChangesPayload<SheetRow>): SheetData | null {
  if (payload.eventType === "DELETE") return null;
  const row = payload.new as Partial<SheetRow> | null;
  if (!row || !("data" in row)) return null;
  return parseSheet(row.data);
}

type RpcError = { code?: string; message?: string; status?: number };

export function pocketActionRpcMissing(error: RpcError): boolean {
  const code = `${error.code || ""}`;
  const message = error.message || "";
  if (code === "PGRST202" || code === "404") return true;
  if (error.status === 404) return true;
  if (message.includes("PGRST202") || /\b404\b/.test(message)) return true;
  return /could not find the function/i.test(message) && /log_pocket_action/i.test(message);
}

let pocketRpcMissing = false;

/**
 * The RPC is still 6 text arguments. Equip sends the doll slot as `p_chest`.
 * Look rows send the item list (or `{ from }`) as JSON text in `p_chest`.
 * sql/setup5_equip_actions.sql copies those into `slot` and `detail`.
 */
export function pocketActionRpcArgs(action: PocketAction): {
  p_action_id: string;
  p_kind: string;
  p_item: string;
  p_qty: string;
  p_chest: string;
  p_base_rev: string;
} {
  let chest = action.chest;
  if (action.kind === "equip" || action.kind === "unequip") chest = action.slot || "";
  if (action.kind === "save_look" || action.kind === "delete_look" || action.kind === "wear_look" || action.kind === "rename_look") {
    chest = JSON.stringify(action.detail ?? []);
  }
  return {
    p_action_id: action.id,
    p_kind: action.kind,
    p_item: action.item,
    p_qty: action.qty,
    p_chest: chest,
    p_base_rev: action.baseRev,
  };
}

/** Fire-and-forget log. A missing RPC stays on the phone; no DM write key is used. */
export async function pushPocketAction(action: PocketAction): Promise<"ok" | "missing" | "error"> {
  if (pocketRpcMissing) return "missing";
  try {
    const { error } = await supabase.rpc("log_pocket_action", pocketActionRpcArgs(action));
    if (!error) return "ok";
    if (pocketActionRpcMissing(error)) {
      pocketRpcMissing = true;
      return "missing";
    }
    return "error";
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (pocketActionRpcMissing({ message })) {
      pocketRpcMissing = true;
      return "missing";
    }
    return "error";
  }
}

export function openSheetChannel(
  onChange: (sheet: SheetData) => void,
  onStatus: (status: "live" | "down") => void,
): RealtimeChannel {
  const channel = supabase.channel(`sheet-${SHEET_ID}-${Date.now()}`, {
    config: { postgres_changes_options: { wait: true } },
  });
  channel.on(
    "postgres_changes",
    { event: "*", schema: "public", table: "sheet", filter: `id=eq.${SHEET_ID}` },
    (payload) => {
      try {
        const next = sheetFromChange(payload as RealtimePostgresChangesPayload<SheetRow>);
        if (next) onChange(next);
      } catch {
        // A bad payload must not blank the sheet the player is looking at.
      }
    },
  );
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") onStatus("live");
    else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") onStatus("down");
  });
  return channel;
}
