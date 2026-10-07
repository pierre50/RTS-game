import { CELL_WIDTH, CELL_HEIGHT, CELL_DEPTH } from '../../../constants'
import { getPackedCellStore } from '../../cell/PackedCellRegistry'

type TerrainPoint = { x: number; y: number }
type TerrainBoundsMap = { size: number; grid: TerrainPoint[][] }

type TerrainMapBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  totalW: number
  totalH: number
}

export function getTerrainMapBounds(map: TerrainBoundsMap): TerrainMapBounds {
  const packed = getPackedCellStore(map.grid)
  if (packed) {
    const bounds = packed.spatialBounds().bounds
    if (!Number.isFinite(bounds.minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1, totalW: 1, totalH: 1 }
    const minX = bounds.minX - CELL_WIDTH / 2 - CELL_DEPTH
    const maxX = bounds.maxX + CELL_WIDTH / 2 + CELL_DEPTH
    const minY = bounds.minY - CELL_HEIGHT / 2 - CELL_DEPTH
    const maxY = bounds.maxY + CELL_HEIGHT / 2 + CELL_DEPTH
    return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
  }
  if (!map.grid.length) {
    const margin = CELL_WIDTH + CELL_DEPTH * 4
    const minX = -map.size * (CELL_WIDTH / 2) - margin
    const minY = -margin
    const maxX = map.size * (CELL_WIDTH / 2) + margin
    const maxY = map.size * CELL_HEIGHT + margin
    return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i]?.[j]
      if (!cell) continue
      const bounds = getTerrainCellBounds(cell)
      minX = Math.min(minX, bounds.minX)
      minY = Math.min(minY, bounds.minY)
      maxX = Math.max(maxX, bounds.maxX)
      maxY = Math.max(maxY, bounds.maxY)
    }
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 1, maxY: 1, totalW: 1, totalH: 1 }
  }
  const margin = CELL_DEPTH
  minX -= margin
  minY -= margin
  maxX += margin
  maxY += margin
  return { minX, minY, maxX, maxY, totalW: maxX - minX, totalH: maxY - minY }
}

export function getTerrainCellBounds(cell: TerrainPoint): Omit<TerrainMapBounds, 'totalW' | 'totalH'> {
  const hw = CELL_WIDTH / 2
  const hh = CELL_HEIGHT / 2
  return {
    minX: cell.x - hw,
    minY: cell.y - hh,
    maxX: cell.x + hw,
    maxY: cell.y + hh,
  }
}
