export type GearItem = { name: string; qty: string; note: string };

export type EquipSlot = {
  slot: string;
  name: string;
  empty: string;
  note: string;
  qty: string;
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
};

export type GearState = {
  rev: string;
  equipped: EquipSlot[];
  pocket: GearItem[];
  loadouts: GearLoadout[];
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

export type EnemyTone = "hostile" | "warning" | "neutral" | "unknown";

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
    charted: ChartedPlace[];
  };
};
