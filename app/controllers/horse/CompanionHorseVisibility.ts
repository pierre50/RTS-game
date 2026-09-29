import { BUILDING_TYPES } from '../../constants'
import { instanceIsInPlayerSight } from '../../lib/grid/visibility'
import { sameMapSpace } from '../../lib/mapSpaces'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { HeroCompanionHorseController } from '../HeroCompanionHorseController'
import { COMPANION_HORSE_CALL_MAX_RADIUS, type CompanionHorse, type ViewportMetrics } from '../HeroControllerSupport'
type Host = Pick<HeroCompanionHorseController, 'controls' | 'getViewportMetrics'>
export function getViewportMetrics(this: Host): ViewportMetrics | null {
  const getViewportMetrics = this.controls.getViewportMetrics
  if (typeof getViewportMetrics !== 'function') return null
  const viewport = getViewportMetrics.call(this.controls)
  if (
    typeof viewport?.visibleLeft !== 'number' ||
    typeof viewport.visibleTop !== 'number' ||
    typeof viewport.visibleWidth !== 'number' ||
    typeof viewport.visibleHeight !== 'number'
  ) {
    return null
  }
  return viewport
}
export function isCompanionHorseVisibleToHero(this: Host, horse: CompanionHorse, unit: UnitEntity): boolean {
  if (horse.visible === false) return false
  if (!sameMapSpace(horse, unit)) return false
  const owner = unit.owner ?? this.controls.context.player
  if (owner?.views) return instanceIsInPlayerSight(horse, owner)
  const viewport = this.getViewportMetrics()
  if (!viewport) return true
  return (
    horse.x >= viewport.visibleLeft &&
    horse.x <= viewport.visibleLeft + viewport.visibleWidth &&
    horse.y >= viewport.visibleTop &&
    horse.y <= viewport.visibleTop + viewport.visibleHeight
  )
}
export function isStableVisibleToHero(this: Host, stable: BuildingEntity, unit: UnitEntity): boolean {
  if (
    stable.type !== BUILDING_TYPES.stable ||
    stable.owner !== unit.owner ||
    !stable.isBuilt ||
    stable.isDead ||
    stable.isDestroyed
  ) {
    return false
  }
  if (!sameMapSpace(stable, unit)) return false
  const distance = Math.hypot(stable.i - unit.i, stable.j - unit.j)
  if (distance > (unit.sight ?? COMPANION_HORSE_CALL_MAX_RADIUS)) return false
  const owner = unit.owner ?? this.controls.context.player
  if (owner?.views) return instanceIsInPlayerSight(stable, owner)
  return stable.visible !== false
}
