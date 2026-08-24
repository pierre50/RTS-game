import { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlags, hasUnsupportedTransition } from '../../lib/terrain/topology'
import type { ReliefLevelBounds, TerrainCell, TerrainMap } from './MapTerrainTypes'

type TerrainLevelAdjustment = [cell: TerrainCell, targetLevel: number]
type NeighborName = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
type NeighborFlags = Record<NeighborName, boolean>
type ReliefBounds = { min: number; max: number }
type ReliefBoundsResolver = (cell: TerrainCell) => ReliefBounds

function createLevelBoundsResolver(map: TerrainMap, dist: Int16Array, levelBounds: ReliefLevelBounds | null): ReliefBoundsResolver {
  const n = map.size + 1
  return (cell: TerrainCell): ReliefBounds => {
    const index = cell.i * n + cell.j
    if (levelBounds) {
      return {
        min: levelBounds.minLevels[index],
        max: levelBounds.maxLevels[index],
      }
    }
    return {
      min: map.getMinReliefLevelFromCoastDistance(dist[index]),
      max: map.getMaxReliefLevelFromCoastDistance(dist[index]),
    }
  }
}

function getDeepestLevel(map: TerrainMap): number {
  let deepestLevel = 0
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      deepestLevel = Math.min(deepestLevel, map.grid[i][j].z)
    }
  }
  return deepestLevel
}

function expandDepthMask(map: TerrainMap, depthMask: Uint8Array, expandedMask: Uint8Array, n: number): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const index = i * n + j
      if (depthMask[index]) {
        expandedMask[index] = 1
        continue
      }

      expandedMask[index] = Number(
        EIGHT_NEIGHBOR_OFFSETS.some(([di, dj]) => {
          const ni = i + di
          const nj = j + dj
          return ni >= 0 && ni <= map.size && nj >= 0 && nj <= map.size && depthMask[ni * n + nj] === 1
        })
      )
    }
  }
}

function closeNegativeReliefGaps(map: TerrainMap, protectedCells: Set<TerrainCell>, n: number): void {
  for (let level = getDeepestLevel(map); level < 0; level++) {
    const depthMask = new Uint8Array(n * n)
    const expandedMask = new Uint8Array(n * n)

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        if (cell.category !== 'Water' && !cell.waterBorder && cell.z <= level) depthMask[i * n + j] = 1
      }
    }

    expandDepthMask(map, depthMask, expandedMask, n)
    const adjustments: TerrainCell[] = []
    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        if (cell.category === 'Water' || cell.waterBorder || cell.has || protectedCells.has(cell) || cell.z <= level)
          continue

        const closesGap = EIGHT_NEIGHBOR_OFFSETS.every(([di, dj]) => {
          const ni = i + di
          const nj = j + dj
          return ni < 0 || ni > map.size || nj < 0 || nj > map.size || expandedMask[ni * n + nj] === 1
        })
        if (expandedMask[i * n + j] && closesGap) adjustments.push(cell)
      }
    }

    for (const cell of adjustments) map.setCellReliefLevelDirect(cell, level)
  }
}

function buildDepressionUpperBounds(map: TerrainMap, n: number): Int16Array {
  const depressionUpperBounds = new Int16Array(n * n).fill(32767)
  const queue: TerrainCell[] = []

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water' || cell.waterBorder || cell.z >= 0) continue
      depressionUpperBounds[i * n + j] = cell.z
      queue.push(cell)
    }
  }

  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    const nextBound = depressionUpperBounds[cell.i * n + cell.j] + 1
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      const neighbor = map.grid[cell.i + di]?.[cell.j + dj]
      if (!neighbor || neighbor.category === 'Water' || neighbor.waterBorder) continue
      const neighborIndex = neighbor.i * n + neighbor.j
      if (depressionUpperBounds[neighborIndex] <= nextBound) continue
      depressionUpperBounds[neighborIndex] = nextBound
      queue.push(neighbor)
    }
  }

  return depressionUpperBounds
}

function applyDepressionUpperBounds(
  map: TerrainMap,
  protectedCells: Set<TerrainCell>,
  depressionUpperBounds: Int16Array,
  n: number
): void {
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water' || cell.waterBorder) continue
      const upperBound = depressionUpperBounds[i * n + j]
      if (!protectedCells.has(cell) && upperBound < cell.z) map.setCellReliefLevelDirect(cell, upperBound)
    }
  }
}

