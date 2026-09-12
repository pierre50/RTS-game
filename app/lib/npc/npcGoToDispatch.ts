import { delayUnitRestAfterActivity, isSleepTime } from '../../services/rest/UnitRestRules'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import { applyDiplomaticAggression } from '../combat/diplomaticAggression'
import { ACTION_TYPES, FAMILY_TYPES, TYPE_ACTION, UNIT_TYPES } from '../constants'
import { clearUnitOverheadIndicator, setUnitOverheadIndicator } from '../entities/overheadIndicator'
import { getFreeLandCellAroundInstance } from '../grid/movement'
import { getMapSpace } from '../mapSpaces'
import { resolveClickTarget } from './npcTargetResolution'
export { resolveHoverTarget } from './npcTargetResolution'

const RESOURCE_SEND_TO_BY_ACTION: Partial<Record<string, (npc: UnitEntity, target: RuntimeEntity) => void>> = {
  [ACTION_TYPES.chopwood]: (npc, target) => npc.sendToTree?.(target),
  [ACTION_TYPES.minestone]: (npc, target) => npc.sendToStone?.(target),
  [ACTION_TYPES.minegold]: (npc, target) => npc.sendToGold?.(target),
  [ACTION_TYPES.forageberry]: (npc, target) => npc.sendToBerrybush?.(target),
  [ACTION_TYPES.farm]: (npc, target) => npc.sendToFarm?.(target),
}
const NIGHT_WORK_REFUSAL_MS = 1200

function isNightWorkBlockedForVillager(npc: UnitEntity): boolean {
  return Boolean(npc.context && npc.type === UNIT_TYPES.villager && isSleepTime(npc.context))
}

function showNightWorkRefusal(npc: UnitEntity): void {
  setUnitOverheadIndicator(npc, 'sleep')
  npc.context?.scheduler?.add(
    () => {
      clearUnitOverheadIndicator(npc)
    },
    NIGHT_WORK_REFUSAL_MS,
    'npc.nightWorkRefusal'
  )
}

function getNightWorkFallbackCell(npc: UnitEntity, cell: RuntimeCell, target: RuntimeEntity): RuntimeCell {
  const map = npc.context?.map
  const targetSpace = map ? getMapSpace(map, target.spaceId) : null
  const grid = targetSpace?.grid ?? map?.grid
  if (!grid) return cell
  return (
    getFreeLandCellAroundInstance(
      target,
      grid,
      cells =>
        [...cells].sort(
          (a, b) => Math.abs(a.i - npc.i) + Math.abs(a.j - npc.j) - (Math.abs(b.i - npc.i) + Math.abs(b.j - npc.j))
        )[0]
    ) ?? cell
  )
}

type NightWorkRefusalOptions = {
  moveToFallback?: boolean
}

function refuseNightWorkIfNeeded(
  npc: UnitEntity,
  cell: RuntimeCell,
  target: RuntimeEntity,
  options: NightWorkRefusalOptions = {}
): boolean {
  if (!isNightWorkBlockedForVillager(npc)) return false
  resetNpcDirectives(npc)
  npc.previousDest = null
  const refuse = () => {
    delayUnitRestAfterActivity(npc)
    if (options.moveToFallback !== false) npc.sendTo?.(getNightWorkFallbackCell(npc, cell, target))
    showNightWorkRefusal(npc)
  }
  if (options.moveToFallback === false) {
    refuse()
    return true
  }
  if (npc.shelterState?.reason === 'sleep' && npc.context?.unitRest?.wakeSleepingUnitForOrder(npc, refuse)) {
    return true
  }
  refuse()
  return true
}

function resetNpcDirectives(target: UnitEntity): void {
  target.lookingAtHero = false
  target.followingHero = false
  target.followAssist = null
}

export function clearNpcCommunicationFocus(target: UnitEntity): void {
  resetNpcDirectives(target)
}

export function keepNpcHere(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.stop?.()
  delayUnitRestAfterActivity(target)
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
    const kind = target.category || target.type
    const resourceAction = kind ? TYPE_ACTION[kind as keyof typeof TYPE_ACTION] : undefined
    const resourceSend = resourceAction ? RESOURCE_SEND_TO_BY_ACTION[resourceAction] : undefined
    if (resourceSend && resourceAction && npc.getActionCondition?.(target, resourceAction)) {
      if (refuseNightWorkIfNeeded(npc, cell, target, { moveToFallback: false })) return
      resourceSend(npc, target)
      return
    }
    if (target.family === FAMILY_TYPES.building && npc.getActionCondition?.(target, ACTION_TYPES.build)) {
      if (refuseNightWorkIfNeeded(npc, cell, target)) return
      npc.sendToBuilding?.(target as BuildingEntity)
      return
    }
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (hasSameOwner(npc, building) && building.isBuilt) {
        npc.sendToEvt?.(building, null, { allowPassageStop: true })
        return
      }
    }
    if (target.family === FAMILY_TYPES.animal) {
      if (target.type === 'Horse' && npc.type === UNIT_TYPES.villager) {
        if (refuseNightWorkIfNeeded(npc, cell, target)) return
        npc.sendToCaptureHorse?.(target)
        return
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.hunt)) {
        if (refuseNightWorkIfNeeded(npc, cell, target)) return
        npc.sendToHunt?.(target)
        return
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.takemeat)) {
        if (refuseNightWorkIfNeeded(npc, cell, target)) return
        npc.sendToTakeMeat?.(target)
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
