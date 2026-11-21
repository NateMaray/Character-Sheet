import { ABILITY_RANKS, type SheetData, type Vital } from "./types";
import { isWardrobeSlot, outfitsShapeOk, wardrobeShapeOk } from "./wardrobe";

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
    need(worldTimeOk(value.worldTime), "worldTime, when present, must be { day: number, dayLabel: string, time: string, detail?: string }."),
    need(
      abilitiesOk(value.abilities),
      "abilities must be an array of objects. essence, when present, must be a string. ranks, when present, must be an object whose keys are Iron, Bronze, Silver, Gold, or Diamond and whose values are strings.",
    ),
    need(Array.isArray(value.racial), "racial must be an array."),
    need(Array.isArray(value.missions), "missions must be an array."),
    need(isRecord(value.status) && Array.isArray(value.status.missionNames) && Array.isArray(value.status.log), "status.missionNames and status.log are required."),
    need(Array.isArray(value.essences), "essences must be an array."),
    need(Array.isArray(value.essenceNotes), "essenceNotes must be an array."),
    need(Array.isArray(value.achievements), "achievements must be an array."),
    need(Array.isArray(value.profile), "profile must be an array."),
    need(isRecord(value.gear) && Array.isArray(value.gear.equipped) && Array.isArray(value.gear.pocket), "gear.equipped and gear.pocket are required."),
    need(isRecord(value.gear) && Array.isArray(value.gear.borrowed) && isRecord(value.gear.equipTargets), "gear.borrowed and gear.equipTargets are required."),
    need(pocketContentsOk(value.gear), "gear.pocket contents, when present, must be an array of {name}."),
    need(appliedActionsOk(value.gear), "gear.appliedActions, when present, must be an array of strings."),
    need(equippedClothesOk(value.gear), "gear.equipped[].clothes, when present, must be an array of { name, slot } with a wardrobe slot."),
    need(!isRecord(value.gear) || wardrobeShapeOk(value.gear.wardrobe), "gear.wardrobe, when present, must be an array of { name, slot, qty?, note? }. slot is Outfit, Head, Face, Neck, Torso, Wrist, Waist, Legs, or Shoes. qty, when present, is a string or a number."),
    need(!isRecord(value.gear) || outfitsShapeOk(value.gear.outfits), "gear.outfits, when present, must be an array of { name, items: string[] }."),
    need(isRecord(value.map) && isRecord(value.map.world) && isRecord(value.map.town) && isRecord(value.map.battle), "map.world, map.town, and map.battle are required."),
    need(isRecord(value.map) && isRecord(value.map.battle) && Array.isArray(value.map.battle.enemies), "map.battle.enemies must be an array."),
    need(isRecord(value.map) && alliesAreValid(value.map.battle), "map.battle.allies must be an array of {name} when present."),
    need(isRecord(value.map) && archiveIsValid(value.map.battleArchive), "map.battleArchive must be an array of battle maps when present."),
    need(isRecord(value.map) && Array.isArray(value.map.charted), "map.charted must be an array."),
  ];
  return problems.find((problem) => problem) || null;
}

const ABILITY_RANK_KEYS = new Set<string>(ABILITY_RANKS);

/** Each ability stays an object. `essence` and `ranks` are optional and checked only when present. */
function abilitiesOk(abilities: unknown): boolean {
  if (!Array.isArray(abilities)) return false;
  return abilities.every((ability) => {
    if (!isRecord(ability)) return false;
    if (ability.essence !== undefined && typeof ability.essence !== "string") return false;
    if (ability.ranks === undefined) return true;
    if (!isRecord(ability.ranks)) return false;
    return Object.entries(ability.ranks).every(([key, value]) => ABILITY_RANK_KEYS.has(key) && typeof value === "string");
  });
}

/** Missing `worldTime` is valid. A present value has to be the clock object. */
function worldTimeOk(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.day !== "number" || !Number.isFinite(value.day)) return false;
  if (typeof value.dayLabel !== "string") return false;
  if (typeof value.time !== "string") return false;
  if (value.detail !== undefined && typeof value.detail !== "string") return false;
  return true;
}

function pocketContentsOk(gear: unknown): boolean {
  if (!isRecord(gear) || !Array.isArray(gear.pocket)) return true;
  return gear.pocket.every((item) => {
    if (!isRecord(item) || item.contents === undefined) return true;
    if (!Array.isArray(item.contents)) return false;
    return item.contents.every((entry) => isRecord(entry) && typeof entry.name === "string");
  });
}

function equippedClothesOk(gear: unknown): boolean {
  if (!isRecord(gear) || !Array.isArray(gear.equipped)) return true;
  return gear.equipped.every((slot) => {
    if (!isRecord(slot) || slot.clothes === undefined) return true;
    if (!Array.isArray(slot.clothes)) return false;
    return slot.clothes.every((piece) => {
      if (!isRecord(piece) || typeof piece.name !== "string" || piece.name.length === 0) return false;
      return isWardrobeSlot(piece.slot);
    });
  });
}

function appliedActionsOk(gear: unknown): boolean {
  if (!isRecord(gear) || gear.appliedActions === undefined) return true;
  return Array.isArray(gear.appliedActions) && gear.appliedActions.every((id) => typeof id === "string");
}

function alliesAreValid(battle: unknown): boolean {
  if (!isRecord(battle) || battle.allies === undefined) return true;
  if (!Array.isArray(battle.allies)) return false;
  return battle.allies.every((ally) => {
    if (!isRecord(ally) || typeof ally.name !== "string") return false;
    if (ally.id !== undefined && typeof ally.id !== "string") return false;
    if (ally.x !== undefined && typeof ally.x !== "number") return false;
    if (ally.y !== undefined && typeof ally.y !== "number") return false;
    return true;
  });
}

function archiveIsValid(archive: unknown): boolean {
  if (archive === undefined) return true;
  if (!Array.isArray(archive)) return false;
  return archive.every(
    (item) =>
      isRecord(item) &&
      typeof item.title === "string" &&
      typeof item.width === "number" &&
      typeof item.height === "number" &&
      Array.isArray(item.enemies) &&
      Array.isArray(item.reveal) &&
      isRecord(item.player) &&
      alliesAreValid(item),
  );
}

export function parseSheet(value: unknown): SheetData {
  const problem = validateSheet(value);
  if (problem) throw new Error(problem);
  return value as SheetData;
}

/** Story revs look like 2026-11-17-t508. The number is not zero-padded, so string order is wrong. */
export function revRank(rev: string): { date: string; n: number } | null {
  const match = /^(\d{4}-\d{2}-\d{2})-t(\d+)$/.exec(rev);
  if (!match) return null;
  return { date: match[1], n: Number(match[2]) };
}

/** A newer live row replaces the sheet. An older backup must not. */
export function shouldApplySheet(currentRev: string | null, incomingRev: string, source: "live" | "fallback"): boolean {
  if (!currentRev) return true;
  if (incomingRev === currentRev) return true;
  const current = revRank(currentRev);
  const incoming = revRank(incomingRev);
  if (current && incoming) {
    if (incoming.date !== current.date) return incoming.date > current.date;
    return incoming.n >= current.n;
  }
  return source === "live";
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
