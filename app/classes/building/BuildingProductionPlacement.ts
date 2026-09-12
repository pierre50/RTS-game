import { definedProperties } from '../../lib/definedProperties'
import { POPULATION_MAX, UNIT_TYPES } from '../../constants'
import { getFreeLandCellAroundInstance } from '../../lib'
import { createNonReservedPassageCellCondition } from '../../lib/buildings/passageCells'
import { getEntityMapSpace } from '../../lib/mapSpaces'
import type { UnitCreationExtra } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { BuildingControllerHost } from './BuildingTypes'

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
  const spawnCell = findSpawnCell(building)
  const consumePopulationSlot = options.consumePopulationSlot ?? true
  if (
    !spawnCell ||
    (consumePopulationSlot && building.owner.population >= Math.min(POPULATION_MAX, building.owner.populationMax))
  )
    return false
  if (consumePopulationSlot) building.owner.population++

  const unitExtra = { ...(building.owner.getUnitExtraOptions?.(type) || {}), ...(extra || {}) }
  const unit = building.owner.createUnit?.(
    withCellSpaceId(spawnCell, definedProperties({ i: spawnCell.i, j: spawnCell.j, type, ...unitExtra }))
  )
  if (!unit) return false
  return true
}

export function ejectTrainingVillager(building: BuildingControllerHost): void {
  const spawnCell = findSpawnCell(building)
  if (!spawnCell) return
  const unitExtra = building.owner.getUnitExtraOptions?.(UNIT_TYPES.villager) || {}
  building.owner.createUnit?.(
    withCellSpaceId(
      spawnCell,
      definedProperties({ i: spawnCell.i, j: spawnCell.j, type: UNIT_TYPES.villager, ...unitExtra })
    )
  )
}
