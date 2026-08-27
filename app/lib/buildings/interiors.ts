import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import { sameGridCell } from '../grid/interactionCells'

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

export function isBuildingInteriorSupported(building: Pick<BuildingEntity, 'isBuilt' | 'type'> | null | undefined): boolean {
  return Boolean(building?.isBuilt && BUILDING_INTERIOR_TYPES.has(building.type))
}

function entryOffsetForBuilding(building: BuildingWithInteriorConfig): GridPosition {
  return {
    i: building.interior?.entryOffset?.i ?? DEFAULT_BUILDING_INTERIOR_ENTRY_OFFSET.i,
    j: building.interior?.entryOffset?.j ?? DEFAULT_BUILDING_INTERIOR_ENTRY_OFFSET.j,
  }
}

export function getBuildingInteriorEntryCell(
  building: BuildingEntity | null | undefined,
  grid: RuntimeCell[][] | null | undefined = building?.context?.map?.grid
): RuntimeCell | null {
  if (!building || !isBuildingInteriorSupported(building) || !grid) return null
  const offset = entryOffsetForBuilding(building as BuildingWithInteriorConfig)
  return grid[building.i + offset.i]?.[building.j + offset.j] ?? null
}

export function isHeroOnBuildingInteriorEntryCell(
  hero: UnitEntity | null | undefined,
  building: BuildingEntity | null | undefined
): boolean {
  if (!hero || !building) return false
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
