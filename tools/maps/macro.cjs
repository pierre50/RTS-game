const {
  MACRO_TERRAIN_CODE_TO_TYPE,
  TERRAIN_INDEX,
  MACRO_TREE_FAMILY_BY_CODE,
  MACRO_FOREST_PROFILE_BY_CODE,
} = require('./config.cjs')
const { macroForestNoise, macroForestClearingNoise, applyMacroClearingChance } = require('./noise.cjs')
const { getZoneInGridWithCondition } = require('./grid.cjs')

function createMacroTerrain(gridSize, rows) {
  if (!Array.isArray(rows) || rows.length !== gridSize) {
    throw new Error(`World region requires ${gridSize} macro terrain rows`)
  }
  return rows.map((row, i) => {
    if (typeof row !== 'string' || row.length !== gridSize) {
      throw new Error(`Invalid macro terrain row ${i}: expected ${gridSize} cells`)
    }
    return Array.from(row, (code, j) => {
      const terrainIndex = TERRAIN_INDEX.get(MACRO_TERRAIN_CODE_TO_TYPE[code])
      if (terrainIndex === undefined) throw new Error(`Unknown macro terrain code at ${i},${j}: ${code}`)
      return terrainIndex
    })
  })
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
  createMacroTerrain,
  resolveProtectedPosition,
  createMacroTreeOptions,
}
