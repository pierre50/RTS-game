import { gridToLocal } from '../../../lib/localMapLayout'
import { enforceReliefStepContinuity } from '../terrain/MapTerrainReliefContinuity'
import type { TerrainCell, TerrainMap } from '../terrain/MapTerrainTypes'
import type { MapBlueprint } from '../MapGenerationTypes'

// The source atlas topology is invalidated by the staggered square conversion.
// Normalize the final lattice, using a shared zero-height rim between regions.
export function normalizeLocalMapRelief(blueprint: MapBlueprint): void {
  const layout = blueprint.localGridLayout
  if (!layout || !blueprint.relief) return
  const n = blueprint.size + 1
  const grid: TerrainCell[][] = Array.from({ length: n }, () => [])
  const minLevels = new Int16Array(n * n)
  const maxLevels = new Int16Array(n * n)
  const protectedCells = new Set<TerrainCell>()
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const type = blueprint.terrain[i]?.[j]
      if (type == null) continue
      const { column, row } = gridToLocal(i, j, layout)
      const x = column + (row % 2) / 2
      const edgeDistance = Math.min(x, layout.columns - 1 - x, row / 2, (layout.rows - 1 - row) / 2)
      const limit = Math.max(0, Math.floor(edgeDistance) - 1)
      const water = type === 'Water' || type === 2
      const level = water || limit === 0 ? 0 : Math.max(-limit, Math.min(limit, blueprint.relief[i]?.[j] ?? 0))
      const cell = { i, j, type: String(type), category: water ? 'Water' : 'Land', z: level } as TerrainCell
      grid[i][j] = cell
      minLevels[i * n + j] = water ? 0 : -limit
      maxLevels[i * n + j] = water ? 0 : limit
      if (water || limit === 0) protectedCells.add(cell)
    }
  }
  const map = {
    size: blueprint.size,
    grid,
    setCellReliefLevelDirect(cell: TerrainCell, z: number) {
      cell.z = z
    },
  } as TerrainMap
  enforceReliefStepContinuity(map, new Int16Array(n * n), protectedCells, { minLevels, maxLevels })
  for (const row of grid)
    for (const cell of row) {
      if (cell) blueprint.relief[cell.i][cell.j] = cell.z
    }
}
