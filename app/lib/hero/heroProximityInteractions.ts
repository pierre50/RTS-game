import { ACTION_TYPES, SHEET_TYPES } from '../../constants'
import type { NpcOrdersOpenOptions } from '../../types/context'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import { findBuildingInteriorEntryTarget } from '../buildings/interiors'
import { isHeroOnInteriorExitCell } from '../buildings/interiorExits'
import { heroCanCommand } from '../chief'
import { getCellsInCellRadius } from '../grid/cells'
import { pickForeignNpcChatterLine, pickNpcChatterLine } from '../npc/npcChatter'
import { isTalkableNpc } from '../npc/npcInteraction'
import { isHeroInteractionTargetReachable } from './heroActionRange'

type HeroProximityInteractionAction = 'communicate' | 'enter' | 'exit' | 'mount' | 'open'

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
  return {
    action: 'communicate',
    labelKey: 'heroInteractionCommunicate',
    npcOptions: {
      chatterLine: unit.owner === hero.owner ? pickNpcChatterLine() : pickForeignNpcChatterLine(unit),
      ordersEnabled: false,
    },
    target: unit,
  }
}

export function resolveHeroProximityInteraction({
  buildings,
  companionHorse,
  hero,
  openEntityTarget,
}: HeroProximityInteractionOptions): HeroProximityInteraction | null {
  if (!hero || hero.isDead || hero.isDestroyed) return null

  if (isHeroOnInteriorExitCell(hero)) return { action: 'exit', labelKey: 'heroInteractionExit' }

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

  const npcInteraction = resolveHeroNpcProximityInteraction(hero, openEntityTarget)
  if (npcInteraction) return npcInteraction

  return null
}
