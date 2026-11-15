import type { Ally, BattleMap, Enemy } from "./types";

/** The old sheet parked Gary in the enemy list. A neutral contact with this id is an ally. */
export function isStandInAlly(enemy: Enemy): boolean {
  return enemy.id === "gary" && enemy.tone === "neutral";
}

export function battleRoster(map: BattleMap): { allies: Ally[]; contacts: Enemy[] } {
  const declared = Array.isArray(map.allies) ? map.allies : [];
  const declaredIds = new Set(declared.map((ally) => ally.id));
  const lifted: Ally[] = [];
  for (const enemy of map.enemies) {
    if (!isStandInAlly(enemy) || declaredIds.has(enemy.id)) continue;
    lifted.push({
      id: enemy.id,
      name: enemy.name,
      x: enemy.x,
      y: enemy.y,
      label: enemy.mapLabel || enemy.name,
      status: enemy.status,
    });
  }
  const allyIds = new Set([...declaredIds, ...lifted.map((ally) => ally.id)]);
  return {
    allies: [...declared, ...lifted],
    contacts: map.enemies.filter((enemy) => !allyIds.has(enemy.id)),
  };
}

export type LabelBox = { x: number; y: number; w: number; h: number };
export type LabelSpot = { x: number; y: number; anchor: "start" | "middle" | "end" };

const ALLY_LABEL_SIZE = 12;

/** Rough width of an SVG label in map units. */
export function estimateLabelBox(text: string, fontSize: number, anchorX: number, baseline: number, anchor: LabelSpot["anchor"]): LabelBox {
  const w = Math.max(1, text.length) * fontSize * 0.58;
  const h = fontSize * 1.3;
  const y = baseline - fontSize;
  const x = anchor === "start" ? anchorX : anchor === "end" ? anchorX - w : anchorX - w / 2;
  return { x, y, w, h };
}

function boxesOverlap(a: LabelBox, b: LabelBox, pad = 6): boolean {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

/** Prefer a label under the diamond. Step away if that covers Nate, the lantern, or another name. */
export function placeAllyLabel(text: string, marker: { x: number; y: number }, obstacles: LabelBox[]): LabelSpot {
  const candidates: LabelSpot[] = [
    { x: marker.x, y: marker.y + 28, anchor: "middle" },
    { x: marker.x, y: marker.y + 46, anchor: "middle" },
    { x: marker.x, y: marker.y + 64, anchor: "middle" },
    { x: marker.x + 18, y: marker.y + 4, anchor: "start" },
    { x: marker.x - 18, y: marker.y + 4, anchor: "end" },
    { x: marker.x, y: marker.y - 18, anchor: "middle" },
  ];
  for (const spot of candidates) {
    const box = estimateLabelBox(text, ALLY_LABEL_SIZE, spot.x, spot.y, spot.anchor);
    if (!obstacles.some((obstacle) => boxesOverlap(box, obstacle))) return spot;
  }
  return candidates[2];
}
