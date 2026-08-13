import type { Grid, GridCell, GridPosition, GridZone } from '../../types/grid'

type CellCondition<TCell extends GridCell> = (cell: TCell) => boolean

function zoneMatchesCondition<TCell extends GridCell>(
  i: number,
  j: number,
  grid: Grid<TCell>,
  size: number,
  condition: CellCondition<TCell>
): boolean {
  const surroundingCells = getPlainCellsAroundPoint(i, j, grid, size)
  for (const surroundingCell of surroundingCells) {
    if (!condition(surroundingCell)) return false
  }
  return true
}

export function getZoneInGridWithCondition<TCell extends GridCell>(
  zone: GridZone,
  grid: Grid<TCell>,
  size: number,
  condition: CellCondition<TCell>
): GridPosition | null {
  for (let i = zone.minX; i <= zone.maxX; i++) {
    if (!grid[i]) continue

    for (let j = zone.minY; j <= zone.maxY; j++) {
      const cell = grid[i]?.[j]
      if (!cell) continue
      if (zoneMatchesCondition(i, j, grid, size, condition)) return { i, j }
    }
  }

  return null
}

export function getRandomZoneInGridWithCondition<TCell extends GridCell>(
  zone: GridZone,
  grid: Grid<TCell>,
  size: number,
  condition: CellCondition<TCell>,
  attempts = 100
): GridPosition | null {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const randomX = Math.floor(Math.random() * (zone.maxX - zone.minX + 1)) + zone.minX
    const randomY = Math.floor(Math.random() * (zone.maxY - zone.minY + 1)) + zone.minY

    const cell = grid[randomX]?.[randomY]
    if (!cell) continue
    if (zoneMatchesCondition(randomX, randomY, grid, size, condition)) return { i: randomX, j: randomY }
  }

  return null
}

export function getPlainCellsAroundPoint<TCell extends GridCell>(
  startX: number,
  startY: number,
  grid: Grid<TCell>,
  dist = 0,
  callback?: CellCondition<TCell>
): TCell[] {
  const result: TCell[] = []

  if (dist === 0) {
    const row = grid[startX]
    if (row) {
      const cell = row[startY]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
    return result
  }

  const minX = Math.max(startX - dist, 0)
  const maxX = Math.min(startX + dist, grid.length - 1)

  for (let i = minX; i <= maxX; i++) {
    const row = grid[i]
    if (!row) continue
    const minY = Math.max(startY - dist, 0)
    const maxY = Math.min(startY + dist, row.length - 1)

    for (let j = minY; j <= maxY; j++) {
      const cell = row[j]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
  }

  return result
}

export function getBuildingFootprintCells<TCell extends GridCell>(
  startX: number,
  startY: number,
  grid: Grid<TCell>,
  size = 1,
  callback?: CellCondition<TCell>
): TCell[] {
  const result: TCell[] = []
  const footprintSize = Math.max(1, Math.floor(size))
  const before = Math.floor((footprintSize - 1) / 2)
  const after = footprintSize - before - 1

  for (let i = startX - before; i <= startX + after; i++) {
    const row = grid[i]
    if (!row) continue

    for (let j = startY - before; j <= startY + after; j++) {
      const cell = row[j]
      if (cell && (!callback || callback(cell))) result.push(cell)
    }
  }

  return result
}

// Radius used by centered visual/contact logic. Even footprints still occupy their exact square
// through getBuildingFootprintCells(), because a 2x2 building cannot be symmetric around one cell.
export function getBuildingFootprintRadius(size: number): number {
  return Math.floor((size - 1) / 2)
}

// Distance from a building's center cell at which something is considered touching its edge.
export function getBuildingContactDistance(size: number): number {
  return getBuildingFootprintRadius(size) + 1
}

export function getCellsAroundPoint<TCell extends GridCell>(
  startX: number,
  startY: number,
  grid: Grid<TCell>,
  dist: number,
  callback?: CellCondition<TCell>
): TCell[] {
  const result: TCell[] = []

  const startCell = grid[startX]?.[startY]
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell)
    return result
  }

  for (let dx = -dist; dx <= dist; dx++) {
    const x = startX + dx
    const row = grid[x]
    if (!row) continue

    const dyMax = dist - Math.abs(dx)
    for (let dy = -dyMax; dy <= dyMax; dy++) {
      const y = startY + dy
      const cell = row[y]
      if (!cell) continue

      if (!callback || callback(cell)) result.push(cell)
    }
  }

  return result
}
