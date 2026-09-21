import { getCellsInCellRadius } from '../grid/cells'
import { isTamedHorse } from '../horses/horseTaming'
import { getEntitySpaceMapLike } from '../mapSpaces'
import { isHeroInteractionTargetReachable } from './heroActionRange'
import type { AnimalEntity, RuntimeEntity, UnitEntity } from '../../types/entities'

const MOUNTABLE_HORSE_CELL_RADIUS = 2

function getEntityDistance(hero: UnitEntity, target: RuntimeEntity): number {
  return Math.hypot((target.x ?? 0) - hero.x, (target.y ?? 0) - hero.y)
}

function isMountableTamedHorse(
  hero: UnitEntity,
  target: RuntimeEntity | null | undefined,
  allowLegacyCompanionHorse = false
): target is AnimalEntity {
  if (hero.mountedOnHorse) return false
  if (!target || target.isDead || target.isDestroyed) return false
  if (target.family !== 'animal' || target.type !== 'Horse') return false
  if (!allowLegacyCompanionHorse && !isTamedHorse(target as AnimalEntity)) return false
  return isHeroInteractionTargetReachable(hero, null, target)
}

export function findNearestMountableHorse(
  hero: UnitEntity,
  companionHorse?: RuntimeEntity | null,
  openEntityTarget?: RuntimeEntity | null
): RuntimeEntity | null {
  const candidates: RuntimeEntity[] = []
  const seen = new Set<RuntimeEntity>()

  const addCandidate = (target: RuntimeEntity | null | undefined, allowLegacyCompanionHorse = false) => {
    if (!target || seen.has(target) || !isMountableTamedHorse(hero, target, allowLegacyCompanionHorse)) return
    seen.add(target)
    candidates.push(target)
  }

  addCandidate(openEntityTarget)
  addCandidate(companionHorse, true)

  const grid = getEntitySpaceMapLike(hero, hero.context?.map)?.grid
  if (grid) {
    for (const cell of getCellsInCellRadius(hero.i ?? 0, hero.j ?? 0, grid, MOUNTABLE_HORSE_CELL_RADIUS)) {
      addCandidate(cell.has as RuntimeEntity | null | undefined)
    }
  }

  return candidates.sort((a, b) => getEntityDistance(hero, a) - getEntityDistance(hero, b))[0] ?? null
}

