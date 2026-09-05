import { ACTION_TYPES, FAMILY_TYPES, POPULATION_MAX, UNIT_TYPES } from '../../constants'
import { getActionCondition, getFreeLandCellAroundInstance } from '../../lib'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import type { RuntimeEntity, UnitCreationExtra, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

function sendUnitToEntity(unit: UnitEntity, target: RuntimeEntity): void {
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
  const space = getEntityMapSpace(building, map)
  return getFreeLandCellAroundInstance(
    building,
    space?.grid ?? map.grid,
    (items: RuntimeCell[]) => map.randomItem(items),
    createNonReservedPassageCellCondition(building.context)
  )
}

function withCellSpaceId<T extends object>(cell: RuntimeCell, options: T): T & { spaceId?: string } {
  return cell.spaceId ? { ...options, spaceId: cell.spaceId } : options
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
  const unit = building.owner.createUnit?.(withCellSpaceId(spawnCell, { i: spawnCell.i, j: spawnCell.j, type, ...unitExtra }))
  if (!unit) return false
  const rallyPoint = building.rallyPoint
  const space = getEntityMapSpace(building, map)
  const rallyCell = rallyPoint && (space?.grid ?? map.grid)[rallyPoint.i]?.[rallyPoint.j]
  if (rallyCell) {
    const rallyTarget =
      rallyCell.has && !rallyCell.has.isDestroyed && rallyCell.has.family !== FAMILY_TYPES.resource
        ? rallyCell.has
        : null
    rallyTarget ? sendUnitToEntity(unit, rallyTarget) : unit.sendTo(rallyCell)
  }

  return true
}

export function ejectTrainingVillager(building: BuildingControllerHost): void {
  const spawnCell = findSpawnCell(building)
  if (!spawnCell) return
  const unitExtra = building.owner.getUnitExtraOptions?.(UNIT_TYPES.villager) || {}
  building.owner.createUnit?.(withCellSpaceId(spawnCell, { i: spawnCell.i, j: spawnCell.j, type: UNIT_TYPES.villager, ...unitExtra }))
}
