import { reconcileHouseholds } from '../../lib/housing/households'
import { isBedOccupied } from './BedOccupancy'
import { isBuildingInteriorRuntimeSpace } from '../../../engine/services/BuildingInteriorSpaceLookup'
import { BUILDING_TYPES } from '../../constants'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { getCellsAroundPoint } from '../../lib/grid/cells'
import { getEntityCell, getEntitySpaceGrid, getMapSpace, sameMapSpace } from '../../lib/mapSpaces'
import { isBuildingInteriorSupported } from '../../lib/buildings/interiors'
import { canUnitEnterBuildingInterior } from '../../lib/buildings/interiorAccess'
import { ensureRuntimeBuildingInteriorSpace } from '../BuildingInteriorSpaceSystem'
import { canReachRestBeforeBed } from './UnitRestTravel'
import { getRestTravelPathLength } from './UnitRestRoute'
import { isSoldierUnit } from '../../lib/units/village/villagerSchedule'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { hitPointRatio, restDistance } from './UnitRestMath'

const REST_OUTSIDE_SEARCH_RADIUS = 4
const SOLDIER_FIRE_CAMP_RADIUS = 6
export type UnitRestSite = {
  location: 'shelter' | 'outside'
  /** Physical enclosure only, never the sleep target. */
  shelter: BuildingEntity | null
  restTarget?: BuildingEntity | null
  targetCell: RuntimeCell
}

function isUsableShelter(
  building: BuildingEntity | null | undefined,
  owner: UnitEntity['owner']
): building is BuildingEntity {
  return Boolean(
    building &&
      building.owner === owner &&
      isBuildingInteriorSupported(building) &&
      building.isBuilt &&
      !building.buildingUpgrade &&
      !building.isDead &&
      !building.isDestroyed
  )
}

export function isShelterUnsafe(building: BuildingEntity | null | undefined): boolean {
  return !building || !isUsableShelter(building, building.owner) || hitPointRatio(building) <= 0.25
}

export function isRestTargetAvailable(unit: UnitEntity, target: BuildingEntity): boolean {
  if (target.owner !== unit.owner || !target.isBuilt || target.isDead || target.isDestroyed || target.buildingUpgrade)
    return false
  if (target.type !== BUILDING_TYPES.campBedroll && target.type !== BUILDING_TYPES.fireCamp) return false
  if (target.type === BUILDING_TYPES.campBedroll && isBedOccupied(unit, target)) return false
  const space = getMapSpace(unit.context!.map, target.spaceId)
  if (isBuildingInteriorRuntimeSpace(space)) {
    const building = space.building as BuildingEntity | undefined
    if (!building || isShelterUnsafe(building) || !canUnitEnterBuildingInterior(unit, building)) return false
  }
  return true
}

export function getRestTargetSite(unit: UnitEntity, target: BuildingEntity): UnitRestSite | null {
  if (!isRestTargetAvailable(unit, target)) return null
  const targetSpace = getMapSpace(unit.context!.map, target.spaceId)
  const visibleAnchor =
    isBuildingInteriorRuntimeSpace(targetSpace) && !sameMapSpace(unit, target) ? targetSpace.building : target
  if (
    target.type === BUILDING_TYPES.campBedroll &&
    !unit.context!.map.revealEverything &&
    !visibleAnchor.visible &&
    unit.owner?.views &&
    !unit.owner.views.isVisible(visibleAnchor.i, visibleAnchor.j)
  )
    return null
  const targetCell =
    target.type === BUILDING_TYPES.campBedroll
      ? getEntitySpaceGrid(target, unit.context?.map)?.[target.i]?.[target.j]
      : findRestCellAroundPoint(unit, target, undefined, 2)
  if (
    !targetCell ||
    targetCell.terrainHidden ||
    (targetCell.border &&
      !(target.type === BUILDING_TYPES.campBedroll && isBuildingInteriorRuntimeSpace(targetSpace))) ||
    targetCell.waterBorder ||
    targetCell.category === 'Water' ||
    (targetCell.solid && targetCell.has !== unit)
  )
    return null
  if (!canReachRestBeforeBed(unit, targetCell)) return null
  const space = getMapSpace(unit.context!.map, target.spaceId)
  const shelter = isBuildingInteriorRuntimeSpace(space) ? space.building : null
  return { location: shelter ? 'shelter' : 'outside', shelter, restTarget: target, targetCell }
}

export function getNearestFurnitureRestSite(
  unit: UnitEntity,
  excludedTarget?: BuildingEntity | null
): UnitRestSite | null {
  if (!unit.context) return null
  reconcileHouseholds(unit.owner)
  // Interior contents may still be stored on their parent until first entered.
  for (const building of [...(unit.owner?.buildings ?? [])]) {
    if (isUsableShelter(building, unit.owner) && !isShelterUnsafe(building))
      ensureRuntimeBuildingInteriorSpace(unit.context, building)
  }
  reconcileHouseholds(unit.owner)
  const preferred = unit.owner?.buildings?.find(b => b.label === unit.homeBedLabel && b !== excludedTarget)
  if (preferred) {
    const site = getRestTargetSite(unit, preferred)
    if (site) return site
  }
  for (const type of [BUILDING_TYPES.campBedroll, BUILDING_TYPES.fireCamp]) {
    let best: { site: UnitRestSite; score: number } | null = null
    for (const target of unit.owner?.buildings ?? []) {
      if (target.type !== type || target === excludedTarget) continue
      const site = getRestTargetSite(unit, target)
      if (!site) continue
      const score = sameMapSpace(unit, target)
        ? restDistance(unit, target)
        : (getRestTravelPathLength(unit, site.targetCell) ?? Infinity)
      if (
        type === BUILDING_TYPES.fireCamp &&
        isSoldierUnit(unit) &&
        (sameMapSpace(unit, target) ? Math.max(Math.abs(unit.i - target.i), Math.abs(unit.j - target.j)) : score) >
          SOLDIER_FIRE_CAMP_RADIUS
      )
        continue
      if (!best || score < best.score) best = { site, score }
    }
    if (best) return best.site
  }
  return null
}

export function findRestCellAroundPoint(
  unit: UnitEntity,
  anchor: Pick<RuntimeEntity, 'i' | 'j'> & { spaceId?: string },
  maxRadius = REST_OUTSIDE_SEARCH_RADIUS,
  minRadius = 0
): RuntimeCell | null {
  const map = unit.context?.map
  if (!map) return null
  const grid = getEntitySpaceGrid(anchor, map)
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

export function getCurrentOutsideRestSite(unit: UnitEntity): UnitRestSite | null {
  const currentCell = getEntityCell(unit, unit.context?.map)
  const passageLookup = createReservedPassageCellLookup(unit.context)
  if (canUnitUseCellAsIdleDestination(unit, currentCell, { passageLookup })) {
    return { location: 'outside', shelter: null, targetCell: currentCell }
  }
  const targetCell = findRestCellAroundPoint(unit, unit, 2)
  return targetCell ? { location: 'outside', shelter: null, targetCell } : null
}
