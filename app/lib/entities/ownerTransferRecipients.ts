import type { RuntimeEntity, UnitEntity, BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

function isLivingUnit(unit: UnitEntity | null | undefined): boolean {
  return Boolean(unit && !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 0) > 0)
}

export function isLivingBuilding(building: BuildingEntity | null | undefined): boolean {
  return Boolean(building && !building.isDead && !building.isDestroyed && (building.hitPoints ?? 0) > 0)
}

function entityDistanceSq(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return (a.i - b.i) ** 2 + (a.j - b.j) ** 2
}

function playerAnchorEntities(player: PlayerLike): Array<Pick<RuntimeEntity, 'i' | 'j'>> {
  const anchors = [...(player.units ?? []).filter(isLivingUnit), ...(player.buildings ?? []).filter(isLivingBuilding)]
  return anchors.length ? anchors : [{ i: player.i ?? 0, j: player.j ?? 0 }]
}

export function nearestPlayerForBuilding(building: BuildingEntity, players: PlayerLike[]): PlayerLike | null {
  let nearest: PlayerLike | null = null
  let nearestDistance = Infinity
  for (const player of players) {
    for (const anchor of playerAnchorEntities(player)) {
      const distance = entityDistanceSq(building, anchor)
      if (distance >= nearestDistance) continue
      nearest = player
      nearestDistance = distance
    }
  }
  return nearest
}

