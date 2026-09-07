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
const DEFAULT_UNIT_SIGHT = 7

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

export function getNearestShelter(unit: UnitEntity): { shelter: BuildingEntity; targetCell: RuntimeCell } | null {
  let best: { shelter: BuildingEntity; targetCell: RuntimeCell; score: number } | null = null
  for (const building of unit.owner?.buildings ?? []) {
    if (!isUsableShelter(building, unit.owner)) continue
    if (!isShelterVisibleToUnit(unit, building)) continue
    if (hitPointRatio(building) <= CRITICAL_SHELTER_HITPOINT_RATIO) continue
    if (!hasBuildingShelterCapacity(building, unit.owner?.units ?? [], { exclude: unit })) continue
    const targetCell = getShelterEntryCell(unit, building)
    if (!targetCell) continue
    if (!canReachShelterBeforeBed(unit, targetCell)) continue
    const score = restDistance(unit, building)
    if (!best || score < best.score) best = { shelter: building, targetCell, score }
  }
  return best
}

export function findRestCellAroundPoint(
  unit: UnitEntity,
  anchor: Pick<RuntimeEntity, 'i' | 'j'>,
  maxRadius = REST_OUTSIDE_SEARCH_RADIUS
): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  const grid = getEntitySpaceGrid(unit, map)
  if (!grid) return null

  let best: { cell: RuntimeCell; score: number } | null = null
  const passageLookup = createReservedPassageCellLookup(unit.context)
  for (let radius = 0; radius <= maxRadius; radius++) {
    const cells = getCellsAroundPoint(
      anchor.i,
      anchor.j,
      grid,
      radius,
      cell => canUnitUseCellAsIdleDestination(unit, cell, { passageLookup })
    )
    for (const cell of cells) {
      const score = restDistance(unit, cell) + restDistance(anchor, cell) * 0.35
      if (!best || score < best.score) best = { cell, score }
    }
    if (best && radius > 0) break
  }

  return best?.cell ?? null
}

export function isVisibleFireCampInSight(unit: UnitEntity, building: BuildingEntity): boolean {
  if (!BUILDING_TYPES.fireCamp || building.type !== BUILDING_TYPES.fireCamp) return false
  if (building.isBuilt === false || building.isDead || building.isDestroyed) return false
  if (!sameMapSpace(unit, building)) return false
  if (!isVisibleToUnit(unit, building)) return false
  return restDistance(unit, building) <= (unit.sight ?? DEFAULT_UNIT_SIGHT)
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
