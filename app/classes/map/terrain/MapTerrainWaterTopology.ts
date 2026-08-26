import {
  EIGHT_NEIGHBOR_OFFSETS,
  getCyclicGroups,
  getNeighborFlagsFromRing,
  getNeighborRing,
  hasUnsupportedTransition,
} from '../../../lib/terrain/topology'
import type { GridPosition } from '../../../types/grid'
import type { TerrainCell, TerrainMap } from './MapTerrainTypes'

type TerrainLandChange = [cell: TerrainCell, type: string]

function isGridPosition(value: unknown): value is GridPosition {
  return (
    typeof value === 'object' &&
    value !== null &&
    Number.isFinite((value as GridPosition).i) &&
    Number.isFinite((value as GridPosition).j)
  )
}

export function normalizeWaterTopology(
  map: TerrainMap,
  invalidateReliefCoastDistances: () => void,
  level: number | null = null,
  seeds: Set<GridPosition> | null = null,
  protectedCells: Set<TerrainCell> = new Set(),
  pass: number = 0
): Set<TerrainCell> {
  const cellsToFill: TerrainCell[] = []
  const cellsToLand: TerrainLandChange[] = []
  const candidates = new Set<TerrainCell>()

  if (seeds?.size) {
    for (const seed of seeds) {
      if (!isGridPosition(seed)) continue
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const candidate = map.grid[seed.i + di]?.[seed.j + dj]
          if (candidate) candidates.add(candidate)
        }
      }
    }
  } else {
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) candidates.add(map.grid[i][j])
    }
  }

  for (const cell of candidates) {
    if (cell.category === 'Water') continue
    const { i, j } = cell
    const waterRing = getNeighborRing(map.grid, i, j, neighbor => neighbor?.category === 'Water')
    if (waterRing.filter(Boolean).length < 2) continue
    const waterNeighbors = getNeighborFlagsFromRing(waterRing)
    if (!hasUnsupportedTransition(waterNeighbors)) continue

    if (protectedCells.has(cell)) {
      for (let index = 0; index < waterRing.length; index++) {
        if (!waterRing[index]) continue
        const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[index]
        const neighbor = map.grid[i + di]?.[j + dj]
        if (neighbor && !protectedCells.has(neighbor)) cellsToLand.push([neighbor, cell.type])
      }
      continue
    }

    const hasProtectedWaterNeighbor = EIGHT_NEIGHBOR_OFFSETS.some(([di, dj]) =>
      protectedCells.has(map.grid[i + di]?.[j + dj])
    )
    if (hasProtectedWaterNeighbor) {
      cellsToFill.push(cell)
      continue
    }

    const groups = getCyclicGroups(waterRing)
    if (groups.length < 2) continue

    const largestGroup = groups.reduce((largest, group) => (group.length > largest.length ? group : largest))
    const removalCost = waterRing.filter(Boolean).length - largestGroup.length

    if (removalCost <= 1) {
      for (const group of groups) {
        if (group === largestGroup) continue
        for (const index of group) {
          const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[index]
          const neighbor = map.grid[i + di]?.[j + dj]
          if (neighbor?.category === 'Water' && !protectedCells.has(neighbor)) cellsToLand.push([neighbor, cell.type])
        }
      }
    } else if (!protectedCells.has(cell)) {
      cellsToFill.push(cell)
    }
  }

  const changedCells = new Set<TerrainCell>()
  for (const [cell, type] of cellsToLand) {
    if (cell.category !== 'Water' || !cell.setTerrainType) continue
    cell.setTerrainType(type)
    changedCells.add(cell)
  }
  for (const cell of cellsToFill) {
    if (cell.category === 'Water' || !cell.setWater) continue
    if (level != null) map.setCellReliefLevelDirect(cell, level)
    cell.setWater()
    changedCells.add(cell)
  }
  if (changedCells.size) invalidateReliefCoastDistances()

  const maxPasses = Math.max(4, Math.min(24, map.size + 1))
  if (changedCells.size && pass < maxPasses) {
    const subsequentChanges = normalizeWaterTopology(
      map,
      invalidateReliefCoastDistances,
      level,
      changedCells,
      protectedCells,
      pass + 1
    )
    for (const cell of subsequentChanges) changedCells.add(cell)
  }

  return changedCells
}
