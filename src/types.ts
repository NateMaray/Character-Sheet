export type GearItem = {
  name: string;
  qty: string;
  note: string;
  /** Present (even as []) when this item is a container. Contents use no pocket slots. */
  contents?: GearItem[];
};

export type PocketActionKind =
  | "discard"
  | "to_chest"
  | "from_chest"
  | "sell"
  | "unsell"
  | "equip"
  | "unequip"
  | "save_look"
  | "delete_look"
  | "wear_look"
  | "rename_look";

/**
 * One piece of a saved look.
 * `slot` is the doll slot (`Head`, `Body`, `Main hand`, …).
 * `wardrobe` clothes stay in the wardrobe. `gear` comes from the pocket or the doll.
 */
export type LookPiece = {
  name: string;
  slot: string;
  source: "wardrobe" | "gear";
};

/** Item list for save / delete / wear, or `{ from }` for a rename. */
export type LookDetail = LookPiece[] | { from: string };

/**
 * One logged pocket event.
 * `discard`, `to_chest`, and `from_chest` stay until the DM lists the id.
 * `sell` and `unsell` only record the sell list. They do not change the pocket.
 * `equip`, `unequip`, and the look kinds stay until the DM lists the id.
 */
export type PocketAction = {
  id: string;
  kind: PocketActionKind;
  item: string;
  qty: string;
  chest: string;
  at: string;
  baseRev: string;
  /** Doll slot for equip / unequip (`Head`, `Body`, `Main hand`, …). */
  slot?: string;
  /** Look item list, or `{ from }` when the kind is rename_look. */
  detail?: LookDetail;
  /** True once log_pocket_action accepted it. Moves stay until appliedActions lists the id. */
  synced?: boolean;
};

export type EquipSlot = {
  slot: string;
  name: string;
  empty: string;
  note: string;
  qty: string;
  /** Wardrobe pieces worn on this doll slot. They are not pocket rows. */
  clothes?: WornCloth[];
};

/** Clothes slots. Outfit is a full set and comes first. The rest run head to toe. */
export type WardrobeSlot = "Outfit" | "Head" | "Face" | "Neck" | "Torso" | "Wrist" | "Waist" | "Legs" | "Shoes";

/** A clothes piece stored in the wardrobe. It does not use a pocket slot. */
export type WardrobeItem = {
  name: string;
  slot: WardrobeSlot;
  qty?: string;
  note?: string;
};

/** One worn wardrobe piece on a doll slot. `slot` is the wardrobe category, not the doll. */
export type WornCloth = {
  name: string;
  slot: WardrobeSlot;
};

/**
 * A saved look. `items` is the flat name list (older rows may only have this).
 * `pieces` is the doll snapshot used to wear it again, including weapons.
 */
export type WardrobeOutfit = {
  name: string;
  items: string[];
  pieces?: LookPiece[];
};

export type GearLoadout = { name: string; equipped: EquipSlot[] };

export type GearSource = {
  pocketSlots: number;
  borrowed: string[];
  emptyLabels: Record<string, string>;
  equipTargets: Record<string, string[]>;
  doll: string[][];
  pocket: GearItem[];
  equipped: EquipSlot[];
  defaultLoadouts?: GearLoadout[];
  /** Action ids already folded into this row. */
  appliedActions?: string[];
  /** Clothes that do not use pocket slots. Omit or leave empty when there are none. */
  wardrobe?: WardrobeItem[];
  /** Named outfits whose items are wardrobe piece names. */
  outfits?: WardrobeOutfit[];
};

export type GearState = {
  rev: string;
  equipped: EquipSlot[];
  pocket: GearItem[];
  loadouts: GearLoadout[];
  /** Saved looks, at most 10. Same rows as `gear.outfits` once the DM has applied them. */
  looks: WardrobeOutfit[];
};

export type VitalTone = "health" | "mana" | "stamina";

export type Vital = { label: string; pct: number; note: string; tone: VitalTone };

export type Identity = {
  kicker: string;
  name: string;
  rank: string;
  essenceLine: string;
  asOf: string;
  slots: { title: string; mark: string; filled: boolean }[];
};

export type Ability = {
  name: string;
  tag: string;
  rank: string;
  progress: number;
  detail: string;
};

export type NamedDetail = { name: string; detail: string };

export type Mission = {
  name: string;
  status: string;
  filler: boolean;
  detail: string;
  kind?: string;
};

