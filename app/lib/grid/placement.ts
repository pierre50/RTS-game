import { instancesDistance } from '../maths'
import { LABEL_TYPES } from '../../constants'
import { getPlainCellsAroundPoint, getRandomZoneInGridWithCondition, getZoneInGridWithCondition } from './cells'
import type { Grid, GridCell, GridPosition, GridZone, InstanceLike } from '../../types/grid'

type DestroyableDisplayObject = {
  destroy?: () => void
  parent?: unknown
}

type TerrainCell = GridCell & {
  context?: {
    map?: {
      terrainChunkManager?: {
        invalidateCell?: (cell: TerrainCell) => void
      }
    }
  }
  getChildByLabel?: (label: string) => unknown
  removeChild?: unknown
  terrainSet?: unknown
}

type BuildingPlacement = {
  buildOnWater?: boolean
  size?: number
  type?: string
}

type PlacementVisibility<TCell extends GridCell> = {
  requireVisible: boolean
  requireExplored: boolean
  isExplored: ((cell: TCell) => boolean) | null
}

export function clearCellTerrainSet(cell?: TerrainCell | null): void {
  if (!cell) return

  const set = cell.terrainSet || cell.getChildByLabel?.(LABEL_TYPES.set)
  if (!set || typeof set !== 'object') return

  if (typeof cell.removeChild === 'function') {
    cell.removeChild(set)
  }
  if ('parent' in set && set.parent && typeof set.parent === 'object' && 'removeChild' in set.parent) {
    const removeFromParent = set.parent.removeChild
    if (typeof removeFromParent === 'function') removeFromParent(set)
  }
  if ('destroy' in set && typeof set.destroy === 'function') {
    set.destroy()
  }
  cell.terrainSet = null
  cell.context?.map?.terrainChunkManager?.invalidateCell?.(cell)
}

function createPlacementZone(instance: InstanceLike, maxSpace: number): GridZone {
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
  instance: InstanceLike,
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

function getBuildingFootprintCells<TCell extends GridCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  building: BuildingPlacement
): { cells: TCell[]; expectedCells: number } {
  const dist = building.size === 3 ? 1 : 0
  const cells = getPlainCellsAroundPoint(i, j, grid, dist)
  const expectedCells = dist === 0 ? 1 : (dist * 2 + 1) ** 2
  return { cells, expectedCells }
}

function isWaterPlacementCell(cell: GridCell): boolean {
  return cell.category === 'Water' || !!cell.waterBorder
}

function hasDirectShoreContact<TCell extends GridCell>(grid: Grid<TCell>, i: number, j: number): boolean {
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  return offsets.some(([di, dj]) => {
    const neighbor = grid[i + di]?.[j + dj]
    return !!neighbor && (!!neighbor.waterBorder || neighbor.category !== 'Water')
  })
}

function hasRequiredVisibility<TCell extends GridCell>(
  cell: TCell,
  { requireVisible, requireExplored, isExplored }: PlacementVisibility<TCell>
): boolean {
  return (!requireVisible || !!cell.visible) && (!requireExplored || !!isExplored?.(cell))
}

function canPlaceWaterBuilding<TCell extends GridCell>(
  grid: Grid<TCell>,
  i: number,
  j: number,
  cells: TCell[],
  building: BuildingPlacement,
  visibility: PlacementVisibility<TCell>
): boolean {
  let waterBorderedCells = 0
  let waterCells = 0

  for (const cell of cells) {
    if (cell.inclined || cell.solid || !hasRequiredVisibility(cell, visibility)) return false
    if (!isWaterPlacementCell(cell)) return false
    if (cell.waterBorder) waterBorderedCells++
    else if (cell.category === 'Water') waterCells++
  }

  if (building.type === 'Dock') {
    const anchorCell = grid[i]?.[j]
    if (!anchorCell || anchorCell.category !== 'Water') return false
    return waterBorderedCells > 0 && hasDirectShoreContact(grid, i, j)
  }

  return waterBorderedCells >= 2 || waterCells >= 4
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
      hasRequiredVisibility(cell, visibility)
  )
}

export function getPositionInGridAroundInstance(
  instance: InstanceLike,
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

export function canPlaceBuildingAt(
  grid: Grid,
  i: number,
  j: number,
  building: BuildingPlacement,
  { requireVisible = false, requireExplored = false, isExplored = null }: Partial<PlacementVisibility<GridCell>> = {}
): boolean {
  const { cells, expectedCells } = getBuildingFootprintCells(grid, i, j, building)
  if (cells.length !== expectedCells) return false

  const visibility = { requireVisible, requireExplored, isExplored }
  return building.buildOnWater
    ? canPlaceWaterBuilding(grid, i, j, cells, building, visibility)
    : canPlaceGroundBuilding(cells, visibility)
}
