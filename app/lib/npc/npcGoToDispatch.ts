import { ACTION_TYPES, FAMILY_TYPES, LABEL_TYPES, UNIT_TYPES } from '../constants'
import { applyDiplomaticAggression } from '../combat/diplomaticAggression'
import { drawInstanceBlinkingSelection } from '../graphics/selection'
import { findInstancesInSight } from '../grid/visibility'
import { getTrainingTargetForUnit } from '../buildings/buildingTraining'
import { showUnitCannotEnterBuildingMessage } from '../buildings/buildingFeedback'
import { isVillagerSleepTime } from '../units/villagerSchedule'
import { getMapSpace } from '../mapSpaces'
import type { SelectableInstance } from '../graphics/selection'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { Point } from '../../types/grid'

const CLICK_TARGET_SEARCH_RANGE = 15
const CLICK_TARGET_TOLERANCE_PX = 60

const RESOURCE_SEND_TO: Partial<Record<string, (npc: UnitEntity, target: RuntimeEntity) => void>> = {
  Tree: (npc, target) => npc.sendToTree?.(target),
  Stone: (npc, target) => npc.sendToStone?.(target),
  Gold: (npc, target) => npc.sendToGold?.(target),
  Berrybush: (npc, target) => npc.sendToBerrybush?.(target),
  Wheat: (npc, target) => npc.sendToFarm?.(target),
}

function resetNpcDirectives(target: UnitEntity): void {
  target.lookingAtHero = false
  target.followingHero = false
  target.followAssist = null
  const marker = target.getChildByLabel?.(LABEL_TYPES.commSelection)
  if (marker) target.removeChild?.(marker)
}

export function clearNpcCommunicationFocus(target: UnitEntity): void {
  resetNpcDirectives(target)
}

export function canKeepNpcHere(target: UnitEntity): boolean {
  return Boolean(
    target.followingHero ||
      target.autonomousJob ||
      target.pendingOrder ||
      target.previousDest ||
      target.dest ||
      target.realDest ||
      (target.path?.length ?? 0) > 0 ||
      target.hasPath?.() ||
      (target.action && target.action !== ACTION_TYPES.attack) ||
      !target.inactif
  )
}

export function keepNpcHere(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.stop?.()
  if (target.context && target.type === UNIT_TYPES.villager && isVillagerSleepTime(target.context) && !target.shelterState) {
    target.context?.unitRest?.sendUnitToSleep(target)
  }
}

export function startFollowingHero(target: UnitEntity): void {
  const wasSleeping = target.shelterState?.reason === 'sleep'
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  if (wasSleeping) {
    const waking =
      target.context?.unitRest?.wakeSleepingUnitForOrder(target, () => {
        target.followingHero = true
      }) ?? false
    if (!waking) target.followingHero = true
    return
  }
  target.followingHero = true
  target.stop?.()
}

function findNearestInteractable(
  hero: UnitEntity,
  worldPoint: Point,
  cell: RuntimeCell | null,
  matches: (target: RuntimeEntity) => boolean
): RuntimeEntity | null {
  if (cell?.has && matches(cell.has)) return cell.has
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, matches, CLICK_TARGET_SEARCH_RANGE)
  let closest: RuntimeEntity | null = null
  let closestDist = CLICK_TARGET_TOLERANCE_PX
  for (const candidate of candidates) {
    const dist = Math.hypot(candidate.x - worldPoint.x, candidate.y - worldPoint.y)
    if (dist < closestDist) {
      closest = candidate
      closestDist = dist
    }
  }
  return closest
}

function isEnemyTarget(hero: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(target.owner && hero.owner?.isEnemy?.(target.owner))
}

function isClickDispatchable(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target.family === FAMILY_TYPES.resource || target.family === FAMILY_TYPES.building) return true
  if (target.family === FAMILY_TYPES.animal) return true
  return target.family === FAMILY_TYPES.unit && isEnemyTarget(hero, target) && !target.isDead
}

function resolveClickTarget(hero: UnitEntity, worldPoint: Point, cell: RuntimeCell): RuntimeEntity | null {
  return findNearestInteractable(hero, worldPoint, cell, target => isClickDispatchable(hero, target))
}