export type LogEntry = { title: string; detail: string };

export type ProfileRow = { label: string; value: string };

/** In-world clock. Omit the whole object and the sheet renders as before. */
export type WorldTime = {
  day: number;
  dayLabel: string;
  time: string;
  detail?: string;
};

export type EssenceNote = { name: string; tag?: string; detail: string };

export type Anchor = "start" | "middle" | "end";

export type WorldPlace = {
  name: string;
  x: number;
  y: number;
  anchor: Anchor;
  dx: number;
  dy: number;
  current?: boolean;
};

export type Point = { x: number; y: number };

export type MapLabel = {
  text: string;
  x: number;
  y: number;
  anchor?: Anchor;
  size?: number;
  italic?: boolean;
  tone?: "water" | "muted" | "ink";
};

export type WorldMap = {
  viewBox: [number, number];
  land: string;
  region: string;
  river: string;
  mountains: string;
  places: WorldPlace[];
  route: Point[];
  labels: MapLabel[];
  hereLabel: string;
  caption: string;
  fog: { placeRadius: number; riverWidth: number; routeWidth: number; overlay: number };
};

export type TownLabel = {
  name: string;
  x: number;
  y: number;
  anchor: Anchor;
  dx: number;
  dy: number;
  current?: boolean;
};

export type TownMap = {
  viewBox: [number, number];
  island: string;
  oldCity: string;
  river: string;
  districts: { name: string; d: string; tone: "guild" | "work" | "market" }[];
  bridges: { y: number; used: boolean }[];
  bridge: { x1: number; x2: number; cx: number; lift: number };
  blocks: { x: number; y: number; w: number; h: number }[];
  buildings: { name: string; x: number; y: number; w: number; h: number }[];
  labels: TownLabel[];
  route: Point[];
  reveal: { x: number; y: number; r: number }[];
  labelsStatic: MapLabel[];
  hereLabel: string;
  caption: string;
  fogOverlay: number;
};

export type BattleExtra =
  | { type: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill: string; opacity?: number }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number; fill: string; opacity?: number }
  | { type: "path"; d: string; fill?: string; stroke?: string; sw?: number; opacity?: number };

export type EnemyTone = "hostile" | "warning" | "neutral" | "unknown" | "dead";

export type Enemy = {
  id: string;
  name: string;
  size: string;
  rank: string;
  type: string;
  status: string;
  x: number;
  y: number;
  tone: EnemyTone;
  marker?: string;
  facing?: "player" | number;
  mapLabel?: string;
  labelX?: number;
  labelY?: number;
  r?: number;
};

export type RevealShape =
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "stroke"; d: string; width: number };

export type Ally = {
  id?: string;
  name: string;
  x?: number;
  y?: number;
  label?: string;
  status?: string;
};

export type BattleMap = {
  title: string;
  note: string;
  width: number;
  height: number;
  tunnel?: { d: string; wall: number; floor: number };
  chamber?: { x: number; y: number; rx: number; ry: number };
  nest?: { x: number; y: number; label: string };
  daylight?: { x: number; y: number };
  reeds?: Point[];
  extras?: BattleExtra[];
  labels?: MapLabel[];
  lamp?: { x: number; y: number; r: number };
  reveal: RevealShape[];
  fogOverlay: number;
  player: { x: number; y: number; label: string };
  lantern?: { x: number; y: number; label: string };
  compass?: string;
  enemies: Enemy[];
  allies?: Ally[];
};

export type ChartedPlace = {
  region: string;
  place: string;
  seen: string;
  current?: boolean;
};

export type SheetData = {
  rev: string;
  about?: string;
  identity: Identity;
  vitals: Vital[];
  coins: string;
  location: string;
  next: string;
  worldTime?: WorldTime;
  abilities: Ability[];
  abilityMeta: { slotsLabel: string; racialLabel: string };
  racial: NamedDetail[];
  missions: Mission[];
  status: { missionNames: string[]; log: LogEntry[] };
  essences: { name: string; state: string }[];
  essenceNotes: EssenceNote[];
  achievements: NamedDetail[];
  profile: ProfileRow[];
  gear: GearSource;
  map: {
    world: WorldMap;
    town: TownMap;
    battle: BattleMap;
    battleArchive?: BattleMap[];
    charted: ChartedPlace[];
  };
};
