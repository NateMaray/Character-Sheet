import { createClient, type RealtimeChannel, type RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { parseSheet } from "./sheet";
import type { SheetData } from "./types";

/** Publishable key. Safe to ship; row writes are blocked for this role. */
export const SUPABASE_URL = "https://lnbmhrfzilqzttjxvzak.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5ihjjt92t7aXYKMiMu8lgg_emNNSURG";

export const SHEET_ID = "nate";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type SheetRow = { id: string; data: unknown };

export async function fetchRemoteSheet(): Promise<SheetData> {
  const { data, error } = await supabase.from("sheet").select("data").eq("id", SHEET_ID).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Sheet row is missing.");
  return parseSheet((data as { data: unknown }).data);
}

export function sheetFromChange(payload: RealtimePostgresChangesPayload<SheetRow>): SheetData | null {
  if (payload.eventType === "DELETE") return null;
  const row = payload.new as Partial<SheetRow> | null;
  if (!row || !("data" in row)) return null;
  return parseSheet(row.data);
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
