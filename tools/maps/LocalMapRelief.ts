import { gridToLocal } from '../../app/lib/localMapLayout'
import { RELIEF_WATER_BUFFER_RADIUS } from '../../app/constants/terrain'
import { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlags, hasUnsupportedTransition } from '../../app/lib/terrain/topology'
import { enforceReliefStepContinuity } from '../../app/classes/map/terrain/MapTerrainReliefContinuity'
import type { TerrainCell, TerrainMap } from '../../app/classes/map/terrain/MapTerrainTypes'
import type { MapBlueprint } from '../../app/classes/map/MapGenerationTypes'

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
  const coastDistances = new Int16Array(n * n).fill(32767)
  const coastQueue: TerrainCell[] = []
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
      if (water) {
        coastDistances[i * n + j] = 0
        coastQueue.push(cell)
      }
      minLevels[i * n + j] = water ? 0 : -limit
      maxLevels[i * n + j] = water ? 0 : limit
      if (water || limit === 0) protectedCells.add(cell)
    }
  }
  // Recompute coast clearance on the final lattice: source-grid distances and
  // protected shore cells do not survive the staggered conversion.
  for (let cursor = 0; cursor < coastQueue.length; cursor++) {
    const cell = coastQueue[cursor]
    const distance = coastDistances[cell.i * n + cell.j] + 1
    for (const [di, dj] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const neighbor = grid[cell.i + di]?.[cell.j + dj]
      if (!neighbor) continue
      const index = neighbor.i * n + neighbor.j
      if (coastDistances[index] <= distance) continue
      coastDistances[index] = distance
      coastQueue.push(neighbor)
    }
  }
  for (const row of grid)
    for (const cell of row) {
      if (!cell) continue
      const index = cell.i * n + cell.j
      const limit = Math.max(0, coastDistances[index] - RELIEF_WATER_BUFFER_RADIUS)
      minLevels[index] = Math.max(minLevels[index], -limit)
      maxLevels[index] = Math.min(maxLevels[index], limit)
      cell.z = Math.max(minLevels[index], Math.min(maxLevels[index], cell.z))
      if (limit === 0) protectedCells.add(cell)
    }
  for (const position of [...(blueprint.spawns ?? []), ...(blueprint.banditCampPositions ?? [])]) {
    if (!position) continue
    for (let i = position.i - 6; i <= position.i + 6; i++)
      for (let j = position.j - 6; j <= position.j + 6; j++) {
        const cell = grid[i]?.[j]
        if (!cell) continue
        minLevels[i * n + j] = 0
        maxLevels[i * n + j] = 0
        protectedCells.add(cell)
      }
  }
  // Diagonal neighbors also share slope sprites. Propagate the flat-zone bounds
  // through all eight neighbors so depressions cannot meet a fixed shore in a cliff.
  const boundsQueue = grid.flat().filter(Boolean)
  for (let cursor = 0; cursor < boundsQueue.length; cursor++) {
    const cell = boundsQueue[cursor]
    const index = cell.i * n + cell.j
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      const neighbor = grid[cell.i + di]?.[cell.j + dj]
      if (!neighbor) continue
      const next = neighbor.i * n + neighbor.j
      const min = Math.max(minLevels[next], minLevels[index] - 1)
      const max = Math.min(maxLevels[next], maxLevels[index] + 1)
      if (min === minLevels[next] && max === maxLevels[next]) continue
      minLevels[next] = min
      maxLevels[next] = max
      boundsQueue.push(neighbor)
    }
  }
  for (const row of grid)
    for (const cell of row) {
      if (!cell) continue
      const index = cell.i * n + cell.j
      cell.z = Math.max(minLevels[index], Math.min(maxLevels[index], cell.z))
    }
  const map = {
    size: blueprint.size,
    grid,
    setCellReliefLevelDirect(cell: TerrainCell, z: number) {
      const index = cell.i * n + cell.j
      cell.z = Math.max(minLevels[index], Math.min(maxLevels[index], z))
    },
  } as TerrainMap
  // A fixed flat shore cannot be raised to repair an unsupported slope pattern.
  // Lower surrounding slopes instead. Each repair only lowers cells, so it
  // converges without undoing the protected flat zone.
  enforceReliefStepContinuity(map, coastDistances, protectedCells, { minLevels, maxLevels })
  let changed: boolean
  do {
    changed = false
    for (const row of grid)
      for (const cell of row) {
        if (!cell || cell.category === 'Water') continue
        for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
          const neighbor = grid[cell.i + di]?.[cell.j + dj]
          if (!neighbor || neighbor.category === 'Water' || protectedCells.has(cell)) continue
          const target = Math.max(minLevels[cell.i * n + cell.j], neighbor.z + 1)
          if (cell.z > target) {
            cell.z = target
            changed = true
          }
        }
        const flags = getNeighborFlags(grid, cell.i, cell.j, neighbor => Boolean(neighbor && neighbor.z > cell.z))
        if (!hasUnsupportedTransition(flags)) continue
        for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
          const neighbor = grid[cell.i + di]?.[cell.j + dj]
          if (!neighbor || neighbor.z <= cell.z || protectedCells.has(neighbor)) continue
          const index = neighbor.i * n + neighbor.j
          if (minLevels[index] > cell.z) continue
          neighbor.z = cell.z
          changed = true
        }
      }
  } while (changed)
  for (const row of grid)
    for (const cell of row) {
      if (cell) blueprint.relief[cell.i][cell.j] = cell.z
    }
}
