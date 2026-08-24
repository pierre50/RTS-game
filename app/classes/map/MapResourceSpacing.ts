import { SPACED_RESOURCE_TYPES } from '../../constants'
import type { RuntimeCell } from '../../types/map'

const SPACED_RESOURCE_TYPE_SET = new Set<string>(SPACED_RESOURCE_TYPES)

export function hasSpacedResourceAround(grid: RuntimeCell[][], i: number, j: number, radius: number = 3): boolean {
  const minI = Math.max(0, i - radius)
  const maxI = Math.min(grid.length - 1, i + radius)

  for (let ni = minI; ni <= maxI; ni++) {
    const row = grid[ni]
    const minJ = Math.max(0, j - radius)
    const maxJ = Math.min(row.length - 1, j + radius)
    for (let nj = minJ; nj <= maxJ; nj++) {
      if (SPACED_RESOURCE_TYPE_SET.has(row[nj]?.has?.type ?? '')) return true
    }
  }
  return false
}
