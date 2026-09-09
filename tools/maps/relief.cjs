const { EIGHT_NEIGHBOR_OFFSETS, getNeighborFlags, hasUnsupportedTransition } = require('./topology.cjs')
const { RELIEF_WATER_BUFFER_RADIUS } = require('./config.cjs')
const { coastDistances } = require('./headless-map.cjs')
const { compactPositions } = require('./grid.cjs')
const { runtimeRelief } = require('./headless-loader.cjs')

function normalizeShoreRelief(map) {
  const shoreCells = []

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.waterBorder) shoreCells.push(cell)
    }
  }

  const flatten = new Map()
  const protectedCells = new Set()
  const setTarget = (cell, targetLevel) => {
    if (!cell || cell.category === 'Water') return
    const key = cell.i * (map.size + 1) + cell.j
    if (!flatten.has(key)) flatten.set(key, [cell, targetLevel])
  }

  for (const cell of shoreCells) {
    let targetLevel = cell.z
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      const neighbor = map.grid[cell.i + di]?.[cell.j + dj]
      if (neighbor?.category === 'Water') {
        targetLevel = neighbor.z
        break
      }
    }

    setTarget(cell, targetLevel)
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      setTarget(map.grid[cell.i + di]?.[cell.j + dj], targetLevel)
    }
  }

  for (const [cell, targetLevel] of flatten.values()) {
    if (cell.z !== targetLevel) map.setCellReliefLevelDirect(cell, targetLevel)
    if (cell.waterBorder) protectedCells.add(cell)
  }

  return protectedCells
}

function enforceGeneratedReliefContinuity(map, protectedCells = new Set()) {
  const pairs = [
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ]
  let changed = true
  let pass = 0
  const maxPasses = Math.max(12, Math.min(64, map.size + 1))

  while (changed && pass++ < maxPasses) {
    changed = false

    for (let i = 0; i <= map.size; i++) {
      for (let j = 0; j <= map.size; j++) {
        const cell = map.grid[i][j]
        if (cell.category === 'Water') continue

        for (const [di, dj] of pairs) {
          const neighbor = map.grid[i + di]?.[j + dj]
          if (!neighbor || neighbor.category === 'Water') continue

          const high = cell.z >= neighbor.z ? cell : neighbor
          const low = high === cell ? neighbor : cell
          if (high.z - low.z <= 1) continue

          const highProtected = protectedCells.has(high)
          const lowProtected = protectedCells.has(low)
          if (highProtected && lowProtected) continue

          if (highProtected) {
            map.setCellReliefLevelDirect(low, high.z - 1)
            protectedCells.add(low)
          } else {
            map.setCellReliefLevelDirect(high, low.z + 1)
            if (lowProtected) protectedCells.add(high)
          }
          changed = true
        }
      }
    }
  }
}

function flattenFinalProtectedZones(
  map,
  protectedPositions,
  waterRadius = RELIEF_WATER_BUFFER_RADIUS,
  spawnRadius = 6
) {
  const protectedCells = new Set()
  const distances = coastDistances(map)
  const n = map.size + 1

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (distances[i * n + j] <= waterRadius) {
        map.setCellReliefLevelDirect(cell, 0)
        protectedCells.add(cell)
      }
    }
  }

  for (const spawn of compactPositions(protectedPositions)) {
    for (let i = Math.max(0, spawn.i - spawnRadius); i <= Math.min(map.size, spawn.i + spawnRadius); i++) {
      for (let j = Math.max(0, spawn.j - spawnRadius); j <= Math.min(map.size, spawn.j + spawnRadius); j++) {
        const cell = map.grid[i][j]
        if (cell.category === 'Water') continue
        map.setCellReliefLevelDirect(cell, 0)
        protectedCells.add(cell)
      }
    }
  }

  const distancesFromFlat = new Int16Array(n * n).fill(32767)
  const queue = []
  for (const cell of protectedCells) {
    const index = cell.i * n + cell.j
    distancesFromFlat[index] = 0
    queue.push(index)
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]
    const i = Math.floor(index / n)
    const j = index % n
    for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
      const ni = i + di
      const nj = j + dj
      if (ni < 0 || ni > map.size || nj < 0 || nj > map.size) continue
      const next = ni * n + nj
      if (distancesFromFlat[next] <= distancesFromFlat[index] + 1) continue
      distancesFromFlat[next] = distancesFromFlat[index] + 1
      queue.push(next)
    }
  }

  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (protectedCells.has(cell)) continue
      const maxMagnitude = distancesFromFlat[i * n + j]
      const level = Math.max(-maxMagnitude, Math.min(maxMagnitude, cell.z))
      if (level !== cell.z) map.setCellReliefLevelDirect(cell, level)
    }
  }

  return protectedCells
}

// Mirrors the formatCellsRelief predicate: cells whose higher-neighbor layout the
// relief atlas cannot represent get approximated at render time, leaving visible holes.
function unsupportedReliefCells(map) {
  const cells = []
  for (let i = 0; i <= map.size; i++) {
    for (let j = 0; j <= map.size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water' || cell.waterBorder) continue
      const flags = getNeighborFlags(map.grid, i, j, neighbor => Boolean(neighbor && neighbor.z > cell.z))
      if (hasUnsupportedTransition(flags)) cells.push(cell)
    }
  }
  return cells
}

function finalizeRelief(map, size, seed, protectedPositions) {
  runtimeRelief.call({ map })
  const waterLevelBounds = map.clampReliefAroundWaterLevels()
  const unrestrictedReliefDistances = new Int16Array((map.size + 1) ** 2).fill(map.size + 4)
  map.enforceReliefStepContinuity(unrestrictedReliefDistances, new Set(), waterLevelBounds)
  map.formatCellsWaterBorder()
  const protectedShoreCells = normalizeShoreRelief(map)
  enforceGeneratedReliefContinuity(map, protectedShoreCells)
  const flattenedCells = flattenFinalProtectedZones(map, protectedPositions)
  // The runtime skips relief sanitization for pregenerated blueprints, so nothing
  // may mutate relief after this final atlas-aware continuity pass.
  map.enforceReliefStepContinuity(unrestrictedReliefDistances, flattenedCells, waterLevelBounds)
  const invalidReliefCells = unsupportedReliefCells(map)
  if (invalidReliefCells.length) {
    const [first] = invalidReliefCells
    console.warn(
      `  ! ${size} seed ${seed}: ${invalidReliefCells.length} atlas-unsupported relief cell(s) remain (first at [${first.i},${first.j}])`
    )
  }
  // Resources must never spawn on relief border/slope tiles (frame index > 8). Relief is
  // now final, so mark border cells before placement - MapResources' placement guards
  // check cell.inclined, which only formatCellsRelief() ever sets.
  map.formatCellsRelief()
}

module.exports = { finalizeRelief }
