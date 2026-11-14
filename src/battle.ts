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
