import type { SheetData, Vital } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function need(ok: boolean, message: string): string | null {
  return ok ? null : message;
}

/** Returns an error string when the campaign object is missing a piece the sheet renders. */
export function validateSheet(value: unknown): string | null {
  if (!isRecord(value)) return "Sheet data is not an object.";
  const problems = [
    need(typeof value.rev === "string" && value.rev.length > 0, "rev must be a non-empty string."),
    need(isRecord(value.identity) && typeof value.identity.name === "string", "identity.name is missing."),
    need(Array.isArray(value.vitals) && value.vitals.length > 0, "vitals must be a non-empty array."),
    need(typeof value.coins === "string", "coins must be a string."),
    need(typeof value.location === "string", "location must be a string."),
    need(typeof value.next === "string", "next must be a string."),
    need(Array.isArray(value.abilities), "abilities must be an array."),
    need(Array.isArray(value.racial), "racial must be an array."),
    need(Array.isArray(value.missions), "missions must be an array."),
    need(isRecord(value.status) && Array.isArray(value.status.missionNames) && Array.isArray(value.status.log), "status.missionNames and status.log are required."),
    need(Array.isArray(value.essences), "essences must be an array."),
    need(Array.isArray(value.essenceNotes), "essenceNotes must be an array."),
    need(Array.isArray(value.achievements), "achievements must be an array."),
    need(Array.isArray(value.profile), "profile must be an array."),
    need(isRecord(value.gear) && Array.isArray(value.gear.equipped) && Array.isArray(value.gear.pocket), "gear.equipped and gear.pocket are required."),
    need(isRecord(value.gear) && Array.isArray(value.gear.borrowed) && isRecord(value.gear.equipTargets), "gear.borrowed and gear.equipTargets are required."),
    need(isRecord(value.map) && isRecord(value.map.world) && isRecord(value.map.town) && isRecord(value.map.battle), "map.world, map.town, and map.battle are required."),
    need(isRecord(value.map) && isRecord(value.map.battle) && Array.isArray(value.map.battle.enemies), "map.battle.enemies must be an array."),
    need(isRecord(value.map) && Array.isArray(value.map.charted), "map.charted must be an array."),
  ];
  return problems.find((problem) => problem) || null;
}

export function parseSheet(value: unknown): SheetData {
  const problem = validateSheet(value);
  if (problem) throw new Error(problem);
  return value as SheetData;
}

/** Labels whose percent changed. The first payload does not flash. */
export function changedVitalLabels(previous: Pick<Vital, "label" | "pct">[] | null, next: Pick<Vital, "label" | "pct">[]): string[] {
  if (!previous) return [];
  const before = new Map(previous.map((vital) => [vital.label, vital.pct]));
  return next.filter((vital) => before.has(vital.label) && before.get(vital.label) !== vital.pct).map((vital) => vital.label);
}

/** Backup copy used only when Supabase cannot be reached. */
export async function fetchSheet(signal?: AbortSignal): Promise<SheetData> {
  const url = `${import.meta.env.BASE_URL}data/nate.json?t=${Date.now()}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal,
    headers: { "Cache-Control": "no-cache" },
  });
  if (!response.ok) throw new Error(`Could not load sheet data (${response.status}).`);
  return parseSheet(await response.json());
}
