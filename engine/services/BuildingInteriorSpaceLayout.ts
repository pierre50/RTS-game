import type { MapBlueprint } from '../../app/classes/map/MapGeneration'
import { createRoundLocalInteriorBlueprint } from '../../app/classes/map/generation/LocalMapBlueprint'
import { getInteriorMapSizeForBuildingSize } from '../../app/lib/buildings/interiorProfiles'
import type { ReservedPassageCellLookup } from '../../app/lib/buildings/passageCells'
import {
  canUnitUseCellAsIdleDestination,
  createReservedPassageCellLookup,
  isRuntimeMapSpacePassageCell,
} from '../../app/lib/buildings/passageCells'
import { getCellsAroundPoint } from '../../app/lib/grid/cells'
import type { BuildingEntity, UnitEntity } from '../../app/types/entities'
import type { RuntimeCell, RuntimeMapSpace } from '../../app/types/map'
import type { BuildingInteriorRuntimeSpace } from './BuildingInteriorSpaceTypes'

function getDefaultInteriorMapSize(building: BuildingEntity): number {
  return getInteriorMapSizeForBuildingSize(building.size)
}

export function maskValue(mask: MapBlueprint['floorMask'], i: number, j: number): boolean {
  return mask?.[i]?.[j] === 1
}

export function isBlueprintExitCell(blueprint: MapBlueprint, i: number, j: number): boolean {
  return Boolean(blueprint.exits?.some(exit => exit?.i === i && exit?.j === j))
}

export function createDefaultBuildingInteriorBlueprint(building: BuildingEntity): MapBlueprint {
  const size = getDefaultInteriorMapSize(building)
  const buildingSize = building.size ?? 2
  return createRoundLocalInteriorBlueprint({
    ...(building.context?.map?.seed === undefined ? {} : { seed: building.context.map.seed }),
    buildingSize,
    kind: 'interior',
    mapType: 'interior',
    interiorType: building.type,
    size,
    terrain: [],
    relief: [],
    spawns: [],
    exits: [{ i: 0, j: 0 }],
    resources: [],
  })
}

export function isInteriorFloorCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.terrainHidden && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

function isCellAvailableForUnit(
  space: RuntimeMapSpace,
  cell: RuntimeCell | null | undefined,
  unit: UnitEntity,
  passageLookup: ReservedPassageCellLookup
): cell is RuntimeCell {
  if (isRuntimeMapSpacePassageCell(space, cell)) return false
  if (!isInteriorFloorCell(cell)) return false
  return canUnitUseCellAsIdleDestination(unit, cell, { passageLookup })
}

export function findFreeCellNear(
  space: RuntimeMapSpace,
  preferred: RuntimeCell | null | undefined,
  unit: UnitEntity,
  passageLookup: ReservedPassageCellLookup
): RuntimeCell | null {
  if (isCellAvailableForUnit(space, preferred, unit, passageLookup)) return preferred
  const anchor =
    preferred ??
    space.entryCell ??
    space.exitCell ??
    space.grid[Math.round(space.size / 2)]?.[Math.round(space.size / 2)]
  if (!anchor) return null
  for (let radius = 1; radius <= Math.max(2, space.size); radius += 1) {
    const cells = getCellsAroundPoint(anchor.i, anchor.j, space.grid, radius, cell =>
      isCellAvailableForUnit(space, cell, unit, passageLookup)
    )
    if (cells[0]) return cells[0] ?? null
  }
  return null
}

export function findSleepCell(space: BuildingInteriorRuntimeSpace, unit: UnitEntity): RuntimeCell | null {
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (const cell of space.sleepCells) {
    if (isCellAvailableForUnit(space, cell, unit, passageLookup)) return cell
  }
  return findFreeCellNear(space, space.entryCell, unit, passageLookup)
}

export function sortCellsForSleep(cells: RuntimeCell[], exitCell: RuntimeCell | null, center: number): RuntimeCell[] {
  return [...cells].sort((a, b) => {
    const aExit = exitCell ? Math.abs(a.i - exitCell.i) + Math.abs(a.j - exitCell.j) : 0
    const bExit = exitCell ? Math.abs(b.i - exitCell.i) + Math.abs(b.j - exitCell.j) : 0
    const aCenter = Math.abs(a.i - center) + Math.abs(a.j - center)
    const bCenter = Math.abs(b.i - center) + Math.abs(b.j - center)
    return bExit * 100 + bCenter - (aExit * 100 + aCenter)
  })
}
