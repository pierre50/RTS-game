const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { TERRAIN, TERRAIN_INDEX } = require('./config.cjs')
const { runtimeFillWaterGaps, runtimeNormalizeWaterTopology } = require('./headless-loader.cjs')
const { createSquareLocalBlueprint } = loadGenerationTs('app/classes/map/generation/LocalMapBlueprint.ts')
const { EIGHT_NEIGHBOR_OFFSETS } = require('./topology.cjs')
const { encodePreparedTerrain } = loadGenerationTs('app/serialization/PreparedTerrainCodec.ts')
const { prepareContent } = require('./prepared-content.cjs')
const { normalizeLocalMapRelief } = loadGenerationTs('tools/maps/LocalMapRelief.ts')

function prepareLocalBlueprint(source) {
  const blueprint = createSquareLocalBlueprint(source)
  const grid = blueprint.terrain.map((row, i) =>
    row.map((type, j) => ({
      i,
      j,
      type,
      category: type === 'Water' ? 'Water' : 'Land',
      z: blueprint.relief[i][j],
      setTerrainType(type) {
        this.type = type
        this.category = type === 'Water' ? 'Water' : 'Land'
      },
      setWater() {
        this.setTerrainType('Water')
      },
    }))
  )
  const scope = {
    map: {
      size: blueprint.size,
      grid,
      setCellReliefLevelDirect(cell, z) {
        cell.z = z
      },
    },
    invalidateReliefCoastDistances() {},
  }
  runtimeFillWaterGaps.call(scope)
  runtimeNormalizeWaterTopology.call(scope)
  for (const row of grid)
    for (const cell of row) {
      if (cell) blueprint.terrain[cell.i][cell.j] = cell.type
    }
  normalizeLocalMapRelief(blueprint)
  blueprint.resources = blueprint.resources?.filter(resource => {
    const { i, j } = resource
    if (!blueprint.terrain[i]?.[j] || blueprint.terrain[i][j] === 'Water') return false
    return !EIGHT_NEIGHBOR_OFFSETS.some(
      ([di, dj]) =>
        blueprint.terrain[i + di]?.[j + dj] === 'Water' ||
        (blueprint.relief[i + di]?.[j + dj] ?? -Infinity) > blueprint.relief[i][j]
    )
  })
  return blueprint
}

function finalizeBlueprintPayload(payload, { refreshContent = false } = {}) {
  if (!refreshContent && payload.version === 2 && payload.preparedContentVersion === 2) return payload
  const n = payload.size + 1
  const terrain = Buffer.from(payload.terrain, 'base64')
  const relief = new Int8Array(Buffer.from(payload.relief, 'base64'))
  const source = {
    ...payload,
    terrain: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => TERRAIN[terrain[i * n + j]])),
    relief: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => relief[i * n + j])),
  }
  if (payload.version === 2) {
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (terrain[i * n + j] === 255) {
          delete source.terrain[i][j]
          delete source.relief[i][j]
        }
  }
  const blueprint = payload.version === 2 ? source : prepareLocalBlueprint(source)
  const content = prepareContent(blueprint)
  const width = blueprint.size + 1
  const finalTerrain = new Uint8Array(width * width).fill(255)
  const finalRelief = new Int8Array(width * width)
  for (let i = 0; i < width; i++)
    for (let j = 0; j < width; j++) {
      if (blueprint.terrain[i]?.[j] == null) continue
      finalTerrain[i * width + j] = TERRAIN_INDEX.get(blueprint.terrain[i][j])
      finalRelief[i * width + j] = blueprint.relief[i][j]
    }
  return {
    ...blueprint,
    version: 2,
    sourceSize: payload.sourceSize ?? payload.size,
    preparedContentVersion: 2,
    animals: content.animals,
    terrainAppearance: undefined,
    terrainAppearanceData: Buffer.from(encodePreparedTerrain(content.terrainAppearance, blueprint.size)).toString(
      'base64'
    ),
    cellCount: finalTerrain.length,
    terrain: Buffer.from(finalTerrain).toString('base64'),
    relief: Buffer.from(finalRelief.buffer).toString('base64'),
  }
}
module.exports = { prepareLocalBlueprint, finalizeBlueprintPayload }
