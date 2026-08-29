import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import { sameGridCell } from '../grid/interactionCells'
import { isOutsideSpaceId } from '../mapSpaces'

const DEFAULT_BUILDING_INTERIOR_ENTRY_OFFSET = { i: 1, j: 2 }

type BuildingInteriorEntryConfig = {
  entryOffset?: Partial<GridPosition>
}

type BuildingWithInteriorConfig = BuildingEntity & {
  interior?: BuildingInteriorEntryConfig & {
    type?: string
  }
}

const BUILDING_INTERIOR_TYPES = new Set<string>([BUILDING_TYPES.townCenter, BUILDING_TYPES.house])

function buildingOwnerKey(building: BuildingEntity): string {
  return building.owner?.label || building.owner?.factionId || building.owner?.name || 'owner'
}

function buildingLocalKey(building: BuildingEntity): string {
  return building.label || `${building.i},${building.j},${building.type}`
}

export function getBuildingInteriorPortalId(building: BuildingEntity): string {
  return `${buildingOwnerKey(building)}:${buildingLocalKey(building)}`
}

export function isBuildingInteriorSupported(building: Pick<BuildingEntity, 'isBuilt' | 'type'> | null | undefined): boolean {
  return Boolean(building?.isBuilt && BUILDING_INTERIOR_TYPES.has(building.type))
}

export function getBuildingInteriorBlueprintType(building: BuildingEntity): string {
  return (building as BuildingWithInteriorConfig).interior?.type || building.type
}

function entryOffsetForBuilding(building: BuildingWithInteriorConfig): GridPosition {
  return {
    i: building.interior?.entryOffset?.i ?? DEFAULT_BUILDING_INTERIOR_ENTRY_OFFSET.i,
    j: building.interior?.entryOffset?.j ?? DEFAULT_BUILDING_INTERIOR_ENTRY_OFFSET.j,
  }
}

export function getBuildingInteriorEntryPosition(
  building: BuildingEntity | null | undefined
): GridPosition | null {
  if (!building || building.isBuilt === false || !BUILDING_INTERIOR_TYPES.has(building.type)) return null
  const offset = entryOffsetForBuilding(building as BuildingWithInteriorConfig)
  return {
    i: building.i + offset.i,
    j: building.j + offset.j,
  }
}

export function getBuildingInteriorEntryCell(
  building: BuildingEntity | null | undefined,
  grid: RuntimeCell[][] | null | undefined = building?.context?.map?.grid
): RuntimeCell | null {
  if (!building || !isBuildingInteriorSupported(building) || !grid) return null
  const position = getBuildingInteriorEntryPosition(building)
  return position ? grid[position.i]?.[position.j] ?? null : null
}

function isHeroOnBuildingInteriorEntryCell(
  hero: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!hero || !building) return false
  if (!isOutsideSpaceId(hero.spaceId)) return false
  return sameGridCell(hero, getBuildingInteriorEntryCell(building, hero.context?.map?.grid))
}

export function findBuildingInteriorEntryTarget(
  hero: UnitEntity | null,
  buildings: BuildingEntity[] | null | undefined
): BuildingEntity | null {
  if (!hero) return null
  for (const building of buildings || []) {
    if (isHeroOnBuildingInteriorEntryCell(hero, building)) return building
  }
  return null
}
