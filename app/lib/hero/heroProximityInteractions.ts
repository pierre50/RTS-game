import { findNearestMountableHorse } from './heroMountTargets'
import { ACTION_TYPES, BUILDING_TYPES, CAMP_DECORATION_BUILDING_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../../constants'
import type { NpcOrdersOpenOptions } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { canUnitEnterBuildingInterior } from '../buildings/interiorAccess'
import { findBuildingInteriorEntryTarget } from '../buildings/interiors'
import { isHeroOnInteriorExitCell } from '../buildings/interiorExits'
import { heroCanCommand } from '../chief'
import { isNeutralPlayer } from '../playerState'
import { instanceIsInActiveOrTeamSight } from '../grid/visibility'
import { isStoredForeignStableHorse } from '../horses/stableHorseInteraction'
import { isTalkableNpc } from '../npc/npcInteraction'
import { isUsableFireCamp } from './heroCampfireSleep'
import { isHeroInteractionTargetReachable } from './heroActionRange'

type HeroProximityInteractionAction = 'communicate' | 'enter' | 'exit' | 'mount' | 'open' | 'dismantleTrap'

export type HeroProximityInteraction =
  | {
      action: 'communicate'
      labelKey: 'heroInteractionCommunicate'
      npcOptions?: NpcOrdersOpenOptions
      target: UnitEntity
    }
  | {
      action: 'enter'
      labelKey: 'heroInteractionEnter' | 'heroInteractionForceEntry'
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
      labelKey: 'heroInteractionOpen' | 'heroInteractionOpenMenu' | 'heroInteractionExamine'
      target: RuntimeEntity
    }
  | {
      action: 'dismantleTrap'
      labelKey: 'heroInteractionDismantle'
      target: BuildingEntity
    }

export type HeroProximityInteractionOptions = {
  buildings?: BuildingEntity[] | null
  companionHorse?: RuntimeEntity | null
  hero: UnitEntity | null
  openEntityTarget?: RuntimeEntity | null
}

function isOpenableEntity(target: RuntimeEntity | null | undefined): target is RuntimeEntity {
  if (
    !target ||
    target.isDestroyed ||
    target.family === FAMILY_TYPES.resource ||
    (target.family === FAMILY_TYPES.animal && !target.isDead) ||
    target.family === FAMILY_TYPES.building
  )
    return false
  if (
    target.family === FAMILY_TYPES.unit &&
    !target.isDead &&
    (target as UnitEntity).currentSheet !== SHEET_TYPES.corpse
  )
    return false
  const openable = target as RuntimeEntity & { openable?: boolean; interactionAction?: HeroProximityInteractionAction }
  if (openable.openable || openable.interactionAction === 'open') return true
  return Boolean(target.isDead || (target as UnitEntity).currentSheet === SHEET_TYPES.corpse)
}

function resolveFacingOpenableEntity(hero: UnitEntity, openEntityTarget?: RuntimeEntity | null): RuntimeEntity | null {
  if (!isOpenableEntity(openEntityTarget)) return null
  if (!isHeroInteractionTargetReachable(hero, null, openEntityTarget)) return null
  return openEntityTarget
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

function resolveFacingRecoverableTrap(
  hero: UnitEntity,
  openEntityTarget?: RuntimeEntity | null
): BuildingEntity | null {
  const building = openEntityTarget as BuildingEntity | null | undefined
  return isRecoverableTrap(hero, building) ? building : null
}

function isOpenableBuilding(hero: UnitEntity, building: BuildingEntity | null | undefined): building is BuildingEntity {
  return Boolean(
    building &&
      building.type === BUILDING_TYPES.chest &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, building)
  )
}

function resolveFacingOpenableBuilding(
  hero: UnitEntity,
  openEntityTarget?: RuntimeEntity | null
): BuildingEntity | null {
  const building = openEntityTarget as BuildingEntity | null | undefined
  return isOpenableBuilding(hero, building) ? building : null
}

function isCommandableNpc(hero: UnitEntity, target: UnitEntity): boolean {
  if (!heroCanCommand(hero)) return false
  if (target.owner !== hero.owner && !isNeutralPlayer(target.owner)) return false
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
  return {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    // The panel chooses the line using the current phase at interaction time.
    npcOptions: { ordersEnabled: false },
    target: unit,
  }
}

// Only call this at actual interaction-execution time, never from the per-frame proximity-prompt
// resolver above — it has a side effect (waking the unit).
export function wakeOwnSleepingNpcForCommunication(hero: UnitEntity, target: UnitEntity): void {
  if (target.shelterState?.reason !== 'sleep' || target.sleepVisualState !== 'sleeping' || target.owner !== hero.owner)
    return
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

  const trap = resolveFacingRecoverableTrap(hero, openEntityTarget)
  if (trap) return { action: 'dismantleTrap', labelKey: 'heroInteractionDismantle', target: trap }

  const openableBuilding = resolveFacingOpenableBuilding(hero, openEntityTarget)
  if (openableBuilding) return { action: 'open', labelKey: 'heroInteractionOpen', target: openableBuilding }

  const fireCamp = openEntityTarget as BuildingEntity | null | undefined
  if (isUsableFireCamp(hero, fireCamp)) return { action: 'open', labelKey: 'heroInteractionOpenMenu', target: fireCamp }

  const building = findBuildingInteriorEntryTarget(hero, buildings)
  if (building) {
    return {
      action: 'enter',
      labelKey: canUnitEnterBuildingInterior(hero, building) ? 'heroInteractionEnter' : 'heroInteractionForceEntry',
      target: building,
    }
  }

  const mountableHorse = findNearestMountableHorse(hero, companionHorse, openEntityTarget)
  if (mountableHorse) {
    return {
      action: 'mount',
      labelKey: isStoredForeignStableHorse(hero, mountableHorse) ? 'heroInteractionSteal' : 'heroInteractionMount',
      target: mountableHorse,
    }
  }

  const openEntity = resolveFacingOpenableEntity(hero, openEntityTarget)
  if (openEntity) return { action: 'open', labelKey: 'heroInteractionOpen', target: openEntity }

  const npcInteraction = resolveHeroNpcProximityInteraction(hero, openEntityTarget)
  if (npcInteraction) return npcInteraction

  if (
    openEntityTarget &&
    !openEntityTarget.isDead &&
    !openEntityTarget.isDestroyed &&
    isHeroInteractionTargetReachable(hero, null, openEntityTarget)
  ) {
    if (openEntityTarget.family === FAMILY_TYPES.building) {
      if (
        openEntityTarget.type === BUILDING_TYPES.trap ||
        CAMP_DECORATION_BUILDING_TYPES.some(type => type === openEntityTarget.type)
      )
        return null
      return { action: 'open', labelKey: 'heroInteractionOpenMenu', target: openEntityTarget }
    }
    if (openEntityTarget.family === FAMILY_TYPES.resource && openEntityTarget.interface?.info) {
      return { action: 'open', labelKey: 'heroInteractionExamine', target: openEntityTarget }
    }
  }

  return null
}