function enforceOneHeightStepPair(
  map: TerrainMap,
  high: TerrainCell,
  low: TerrainCell,
  protectedCells: Set<TerrainCell>,
  getLevelBounds: ReliefBoundsResolver,
  depressionUpperBounds: Int16Array,
  n: number
): boolean {
  if (high.z - low.z <= 1) return false

  const lowBounds = getLevelBounds(low)
  const highBounds = getLevelBounds(high)
  const targetLowLevel = high.z - 1
  const targetHighLevel = Math.max(highBounds.min, Math.min(highBounds.max, low.z + 1))
  const boundedTargetLowLevel = Math.min(targetLowLevel, depressionUpperBounds[low.i * n + low.j])
  const highProtected = protectedCells.has(high)
  const lowProtected = protectedCells.has(low)
  const previousHighLevel = high.z
  const previousLowLevel = low.z

  if (highProtected && lowProtected) return false
  if (lowProtected) {
    map.setCellReliefLevelDirect(high, targetHighLevel)
  } else {
    const target = highProtected ? targetLowLevel : boundedTargetLowLevel
    if (!low.has && target > low.z && target >= lowBounds.min && target <= lowBounds.max) {
      map.setCellReliefLevelDirect(low, target)
    } else if (!highProtected) {
      map.setCellReliefLevelDirect(high, targetHighLevel)
    }
  }

  return high.z !== previousHighLevel || low.z !== previousLowLevel
}

function enforceHeightSteps(
  map: TerrainMap,
  protectedCells: Set<TerrainCell>,
  getLevelBounds: ReliefBoundsResolver,
  depressionUpperBounds: Int16Array,
  n: number
): boolean {
  let changed = false

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      const neighbors = [map.grid[i]?.[j + 1], map.grid[i + 1]?.[j - 1], map.grid[i + 1]?.[j], map.grid[i + 1]?.[j + 1]]

      for (const neighbor of neighbors) {
        if (!neighbor) continue
        if (cell.category === 'Water' || neighbor.category === 'Water' || cell.waterBorder || neighbor.waterBorder)
          continue

        const high = cell.z >= neighbor.z ? cell : neighbor
        const low = high === cell ? neighbor : cell
        changed = enforceOneHeightStepPair(map, high, low, protectedCells, getLevelBounds, depressionUpperBounds, n) || changed
      }
    }
  }

  return changed
}

function raiseUnsupportedTransitions(
  map: TerrainMap,
  protectedCells: Set<TerrainCell>,
  getLevelBounds: ReliefBoundsResolver,
  isUnsupported: (flags: NeighborFlags) => boolean
): boolean {
  const adjustments: TerrainLevelAdjustment[] = []

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water' || cell.waterBorder || protectedCells.has(cell)) continue
      const higherNeighbors = getNeighborFlags(map.grid, cell.i, cell.j, (neighbor: TerrainCell | undefined) =>
        Boolean(neighbor && neighbor.z > cell.z)
      )
      if (!isUnsupported(higherNeighbors)) continue

      const higherLevels = EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => map.grid[i + di]?.[j + dj])
        .filter(neighbor => neighbor && neighbor.z > cell.z)
        .map(neighbor => neighbor.z)
      if (!higherLevels.length) continue

      const maxAllowed = getLevelBounds(cell).max
      const targetLevel = Math.min(Math.min(...higherLevels), maxAllowed)
      if (targetLevel > cell.z) adjustments.push([cell, targetLevel])
    }
  }

  for (const [cell, targetLevel] of adjustments) map.setCellReliefLevelDirect(cell, targetLevel)
  return adjustments.length > 0
}

export function enforceReliefStepContinuity(
  map: TerrainMap,
  dist: Int16Array = map.getReliefCoastDistances(),
  protectedCells: Set<TerrainCell> = new Set(),
  levelBounds: ReliefLevelBounds | null = null
): void {
  const n = map.size + 1
  const getLevelBounds = createLevelBoundsResolver(map, dist, levelBounds)
  closeNegativeReliefGaps(map, protectedCells, n)
  const depressionUpperBounds = buildDepressionUpperBounds(map, n)
  applyDepressionUpperBounds(map, protectedCells, depressionUpperBounds, n)

  let changed = true
  let pass = 0
  const maxPasses = Math.max(12, Math.min(64, map.size + 1))
  while (changed && pass++ < maxPasses) {
    changed = enforceHeightSteps(map, protectedCells, getLevelBounds, depressionUpperBounds, n)
    changed = raiseUnsupportedTransitions(map, protectedCells, getLevelBounds, hasUnsupportedTransition) || changed
  }
}
