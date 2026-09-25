import { getEntitySpaceId } from '../../lib/mapSpaces'
import { campAnchor } from '../../lib/units/campBehavior'
import { observeVillage } from '../world/VillageObservation'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

const ENTER_RADIUS = 80
const EXIT_RADIUS = 110

/** One spatial-interest decision per camp, independent of each guard's combat state. */
export class CampInterest {
  private previous = new Map<string, boolean>()
  constructor(private context: GameContextLike) {}

  collect(units: Iterable<UnitEntity>): Set<UnitEntity> {
    const groups = new Map<string, UnitEntity[]>()
    for (const unit of units) {
      if (unit.isDead || unit.isDestroyed || unit.owner?.isPlayed) continue
      const anchor = campAnchor(unit)
      if (!anchor) continue
      const key = `${unit.owner?.label ?? this.context.players.indexOf(unit.owner!)}:${unit.campBehavior?.homeSpaceId ?? 'outside'}:${anchor.i}:${anchor.j}`
      const group = groups.get(key) ?? []
      group.push(unit)
      groups.set(key, group)
    }
    const next = new Map<string, boolean>()
    const relevant = new Set<UnitEntity>()
    for (const [key, group] of groups) {
      const visible = this.observed(group, this.previous.get(key) !== false ? EXIT_RADIUS : ENTER_RADIUS)
      next.set(key, visible)
      if (visible) for (const unit of group) relevant.add(unit)
    }
    this.previous = next
    return relevant
  }

  private observed(group: UnitEntity[], radius: number): boolean {
    const first = group[0]
    const anchor = campAnchor(first)!
    const homeSpace = first.campBehavior?.homeSpaceId ?? 'outside'
    const hero = this.context.controls?.heroUnit
    if (
      hero &&
      !hero.isDead &&
      !hero.isDestroyed &&
      getEntitySpaceId(hero) === homeSpace &&
      Math.hypot(hero.i - anchor.i, hero.j - anchor.j) <= radius
    )
      return true
    const activeSpace = this.context.map.activeSpaceId ?? 'outside'
    if (group.some(unit => activeSpace === getEntitySpaceId(unit) && this.context.controls?.instanceInCamera?.(unit)))
      return true
    const point =
      homeSpace === 'outside'
        ? anchor
        : this.context.map.spaces?.get(homeSpace)?.portals?.find(p => p.targetSpaceId === 'outside')?.targetCell
    if (!point) return false
    return observeVillage(this.context, { ...point, id: 'camp', spaceId: 'outside' }, radius).reason !== 'distant'
  }
}
