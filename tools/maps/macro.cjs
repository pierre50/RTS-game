const {
  MACRO_TERRAIN_CODE_TO_TYPE,
  TERRAIN_INDEX,
  MACRO_TREE_FAMILY_BY_CODE,
  MACRO_FOREST_PROFILE_BY_CODE,
} = require('./config.cjs')
const { macroForestNoise, macroForestClearingNoise, applyMacroClearingChance } = require('./noise.cjs')
const { getZoneInGridWithCondition } = require('./grid.cjs')

function removeBorderConnectedWater(terrain, params) {
  const gridSize = terrain.length
  const terrainValueByType = {
    Grass: 0,
    Desert: 1,
    Jungle: 3,
    DarkForest: 4,
    Dirt: 5,
    Snow: 7,
  }
  const groundTypeValue = terrainValueByType[params.groundType ?? 'Grass'] ?? 0
  const visited = new Uint8Array(gridSize * gridSize)
  const queue = []
  const enqueue = (i, j) => {
    if (i < 0 || j < 0 || i >= gridSize || j >= gridSize) return
    const index = i * gridSize + j
    if (visited[index] || terrain[i]?.[j] !== 2) return
    visited[index] = 1
    queue.push(index)
  }

  for (let index = 0; index < gridSize; index++) {
    enqueue(0, index)
    enqueue(gridSize - 1, index)
    enqueue(index, 0)
    enqueue(index, gridSize - 1)
  }

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor]
    const i = Math.floor(index / gridSize)
    const j = index % gridSize
    terrain[i][j] = groundTypeValue
    enqueue(i - 1, j)
    enqueue(i + 1, j)
    enqueue(i, j - 1)
    enqueue(i, j + 1)
  }
}

function applyMacroTerrainRows(terrain, rows) {
  if (!Array.isArray(rows) || !rows.length) return false
  const height = Math.min(terrain.length, rows.length)
  for (let i = 0; i < height; i++) {
    const row = String(rows[i] || '')
    const width = Math.min(terrain[i]?.length || 0, row.length)
    for (let j = 0; j < width; j++) {
      const terrainType = MACRO_TERRAIN_CODE_TO_TYPE[row[j]]
      const terrainIndex = TERRAIN_INDEX.get(terrainType)
      if (terrainIndex !== undefined) terrain[i][j] = terrainIndex
    }
  }
  return true
}

function createMacroTreeOptions(rows, fallbackFamily = null, seed = 0) {
  if (!Array.isArray(rows) || !rows.length) return { treeTextureFamily: fallbackFamily }
  const codeForCell = cell => String(rows[cell.i] || '')[cell.j]
  return {
    treeTextureFamily: fallbackFamily,
    treeTextureFamilyForCell: cell => MACRO_TREE_FAMILY_BY_CODE[codeForCell(cell)] ?? fallbackFamily,
    treeChanceForCell: cell => {
      const profile = MACRO_FOREST_PROFILE_BY_CODE[codeForCell(cell)]
      if (!profile) return 0
      const mask = macroForestNoise(cell.i, cell.j, seed, profile.scale, profile.seedOffset)
      const clearing = macroForestClearingNoise(cell.i, cell.j, seed, profile)
      if (mask >= profile.threshold) return applyMacroClearingChance(profile.coreChance, clearing, profile)
      if (mask >= profile.threshold - 0.08) return applyMacroClearingChance(profile.edgeChance, clearing, profile)
      return 0
    },
  }
}

function resolveProtectedPosition(map, position, zoneRadius = 5, searchRadius = 18, padding = 0) {
  const canUseCell = cell => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'
  const clamped = {
    i: Math.max(padding, Math.min(map.size - padding, Math.round(position.i))),
    j: Math.max(padding, Math.min(map.size - padding, Math.round(position.j))),
  }
  for (let radius = 0; radius <= searchRadius; radius++) {
    const candidate = getZoneInGridWithCondition(
      {
        minX: Math.max(padding, clamped.i - radius),
        maxX: Math.min(map.size - padding, clamped.i + radius),
        minY: Math.max(padding, clamped.j - radius),
        maxY: Math.min(map.size - padding, clamped.j + radius),
      },
      map.grid,
      zoneRadius,
      canUseCell
    )
    if (candidate) return { i: candidate.i, j: candidate.j }
  }
  return null
}

function withResolvedSettlementLocals(settlements = [], spawns = [], banditCampPositions = []) {
  let spawnIndex = 0
  let banditIndex = 0
  return settlements.map(settlement => {
    if (settlement.kind === 'village' || settlement.kind === 'city') {
      return { ...settlement, local: spawns[spawnIndex++] ?? settlement.local }
    }
    if (settlement.kind === 'banditCamp') {
      return { ...settlement, local: banditCampPositions[banditIndex++] ?? settlement.local }
    }
    return settlement
  })
}

module.exports = {
  withResolvedSettlementLocals,
  applyMacroTerrainRows,
  removeBorderConnectedWater,
  resolveProtectedPosition,
  createMacroTreeOptions,
}