export function resolveHoverTarget(
  hero: UnitEntity,
  worldPoint: Point,
  cell: RuntimeCell | null
): RuntimeEntity | null {
  return findNearestInteractable(
    hero,
    worldPoint,
    cell,
    target =>
      isClickDispatchable(hero, target) ||
      target.family === FAMILY_TYPES.animal ||
      (target.family === FAMILY_TYPES.unit && target.owner !== hero.owner && !target.isDead)
  )
}

function sendNpcToCell(npc: UnitEntity, cell: RuntimeCell, target: RuntimeEntity | null): boolean {
  resetNpcDirectives(npc)
  if (target) {
    const kind = target.category || target.type
    const resourceSend = kind ? RESOURCE_SEND_TO[kind] : undefined
    if (resourceSend) {
      resourceSend(npc, target)
      return true
    }
    if (target.family === FAMILY_TYPES.building && npc.getActionCondition?.(target, ACTION_TYPES.build)) {
      npc.sendToBuilding?.(target as BuildingEntity)
      return true
    }
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (building.owner === npc.owner && building.isBuilt) {
        const trainingType = getTrainingTargetForUnit(building, npc)
        if (trainingType) {
          return Boolean(building.requestUnitTraining?.(trainingType, undefined, npc))
        }
        if (npc.type !== UNIT_TYPES.villager) {
          npc.sendTo?.(cell)
          return false
        }
        showUnitCannotEnterBuildingMessage(npc, building)
        return false
      }
    }
    if (target.family === FAMILY_TYPES.animal) {
      if (target.type === 'Horse' && npc.type === UNIT_TYPES.villager) {
        const captureAttemptResult = npc.sendToCaptureHorse?.(target)
        return captureAttemptResult !== false
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.hunt)) {
        npc.sendToHunt?.(target)
        return true
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.takemeat)) {
        npc.sendToTakeMeat?.(target)
        return true
      }
    }
    if (npc.type === UNIT_TYPES.priest) {
      if (npc.getActionCondition?.(target, ACTION_TYPES.heal)) {
        npc.sendTo?.(target, ACTION_TYPES.heal)
        return true
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return true
      }
      if (applyDiplomaticAggression(npc, target).changed && npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return true
      }
    }
    const attackableFamilies = [FAMILY_TYPES.unit, FAMILY_TYPES.building, FAMILY_TYPES.animal]
    if (attackableFamilies.includes(target.family) && npc.getActionCondition?.(target, ACTION_TYPES.attack)) {
      npc.sendToAttack?.(target)
      return true
    }
  }
  npc.sendTo?.(cell)
  return false
}

export function sendNpcGroupToTarget(
  npcs: UnitEntity[],
  cell: RuntimeCell,
  worldPoint: Point,
  playOrderSound: (npcs: UnitEntity[]) => void
): void {
  if (!npcs.length) return
  playOrderSound(npcs)
  const target = resolveClickTarget(npcs[0], worldPoint, cell)
  if (target) {
    let hasTargetAction = false
    for (const npc of npcs) {
      if (sendNpcToCell(npc, cell, target)) hasTargetAction = true
    }
    if (hasTargetAction) drawInstanceBlinkingSelection(target as SelectableInstance)
    return
  }
  const map = npcs[0].context?.map
  const targetSpace = map ? getMapSpace(map, cell.spaceId) : null
  const grid = targetSpace?.grid ?? map?.grid
  let minI = Infinity
  let minJ = Infinity
  let maxI = -Infinity
  let maxJ = -Infinity
  for (const npc of npcs) {
    if (npc.i < minI) minI = npc.i
    if (npc.j < minJ) minJ = npc.j
    if (npc.i > maxI) maxI = npc.i
    if (npc.j > maxJ) maxJ = npc.j
  }
  const centerI = minI + Math.round((maxI - minI) / 2)
  const centerJ = minJ + Math.round((maxJ - minJ) / 2)
  for (const npc of npcs) {
    resetNpcDirectives(npc)
    const finalCell = grid?.[cell.i + (npc.i - centerI)]?.[cell.j + (npc.j - centerJ)]
    npc.sendTo?.(finalCell || cell)
  }
}
