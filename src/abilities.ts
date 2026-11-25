import { ABILITY_RANKS, type Ability, type AbilityRank } from "./types";

/** Nate's essences, in the order the Abilities tab shows them. */
export const ESSENCE_ORDER = ["Lightning", "Star", "Wind", "Comet"] as const;

/** Abilities with no essence and no usable tag land here, after the four essences. */
export const OTHER_ESSENCE = "Other";

const ESSENCE_SLOT_CAP = 5;

export type AbilityGroup<T> = {
  essence: string;
  abilities: T[];
};

export type RankState = "past" | "current" | "future" | "sealed";

export type RankRung = {
  name: AbilityRank;
  state: RankState;
  text: string;
};

/** Match Lightning, Star, Wind, and Comet regardless of case. Any other name is kept as written. */
export function canonicalEssence(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  const known = ESSENCE_ORDER.find((essence) => essence.toLowerCase() === trimmed.toLowerCase());
  return known ?? trimmed;
}

/**
 * `essence` wins when it is a non-empty string.
 * Otherwise the essence is the first segment of `tag`, before "·".
 */
export function abilityEssence(ability: { essence?: unknown; tag?: unknown }): string {
  if (typeof ability.essence === "string") {
    const explicit = canonicalEssence(ability.essence);
    if (explicit) return explicit;
  }
  if (typeof ability.tag !== "string") return "";
  return canonicalEssence(ability.tag.split(/[·•]/)[0] ?? "");
}

/** Lightning, Star, Wind, Comet, then any other essence in the order it first appears. */
export function groupAbilities<T extends { essence?: unknown; tag?: unknown }>(abilities: readonly T[]): AbilityGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const ability of abilities) {
    const essence = abilityEssence(ability) || OTHER_ESSENCE;
    const list = buckets.get(essence);
    if (list) list.push(ability);
    else buckets.set(essence, [ability]);
  }
  const groups: AbilityGroup<T>[] = [];
  for (const essence of ESSENCE_ORDER) {
    const list = buckets.get(essence);
    if (!list?.length) continue;
    groups.push({ essence, abilities: list });
    buckets.delete(essence);
  }
  for (const [essence, list] of buckets) groups.push({ essence, abilities: list });
  return groups;
}

/** "2/5" for an essence slot. Other groups show how many abilities they hold. */
export function essenceCountLabel(essence: string, count: number): string {
  if ((ESSENCE_ORDER as readonly string[]).includes(essence)) return `${count}/${ESSENCE_SLOT_CAP}`;
  return String(count);
}

/** "Iron 0" is Iron. An unrecognized rank highlights nothing. */
export function rankFromLabel(rank: string | undefined): AbilityRank | null {
  if (!rank) return null;
  const word = rank.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  return ABILITY_RANKS.find((name) => name.toLowerCase() === word) ?? null;
}

function writtenRank(ranks: Ability["ranks"], name: AbilityRank): string {
  const raw = ranks?.[name];
  if (typeof raw !== "string") return "";
  return raw.trim();
}

const COST_MARKER = " Cost:";
const COOLDOWN_MARKER = " Cooldown:";

export type ParsedAbilityDetail = {
  effect: string;
  cost: string;
  cooldown: string;
};

/**
 * Ability `detail` is one paragraph: the effect, then " Cost: ...", then " Cooldown: ...".
 * Sentences between those markers stay in cost. With neither marker, the whole string is the effect.
 */
export function parseAbilityDetail(detail: string): ParsedAbilityDetail {
  const costAt = detail.indexOf(COST_MARKER);
  const cooldownAt = detail.indexOf(COOLDOWN_MARKER);
  if (costAt < 0 && cooldownAt < 0) return { effect: detail, cost: "", cooldown: "" };

  const cuts = [
    costAt >= 0 ? { at: costAt, key: "cost" as const, marker: COST_MARKER } : null,
    cooldownAt >= 0 ? { at: cooldownAt, key: "cooldown" as const, marker: COOLDOWN_MARKER } : null,
  ]
    .filter((cut): cut is { at: number; key: "cost" | "cooldown"; marker: string } => cut !== null)
    .sort((a, b) => a.at - b.at);

  const parsed: ParsedAbilityDetail = { effect: detail.slice(0, cuts[0].at).trim(), cost: "", cooldown: "" };
  for (let i = 0; i < cuts.length; i++) {
    const start = cuts[i].at + cuts[i].marker.length;
    const end = i + 1 < cuts.length ? cuts[i + 1].at : detail.length;
    parsed[cuts[i].key] = detail.slice(start, end).trim();
  }
  return parsed;
}

/**
 * Iron uses `ranks.Iron` when that text is present, and the effect from `detail` otherwise,
 * so cost and cooldown are not repeated on the ladder.
 * A higher rank with no text is sealed. A future rank that has text stays readable,
 * distinct from the highlighted current rank.
 */
export function rankLadder(ability: Pick<Ability, "rank" | "detail" | "ranks">): RankRung[] {
  const current = rankFromLabel(ability.rank);
  const currentIndex = current ? ABILITY_RANKS.indexOf(current) : -1;
  return ABILITY_RANKS.map((name, index) => {
    const written = writtenRank(ability.ranks, name);
    const text = written || (name === "Iron" ? parseAbilityDetail(ability.detail).effect.trim() : "");
    if (currentIndex >= 0 && index < currentIndex) return { name, state: "past", text };
    if (currentIndex >= 0 && index === currentIndex) return { name, state: "current", text };
    if (text) return { name, state: currentIndex < 0 ? "past" : "future", text };
    return { name, state: "sealed", text: `Sealed: revealed on reaching ${name}` };
  });
}
