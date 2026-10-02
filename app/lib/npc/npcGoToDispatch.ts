import { wakeUnitSimulation } from '../units/unitSuspension'
import { delayUnitRestAfterActivity } from '../../services/rest/UnitRestRules'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import { applyDiplomaticAggression } from '../combat/diplomaticAggression'
import { ACTION_TYPES, FAMILY_TYPES, UNIT_TYPES } from '../constants'
import { getMapSpace } from '../mapSpaces'
import { resolveClickTarget } from './npcTargetResolution'
export { resolveHoverTarget } from './npcTargetResolution'

function resetNpcDirectives(target: UnitEntity): void {
  wakeUnitSimulation(target)
  target.lookingAtHero = false
  target.followingHero = false
  target.followAssist = null
  target.followAssistIntent = null
  const deliveryTask = target.resourceDeliveryState?.taskId
  if (deliveryTask != null) target.context?.scheduler?.remove(deliveryTask)
  target.resourceDeliveryState = null
  target.trainingTargetType = null
  target.buildQueue = []
}

export function keepNpcHere(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.collectiveTask = null
  target.work = null
  target.stop?.()
  delayUnitRestAfterActivity(target)
}

export function startFollowingHero(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.collectiveTask = null
  target.work = null
  const follow = () => {
    // Following replaces the old rest/work plan, including after a wake animation.
    target.suspendedRestState = null
    target.followingHero = true
    target.stop?.()
  }
  if (target.context?.unitRest?.wakeRestingUnitForOrder(target, follow)) return
  follow()
}

function hasSameOwner(source: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(
    target.owner === source.owner ||
      (target.owner?.label && source.owner?.label && target.owner.label === source.owner.label)
  )
}

function sendNpcToCell(npc: UnitEntity, cell: RuntimeCell, target: RuntimeEntity | null): void {
  resetNpcDirectives(npc)
  delayUnitRestAfterActivity(npc)
  if (target) {
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (hasSameOwner(npc, building) && building.isBuilt) {
        npc.sendToEvt?.(building, null, { allowPassageStop: true })
        return
      }
    }
    if (npc.type === UNIT_TYPES.priest) {
      if (npc.getActionCondition?.(target, ACTION_TYPES.heal)) {
        npc.sendTo?.(target, ACTION_TYPES.heal)
        return
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return
      }
      if (applyDiplomaticAggression(npc, target).changed && npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return
      }
    }
    const attackableFamilies = [FAMILY_TYPES.unit, FAMILY_TYPES.building, FAMILY_TYPES.animal]
    if (attackableFamilies.includes(target.family) && npc.getActionCondition?.(target, ACTION_TYPES.attack)) {
      npc.sendToAttack?.(target)
      return
    }
  }
  npc.sendTo?.(cell)
  return
}

function routeNpcGroupThroughBuildingInteriorEntry(npcs: UnitEntity[], cell: RuntimeCell): boolean {
  const context = npcs[0].context
  const building = context?.getBuildingInteriorEntryTargetForCell?.(cell)
  const route = context?.routeUnitIntoBuildingInterior
  if (!building || !route) return false

  for (const npc of npcs) {
    resetNpcDirectives(npc)
    delayUnitRestAfterActivity(npc)
    if (!route(npc, building)) {
      npc.sendTo?.(cell)
    }
  }

  return true
}

export function sendNpcGroupToTarget(
  npcs: UnitEntity[],
  cell: RuntimeCell,
  worldPoint: Point,
  playOrderSound: (npcs: UnitEntity[]) => void
): void {
  if (!npcs.length) return
  playOrderSound(npcs)
  if (routeNpcGroupThroughBuildingInteriorEntry(npcs, cell)) return
  const target = resolveClickTarget(npcs[0], worldPoint, cell)
  if (target) {
    for (const npc of npcs) {
      sendNpcToCell(npc, cell, target)
    }
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
    delayUnitRestAfterActivity(npc)
    const finalCell = grid?.[cell.i + (npc.i - centerI)]?.[cell.j + (npc.j - centerJ)]
    npc.sendTo?.(finalCell || cell)
  }
}
