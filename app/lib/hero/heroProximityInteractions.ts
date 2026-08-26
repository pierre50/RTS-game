import { SHEET_TYPES } from '../../constants'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { findBuildingInteriorEntryTarget } from '../buildings/interiors'
import { getCellsInCellRadius } from '../grid/cells'
import { isHeroInteractionTargetReachable } from './heroActionRange'

export type HeroProximityInteractionAction = 'enter' | 'mount' | 'open'

export type HeroProximityInteraction =
  | {
      action: 'enter'
      labelKey: 'heroInteractionEnter'
      target: BuildingEntity
    }
  | {
      action: 'mount'
      labelKey: 'heroInteractionMount'
      target: RuntimeEntity
    }
  | {
      action: 'open'
      labelKey: 'heroInteractionOpen'
      target: RuntimeEntity
    }

export type HeroProximityInteractionOptions = {
  buildings?: BuildingEntity[] | null
  companionHorse?: RuntimeEntity | null
  hero: UnitEntity | null
  openEntityTarget?: RuntimeEntity | null
}

const OPENABLE_CORPSE_CELL_RADIUS = 2

function isOpenableEntity(target: RuntimeEntity | null | undefined): target is RuntimeEntity {
  if (!target || target.isDestroyed) return false
  const openable = target as RuntimeEntity & { openable?: boolean; interactionAction?: HeroProximityInteractionAction }
  if (openable.openable || openable.interactionAction === 'open') return true
  return Boolean(target.isDead || (target as UnitEntity).currentSheet === SHEET_TYPES.corpse)
}

function getEntityDistance(hero: UnitEntity, target: RuntimeEntity): number {
  return Math.hypot((target.x ?? 0) - hero.x, (target.y ?? 0) - hero.y)
}

function findNearestOpenableEntity(hero: UnitEntity, openEntityTarget?: RuntimeEntity | null): RuntimeEntity | null {
  const candidates: RuntimeEntity[] = []
  const seen = new Set<RuntimeEntity>()

  const addCandidate = (target: RuntimeEntity | null | undefined) => {
    if (!target || seen.has(target) || !isOpenableEntity(target)) return
    if (!isHeroInteractionTargetReachable(hero, null, target)) return
    seen.add(target)
    candidates.push(target)
  }

  addCandidate(openEntityTarget)

  const grid = hero.context?.map?.grid
  if (grid) {
    for (const cell of getCellsInCellRadius(hero.i ?? 0, hero.j ?? 0, grid, OPENABLE_CORPSE_CELL_RADIUS)) {
      for (const corpse of cell.corpses ?? []) addCandidate(corpse)
    }
  }

  return candidates.sort((a, b) => getEntityDistance(hero, a) - getEntityDistance(hero, b))[0] ?? null
}

export function resolveHeroProximityInteraction({
  buildings,
  companionHorse,
  hero,
  openEntityTarget,
}: HeroProximityInteractionOptions): HeroProximityInteraction | null {
  if (!hero || hero.isDead || hero.isDestroyed) return null

  const building = findBuildingInteriorEntryTarget(hero, buildings)
  if (building) return { action: 'enter', labelKey: 'heroInteractionEnter', target: building }

  if (
    companionHorse &&
    !hero.mountedOnHorse &&
    !companionHorse.isDead &&
    !companionHorse.isDestroyed &&
    isHeroInteractionTargetReachable(hero, null, companionHorse)
  ) {
    return { action: 'mount', labelKey: 'heroInteractionMount', target: companionHorse }
  }

  const openEntity = findNearestOpenableEntity(hero, openEntityTarget)
  if (openEntity) return { action: 'open', labelKey: 'heroInteractionOpen', target: openEntity }

  return null
}
