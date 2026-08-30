import { ACTION_TYPES, BUILDING_TYPES, SHEET_TYPES } from '../../constants'
import type { NpcOrdersOpenOptions } from '../../types/context'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { findBuildingInteriorEntryTarget } from '../buildings/interiors'
import { isHeroOnInteriorExitCell } from '../buildings/interiorExits'
import { heroCanCommand } from '../chief'
import { getCellsInCellRadius } from '../grid/cells'
import { instanceIsInActiveOrTeamSight } from '../grid/visibility'
import { isTamedHorse } from '../horses/horseTaming'
import { getEntitySpaceMapLike, getMapSpace } from '../mapSpaces'
import { pickForeignNpcChatterLine, pickNpcChatterLine } from '../npc/npcChatter'
import { isTalkableNpc } from '../npc/npcInteraction'
import { isHeroInteractionTargetReachable } from './heroActionRange'

type HeroProximityInteractionAction = 'communicate' | 'enter' | 'exit' | 'mount' | 'open' | 'recoverTrap'

export type HeroProximityInteraction =
  | {
      action: 'communicate'
      labelKey: 'heroInteractionCommunicate'
      npcOptions?: NpcOrdersOpenOptions
      target: UnitEntity
    }
  | {
      action: 'enter'
      labelKey: 'heroInteractionEnter'
      target: BuildingEntity
    }
  | {
      action: 'exit'
      labelKey: 'heroInteractionExit'
    }
  | {
      action: 'mount'
      labelKey: 'heroInteractionMount' | 'heroInteractionSteal'
      target: RuntimeEntity
    }
  | {
      action: 'open'
      labelKey: 'heroInteractionOpen'
      target: RuntimeEntity
    }
  | {
      action: 'recoverTrap'
      labelKey: 'heroInteractionRecover'
      target: BuildingEntity
    }

export type HeroProximityInteractionOptions = {
  buildings?: BuildingEntity[] | null
  companionHorse?: RuntimeEntity | null
  hero: UnitEntity | null
  openEntityTarget?: RuntimeEntity | null
}

const OPENABLE_CORPSE_CELL_RADIUS = 2
const MOUNTABLE_HORSE_CELL_RADIUS = 2

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

  const grid = getEntitySpaceMapLike(hero, hero.context?.map)?.grid
  if (grid) {
    for (const cell of getCellsInCellRadius(hero.i ?? 0, hero.j ?? 0, grid, OPENABLE_CORPSE_CELL_RADIUS)) {
      for (const corpse of cell.corpses ?? []) addCandidate(corpse)
    }
  }

  return candidates.sort((a, b) => getEntityDistance(hero, a) - getEntityDistance(hero, b))[0] ?? null
}

function getStableInteriorHorseOwner(hero: UnitEntity, horse: RuntimeEntity) {
  const map = hero.context?.map
  const space = map && horse.spaceId ? getMapSpace(map, horse.spaceId) : null
  const interiorSpace = space as (typeof space & { building?: BuildingEntity | null }) | null
  return interiorSpace?.kind === 'interior' && interiorSpace.building?.type === BUILDING_TYPES.stable
    ? (interiorSpace.building.owner ?? null)
    : null
}

function getHorseTheftOwner(hero: UnitEntity, horse: RuntimeEntity) {
  return getStableInteriorHorseOwner(hero, horse) ?? horse.owner ?? null
}

function isHorseTheftInteraction(hero: UnitEntity, horse: RuntimeEntity): boolean {
  const heroOwner = hero.owner
  const horseOwner = getHorseTheftOwner(hero, horse)
  if (!heroOwner?.label || !horseOwner?.label) return false
  return heroOwner.label !== horseOwner.label
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

function findNearestMountableHorse(
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

function isRecoverableTrap(hero: UnitEntity, building: BuildingEntity | null | undefined): building is BuildingEntity {
  return Boolean(
    building &&
      building.type === BUILDING_TYPES.trap &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      (!building.requiresActiveSightInteraction ||
        instanceIsInActiveOrTeamSight(building, hero.context?.player, hero.context?.players)) &&
      isHeroInteractionTargetReachable(hero, null, building)
  )
}

function findNearestRecoverableTrap(
  hero: UnitEntity,
  buildings: BuildingEntity[] | null | undefined
): BuildingEntity | null {
  const candidates = (buildings ?? []).filter(building => isRecoverableTrap(hero, building))
  return candidates.sort((a, b) => getEntityDistance(hero, a) - getEntityDistance(hero, b))[0] ?? null
}

function isCommandableNpc(hero: UnitEntity, target: UnitEntity): boolean {
  if (!heroCanCommand(hero)) return false
  if (target.owner !== hero.owner) return false
  return target.action !== ACTION_TYPES.attack
}

export function resolveHeroNpcProximityInteraction(
  hero: UnitEntity | null,
  target: RuntimeEntity | null | undefined
): Extract<HeroProximityInteraction, { action: 'communicate' }> | null {
  if (!hero || !target || !isTalkableNpc(hero, target)) return null
  const unit = target as UnitEntity
  if (isCommandableNpc(hero, unit)) {
    return { action: 'communicate', labelKey: 'heroInteractionCommunicate', target: unit }
  }
  const sleeping = unit.shelterState?.reason === 'sleep'
  return {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    npcOptions: {
      // Leave it unset while asleep — NpcOrdersManager.open already picks the right "Zzz..." line
      // for an own vs. a foreign sleeper, which this precomputed line would otherwise override.
      chatterLine: sleeping
        ? undefined
        : unit.owner === hero.owner
          ? pickNpcChatterLine()
          : pickForeignNpcChatterLine(unit),
      ordersEnabled: false,
    },
    target: unit,
  }
}

// Only call this at actual interaction-execution time, never from the per-frame proximity-prompt
// resolver above — it has a side effect (waking the unit).
export function wakeOwnSleepingNpcForCommunication(hero: UnitEntity, target: UnitEntity): void {
  if (target.shelterState?.reason !== 'sleep' || target.owner !== hero.owner) return
  target.context?.unitRest?.wakeSleepingUnitForOrder(target)
}

export function resolveHeroProximityInteraction({
  buildings,
  companionHorse,
  hero,
  openEntityTarget,
}: HeroProximityInteractionOptions): HeroProximityInteraction | null {
  if (!hero || hero.isDead || hero.isDestroyed) return null

  if (isHeroOnInteriorExitCell(hero)) return { action: 'exit', labelKey: 'heroInteractionExit' }

  const trap = findNearestRecoverableTrap(hero, buildings)
  if (trap) return { action: 'recoverTrap', labelKey: 'heroInteractionRecover', target: trap }

  const building = findBuildingInteriorEntryTarget(hero, buildings)
  if (building) return { action: 'enter', labelKey: 'heroInteractionEnter', target: building }

  const mountableHorse = findNearestMountableHorse(hero, companionHorse, openEntityTarget)
  if (mountableHorse) {
    return {
      action: 'mount',
      labelKey: isHorseTheftInteraction(hero, mountableHorse) ? 'heroInteractionSteal' : 'heroInteractionMount',
      target: mountableHorse,
    }
  }

  const openEntity = findNearestOpenableEntity(hero, openEntityTarget)
  if (openEntity) return { action: 'open', labelKey: 'heroInteractionOpen', target: openEntity }

  const npcInteraction = resolveHeroNpcProximityInteraction(hero, openEntityTarget)
  if (npcInteraction) return npcInteraction

  return null
}
