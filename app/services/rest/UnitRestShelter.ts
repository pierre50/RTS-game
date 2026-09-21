import { BUILDING_TYPES } from '../../constants'
import { getBuildingShelterCapacity, hasBuildingShelterCapacity } from '../../lib/buildings/buildingOccupancy'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { getCellsAroundPoint } from '../../lib/grid/cells'
import { getEntityCell, getEntitySpaceGrid, sameMapSpace } from '../../lib/mapSpaces'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { canReachShelterBeforeBed } from './UnitRestTravel'
import { hitPointRatio, restDistance } from './UnitRestMath'

const CRITICAL_SHELTER_HITPOINT_RATIO = 0.25
const REST_OUTSIDE_SEARCH_RADIUS = 4

export type UnitRestSite = {
  location: 'shelter' | 'outside'
  shelter: BuildingEntity | null
  targetCell: RuntimeCell
}

export function isUsableShelter(
  building: BuildingEntity | null | undefined,
  owner: UnitEntity['owner']
): building is BuildingEntity {
  return Boolean(
    building &&
      building.owner === owner &&
      isBuildingInteriorSupported(building) &&
      getBuildingShelterCapacity(building) > 0 &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed
  )
}

export function isShelterUnsafe(building: BuildingEntity | null | undefined): boolean {
  return Boolean(
    !building ||
      !isUsableShelter(building, building.owner) ||
      hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO
  )
}

export function getShelterEntryCell(unit: UnitEntity, shelter: BuildingEntity): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  if (!sameMapSpace(unit, shelter)) return null
  const grid = getEntitySpaceGrid(shelter, map) ?? map.grid
  if (isBuildingInteriorSupported(shelter)) {
    const entryCell = getBuildingInteriorEntryCell(shelter, grid)
    if (entryCell && !entryCell.terrainHidden && entryCell.category !== 'Water' && !entryCell.border) return entryCell
  }
  return null
}

function isVisibleToUnit(unit: UnitEntity, entity: Pick<RuntimeEntity, 'i' | 'j'> & { visible?: boolean }): boolean {
  const map = unit.context?.map
  if (map?.revealEverything || entity.visible) return true
  if (!unit.owner?.views) return true
  return unit.owner.views.isVisible(entity.i, entity.j)
}

function isShelterVisibleToUnit(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!sameMapSpace(unit, building)) return false
  return isVisibleToUnit(unit, building)
}

/** Validate one newly available shelter without scanning every building. */
export function getShelterRestSite(unit: UnitEntity, building: BuildingEntity): UnitRestSite | null {
  if (!isUsableShelter(building, unit.owner) || !isShelterVisibleToUnit(unit, building)) return null
  if (isShelterUnsafe(building)) return null
  if (!hasBuildingShelterCapacity(building, unit.owner?.units ?? [], { exclude: unit })) return null
  const targetCell = getShelterEntryCell(unit, building)
  if (!targetCell || !canReachShelterBeforeBed(unit, targetCell)) return null
  return { location: 'shelter', shelter: building, targetCell }
}

export function getNearestShelter(unit: UnitEntity): { shelter: BuildingEntity; targetCell: RuntimeCell } | null {
  let best: { shelter: BuildingEntity; targetCell: RuntimeCell; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    const site = getShelterRestSite(unit, building)
    if (!site) continue
    const { targetCell } = site
    const score = restDistance(unit, building)
    if (!best || score < best.score) best = { shelter: building, targetCell, score }
  }
  return best
}

export function findRestCellAroundPoint(
  unit: UnitEntity,
  anchor: Pick<RuntimeEntity, 'i' | 'j'>,
  maxRadius = REST_OUTSIDE_SEARCH_RADIUS,
  minRadius = 0
): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  const grid = getEntitySpaceGrid(unit, map)
  if (!grid) return null

  let best: { cell: RuntimeCell; score: number } | null = null
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (let radius = minRadius; radius <= maxRadius; radius++) {
    const cells = getCellsAroundPoint(
      anchor.i,
      anchor.j,
      grid,
      radius,
      cell =>
        !passageLookup.has(cell) &&
        Math.max(Math.abs(cell.i - anchor.i), Math.abs(cell.j - anchor.j)) >= minRadius &&
        canUnitUseCellAsIdleDestination(unit, cell, { passageLookup })
    )
    for (const cell of cells) {
      const score = restDistance(unit, cell) + restDistance(anchor, cell) * 0.35
      if (!best || score < best.score) best = { cell, score }
    }
    if (best && radius > 0) break
  }

  return best?.cell ?? null
}

export function isUsableFireCampForRest(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!BUILDING_TYPES.fireCamp || building.type !== BUILDING_TYPES.fireCamp) return false
  if (building.isBuilt === false || building.isDead || building.isDestroyed) return false
  if (!sameMapSpace(unit, building)) return false
  return building.owner === unit.owner
}

export function getCurrentOutsideRestSite(unit: UnitEntity): UnitRestSite | null {
  const currentCell = getEntityCell(unit, unit.context?.map)
  const passageLookup = createReservedPassageCellLookup(unit.context)
  if (canUnitUseCellAsIdleDestination(unit, currentCell, { passageLookup })) {
    return { location: 'outside', shelter: null, targetCell: currentCell }
  }
  const targetCell = findRestCellAroundPoint(unit, unit, 2)
  return targetCell ? { location: 'outside', shelter: null, targetCell } : null
}
