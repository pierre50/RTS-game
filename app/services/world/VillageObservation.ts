import { getEntitySpaceId } from '../../lib/mapSpaces'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { VillageHome } from '../../lib/units/villageActivity'

export type VillageObservation = { reason: 'hero' | 'camera' | 'combat' | 'distant'; actor?: string; distance?: number }

/** Simulation interest is separate from faction ownership and explored fog. */
export function observeVillage(
  context: GameContextLike,
  home: VillageHome,
  radius: number,
  residents: UnitEntity[] = []
): VillageObservation {
  const outsidePoint = (entity: UnitEntity) =>
    getEntitySpaceId(entity) === 'outside'
      ? entity
      : context.map.spaces?.get(getEntitySpaceId(entity))?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
  const hero =
    context.controls?.heroUnit ??
    context.players?.find(p => p.isPlayed)?.units?.find(u => u.controlMode === 'hero' || u.type === 'Hero')
  if (hero && !hero.isDead && !hero.isDestroyed) {
    const point = outsidePoint(hero)
    const distance = point ? Math.hypot(point.i - home.i, point.j - home.j) : Infinity
    if (distance <= radius) return { reason: 'hero', actor: hero.label, distance: Math.round(distance) }
  }
  if ((context.map.activeSpaceId ?? 'outside') === 'outside') {
    const cell = context.map.grid?.[home.i]?.[home.j]
    if (cell && context.controls?.instanceInCamera?.(cell)) return { reason: 'camera' }
    for (const resident of residents) {
      if (getEntitySpaceId(resident) === 'outside' && context.controls?.instanceInCamera?.(resident))
        return { reason: 'camera', actor: resident.label }
    }
  }
  for (const player of context.players ?? []) {
    for (const unit of player.units ?? []) {
      if (unit.isDead || unit.isDestroyed || getEntitySpaceId(unit) !== 'outside') continue
      if (
        unit.action !== 'attack' &&
        unit.action !== 'flee' &&
        !unit.combatMode &&
        unit.campBehavior?.phase !== 'pursue'
      )
        continue
      const distance = Math.hypot(unit.i - home.i, unit.j - home.j)
      if (distance <= radius) return { reason: 'combat', actor: unit.label, distance: Math.round(distance) }
    }
  }
  return { reason: 'distant' }
}
