import { ACTION_TYPES, FAMILY_TYPES, TYPE_ACTION } from '../../constants'
import { resumeVillagerAutonomy } from '../../lib'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'

const RESOURCE_SEND_TO_BY_TYPE: Record<keyof typeof TYPE_ACTION, (unit: UnitEntity, dest: RuntimeEntity) => boolean> = {
  Stone: (unit, dest) => (unit.sendToStone ? (unit.sendToStone(dest, true), true) : false),
  Gold: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Copper: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Iron: (unit, dest) => (unit.sendToMineResource ? (unit.sendToMineResource(dest, true), true) : false),
  Berrybush: (unit, dest) => (unit.sendToBerrybush ? (unit.sendToBerrybush(dest, true), true) : false),
  Wheat: (unit, dest) => (unit.sendToFarm ? (unit.sendToFarm(dest, true), true) : false),
  Tree: (unit, dest) => (unit.sendToTree ? (unit.sendToTree(dest, true), true) : false),
}

function isRuntimeEntity(value: UnitEntity['dest'] | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isBuildingEntity(value: UnitEntity['dest'] | null | undefined): value is BuildingEntity {
  return isRuntimeEntity(value) && value.family === FAMILY_TYPES.building
}

function resumeAutonomyOrStop(unit: UnitEntity): void {
  if (resumeVillagerAutonomy?.(unit)) return
  unit.stop?.()
}

export function restorePreviousWork(unit: UnitEntity): void {
  if (!unit.previousWork || unit.work === unit.previousWork) return
  unit.work = unit.previousWork
  unit.previousWork = null
}

export function clearInvalidPreviousTask(unit: UnitEntity): boolean {
  const previousDest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
  if (!previousDest) return false
  if (previousDest.family === FAMILY_TYPES.animal) return false

  if (previousDest.family === FAMILY_TYPES.building) {
    if (
      unit.getActionCondition?.(previousDest, ACTION_TYPES.build) ||
      unit.getActionCondition?.(previousDest, ACTION_TYPES.farm)
    ) {
      return false
    }
    unit.previousDest = null
    return true
  }

  const type = previousDest.category || previousDest.type
  const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
  if (!action || !unit.getActionCondition?.(previousDest, action)) {
    unit.previousDest = null
    return true
  }
  return false
}

function routeBackToAnimal(unit: UnitEntity, dest: RuntimeEntity): void {
  const map = unit.context?.map
  if (unit.getActionCondition?.(dest, ACTION_TYPES.takemeat)) {
    unit.sendToTakeMeat?.(dest, true)
  } else if (map) {
    unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.hunt)
  }
}

function routeBackToBuilding(unit: UnitEntity, dest: RuntimeEntity): void {
  const map = unit.context?.map
  if (unit.getActionCondition?.(dest, ACTION_TYPES.build)) {
    if (isBuildingEntity(dest)) unit.sendToBuilding?.(dest)
  } else if (unit.getActionCondition?.(dest, ACTION_TYPES.farm)) {
    unit.sendToFarm?.(dest, true)
  } else if (map) {
    unit.sendToEvt?.(map.grid[dest.i][dest.j], ACTION_TYPES.build)
  }
}

function routeBackToResource(unit: UnitEntity, dest: RuntimeEntity, type: string): boolean {
  const map = unit.context?.map
  const action = TYPE_ACTION[type as keyof typeof TYPE_ACTION]
  if (!action) return false
  if (unit.getActionCondition?.(dest, action)) {
    const sendTo = RESOURCE_SEND_TO_BY_TYPE[type as keyof typeof TYPE_ACTION]
    if (!sendTo(unit, dest)) unit.stop?.()
  } else if (map) {
    unit.sendToEvt?.(map.grid[dest.i][dest.j], action)
  }
  return true
}

export function goBackToPrevious(unit: UnitEntity): true | void {
  const map = unit.context?.map
  clearInvalidPreviousTask(unit)
  if (!unit.previousDest) {
    restorePreviousWork(unit)
    resumeAutonomyOrStop(unit)
    return
  }

  const dest = isRuntimeEntity(unit.previousDest) ? unit.previousDest : null
  if (!dest) {
    unit.previousDest = null
    restorePreviousWork(unit)
    resumeAutonomyOrStop(unit)
    return true
  }

  const type = dest.category || dest.type
  unit.previousDest = null
  restorePreviousWork(unit)
  unit.handleChangeDest?.()
  unit.dest = null
  unit.path = []

  if (dest.family === FAMILY_TYPES.animal) {
    routeBackToAnimal(unit, dest)
  } else if (dest.family === FAMILY_TYPES.building) {
    routeBackToBuilding(unit, dest)
  } else if (!routeBackToResource(unit, dest, type ?? '') && map) {
    unit.sendToEvt?.(map.grid[dest.i][dest.j])
  }
}
