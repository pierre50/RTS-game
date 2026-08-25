import { ACTION_TYPES, FAMILY_TYPES, POPULATION_MAX, UNIT_TYPES } from '../../constants'
import { getActionCondition, getFreeLandCellAroundInstance } from '../../lib'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

type DynamicUnitCommand = (target: RuntimeEntity) => void
type UnitWithDynamicCommands = UnitEntity & Record<string, DynamicUnitCommand | undefined>

function sendUnitToEntity(unit: UnitEntity, target: RuntimeEntity): void {
  if (target.family === FAMILY_TYPES.resource) {
    const sendToFunc = `sendTo${target.category || target.type}`
    const command = (unit as UnitWithDynamicCommands)[sendToFunc]
    if (typeof command === 'function') return command.call(unit, target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.animal) {
    if (getActionCondition(unit, target, ACTION_TYPES.hunt)) return unit.sendToHunt(target)
    if (getActionCondition(unit, target, ACTION_TYPES.takemeat)) return unit.sendToTakeMeat(target)
    return unit.sendTo(target)
  }
  if (target.family === FAMILY_TYPES.building) {
    if (getActionCondition(unit, target, ACTION_TYPES.build)) return unit.sendToBuilding(target)
    if (getActionCondition(unit, target, ACTION_TYPES.farm)) return unit.sendToFarm(target)
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  if (target.family === FAMILY_TYPES.unit) {
    if (getActionCondition(unit, target, ACTION_TYPES.attack)) return unit.sendTo(target, ACTION_TYPES.attack)
  }
  unit.sendTo(target)
}

function findSpawnCell(building: BuildingControllerHost): RuntimeCell | null {
  const {
    context: { map },
  } = building
  return getFreeLandCellAroundInstance(building, map.grid, (items: RuntimeCell[]) => map.randomItem(items))
}

export function placeProducedUnit(
  building: BuildingControllerHost,
  type: string,
  extra?: UnitCreationExtra,
  options: { consumePopulationSlot?: boolean } = {}
): boolean {
  const {
    context: { map },
  } = building
  const spawnCell = findSpawnCell(building)
  const consumePopulationSlot = options.consumePopulationSlot ?? true
  if (
    !spawnCell ||
    (consumePopulationSlot && building.owner.population >= Math.min(POPULATION_MAX, building.owner.populationMax))
  )
    return false
  if (consumePopulationSlot) building.owner.population++

  const unitExtra = { ...(building.owner.getUnitExtraOptions?.(type) || {}), ...(extra || {}) }
  const unit = building.owner.createUnit?.({ i: spawnCell.i, j: spawnCell.j, type, ...unitExtra })
  if (!unit) return false
  const rallyPoint = building.rallyPoint
  const rallyCell = rallyPoint && map.grid[rallyPoint.i]?.[rallyPoint.j]
  if (rallyCell) {
    const rallyTarget = rallyCell.has && !rallyCell.has.isDestroyed ? rallyCell.has : null
    rallyTarget ? sendUnitToEntity(unit, rallyTarget) : unit.sendTo(rallyCell)
  }

  return true
}

export function ejectTrainingVillager(building: BuildingControllerHost): void {
  const spawnCell = findSpawnCell(building)
  if (!spawnCell) return
  const unitExtra = building.owner.getUnitExtraOptions?.(UNIT_TYPES.villager) || {}
  building.owner.createUnit?.({ i: spawnCell.i, j: spawnCell.j, type: UNIT_TYPES.villager, ...unitExtra })
}
