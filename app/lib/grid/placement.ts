import type { ContainerChild } from 'pixi.js'
import { instancesDistance } from '../maths'
import { FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import { getBuildingFootprintCells, getRandomZoneInGridWithCondition, getZoneInGridWithCondition } from './cells'
import type { Grid, GridCell, GridInstanceLike, GridPosition, GridZone } from '../../types/grid'

type TerrainCell = GridCell & {
  context?: {
    map?: {
      terrainChunkManager?: {
        invalidateCell?: (cell: TerrainCell) => void
      }
    }
  }
  getChildByLabel?: (label: string) => ContainerChild | null
  removeChild?: (child: ContainerChild) => void
  terrainSet?: ContainerChild | null
}

type BuildingPlacement = {
  size?: number
  type?: string
}

export const BUILDING_PLACEMENT_EXTRA_SIZE = 1

type PlacementClearanceCell = GridCell & {
  has?: {
    family?: string
  } | null
}

type PlacementVisibility<TCell extends GridCell> = {
  requireVisible: boolean
  requireExplored: boolean
  isExplored: ((cell: TCell) => boolean) | null
  canUseCell: ((cell: TCell) => boolean) | null
}

export function clearCellTerrainSet(cell?: TerrainCell | null): void {
  if (!cell) return

  const set = cell.terrainSet || cell.getChildByLabel?.(LABEL_TYPES.set)
  if (!set || typeof set !== 'object') return

  if (typeof cell.removeChild === 'function') {
    cell.removeChild(set)
  }
  if ('parent' in set && set.parent && typeof set.parent === 'object' && 'removeChild' in set.parent) {
    const parent = set.parent
    if (typeof parent.removeChild === 'function') parent.removeChild(set)
  }
  if ('destroy' in set && typeof set.destroy === 'function') {
    set.destroy()
  }
  cell.terrainSet = null
  cell.context?.map?.terrainChunkManager?.invalidateCell?.(cell)
}

function createPlacementZone(instance: GridInstanceLike, maxSpace: number): GridZone {
  const parentSize =
    instance.parent && 'size' in instance.parent && typeof instance.parent.size === 'number' ? instance.parent.size : 0
  return {
    minX: Math.max(instance.i - maxSpace, 0),
    minY: Math.max(instance.j - maxSpace, 0),
    maxX: Math.min(instance.i + maxSpace, parentSize - 1),
    maxY: Math.min(instance.j + maxSpace, parentSize - 1),
  }
}

function createPositionCondition<TCell extends GridCell>(
  instance: GridInstanceLike,
  minSpace: number,
  maxSpace: number,
  allowInclined: boolean,
  extraCondition?: (cell: TCell) => boolean
): (cell: TCell) => boolean {
  return cell => {
    const distance = instancesDistance(instance, cell, true)
    return (
      distance >= minSpace &&
      distance <= maxSpace &&
      !cell.solid &&
      !cell.border &&
      (allowInclined || !cell.inclined) &&
      (!extraCondition || extraCondition(cell))
    )
  }
}

function getPlacementFootprintCells<TCell extends GridCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  building: BuildingPlacement
): { cells: TCell[]; expectedCells: number } {
  const size = Math.max(1, Math.floor(building.size ?? 1))
  const cells = getBuildingFootprintCells(i, j, grid, size)
  const expectedCells = size ** 2
  return { cells, expectedCells }
}

function hasRequiredVisibility<TCell extends GridCell>(
  cell: TCell,
  { requireVisible, requireExplored, isExplored }: PlacementVisibility<TCell>
): boolean {
  return (!requireVisible || !!cell.visible) && (!requireExplored || !!isExplored?.(cell))
}

function canPlaceGroundBuilding<TCell extends GridCell>(
  cells: TCell[],
  visibility: PlacementVisibility<TCell>
): boolean {
  const groundLevel = cells[0].z
  return cells.every(
    cell =>
      cell.category !== 'Water' &&
      !cell.waterBorder &&
      !cell.solid &&
      !cell.inclined &&
      !cell.border &&
      cell.z === groundLevel &&
      hasRequiredVisibility(cell, visibility) &&
      (!visibility.canUseCell || visibility.canUseCell(cell))
  )
}

function canUseBuildingClearanceCell<TCell extends PlacementClearanceCell>(
  cell: TCell,
  visibility: PlacementVisibility<TCell>
): boolean {
  return (
    cell.category !== 'Water' &&
    !cell.waterBorder &&
    !cell.inclined &&
    !cell.border &&
    hasRequiredVisibility(cell, visibility) &&
    cell.has?.family !== FAMILY_TYPES.building &&
    (!visibility.canUseCell || visibility.canUseCell(cell))
  )
}

export function getBuildingPlacementSearchSize(size: number): number {
  return Math.max(0, Math.floor(size)) + BUILDING_PLACEMENT_EXTRA_SIZE
}

export function hasBuildingPlacementClearance<TCell extends PlacementClearanceCell = PlacementClearanceCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  building: BuildingPlacement,
  {
    requireVisible = false,
    requireExplored = false,
    isExplored = null,
    canUseCell = null,
  }: Partial<PlacementVisibility<TCell>> = {}
): boolean {
  const size = getBuildingPlacementSearchSize(Number(building.size ?? 1))
  const cells = getBuildingFootprintCells(i, j, grid, size)
  if (cells.length !== size ** 2) return false

  const visibility: PlacementVisibility<TCell> = {
    requireVisible,
    requireExplored,
    isExplored,
    canUseCell,
  }
  return cells.every(cell => canUseBuildingClearanceCell(cell, visibility))
}

export function getPositionInGridAroundInstance(
  instance: GridInstanceLike,
  grid: Grid,
  space: [number, number],
  size: number,
  allowInclined = false,
  extraCondition?: (cell: GridCell) => boolean,
  random = true
): GridPosition | null {
  const [minSpace, maxSpace] = space
  const zone = createPlacementZone(instance, maxSpace)
  const cellCondition = createPositionCondition(instance, minSpace, maxSpace, allowInclined, extraCondition)

  return random
    ? getRandomZoneInGridWithCondition(zone, grid, size, cellCondition) || null
    : getZoneInGridWithCondition(zone, grid, size, cellCondition) || null
}

export function canPlaceBuildingAt<TCell extends GridCell = GridCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  building: BuildingPlacement,
  {
    requireVisible = false,
    requireExplored = false,
    isExplored = null,
    canUseCell = null,
  }: Partial<PlacementVisibility<TCell>> = {}
): boolean {
  const { cells, expectedCells } = getPlacementFootprintCells(grid, i, j, building)
  if (cells.length !== expectedCells) return false

  const visibility: PlacementVisibility<TCell> = {
    requireVisible,
    requireExplored,
    isExplored,
    canUseCell,
  }
  return canPlaceGroundBuilding(cells, visibility)
}
