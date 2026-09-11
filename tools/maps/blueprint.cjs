const { TERRAIN_INDEX, DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_TERRAIN_PARAMS } = require('./config.cjs')
const {
  withResolvedSettlementLocals,
  createMacroTerrain,
  resolveProtectedPosition,
  createMacroTreeOptions,
} = require('./macro.cjs')
const { compactPositions } = require('./grid.cjs')
const { runtimeNeutralResources, runtimeBiomeTrees } = require('./headless-loader.cjs')
const { buildHeadlessMap, createResourceScope } = require('./headless-map.cjs')
const { finalizeRelief } = require('./relief.cjs')
const { finalizeBlueprintPayload } = require('./local-blueprint.cjs')

function encode(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64')
}

function encodeBlueprint(map, size, seed, environmentId, options, spawns, banditCampPositions) {
  const flatTerrain = Uint8Array.from(map.grid.flat().map(cell => TERRAIN_INDEX.get(cell.type) ?? 0))
  const relief = Int8Array.from(map.grid.flat().map(cell => cell.z))
  const resources = [...map.resources].map(resource => ({
    type: resource.type,
    i: resource.i,
    j: resource.j,
    ...(typeof resource.quantity === 'number' ? { quantity: resource.quantity } : {}),
    ...(resource.textureName ? { textureName: resource.textureName } : {}),
    ...(resource.startsMature ? { startsMature: true } : {}),
  }))
  return {
    format: 'map-blueprint',
    version: 1,
    size,
    seed,
    mapType: 'world-region',
    environment: environmentId,
    encoding: 'base64',
    cellCount: flatTerrain.length,
    terrain: encode(flatTerrain),
    relief: encode(relief),
    spawns,
    ...(banditCampPositions.length ? { banditCampPositions } : {}),
    ...(Array.isArray(options.settlements) && options.settlements.length
      ? { settlements: withResolvedSettlementLocals(options.settlements, spawns, banditCampPositions) }
      : {}),
    resources,
  }
}

async function blueprint(size, seed, environmentId = DEFAULT_ENVIRONMENT_ID, options = {}) {
  const requestedSpawns = compactPositions(options.spawns)
  const requestedBanditCampPositions = compactPositions(options.banditCampPositions)
  const spawnCount = requestedSpawns.length
  const params = ENVIRONMENT_TERRAIN_PARAMS[environmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
  const terrain = createMacroTerrain(size + 1, options.macroTerrainRows)
  const spawnMap = buildHeadlessMap(terrain, size, seed, [], spawnCount, environmentId)
  const forcedSpawns = requestedSpawns
    .map(position => resolveProtectedPosition(spawnMap, position, 5, 24, 28))
    .filter(Boolean)
  const banditCampPositions = requestedBanditCampPositions
    .map(position => resolveProtectedPosition(spawnMap, position, 3, 24, 18))
    .filter(Boolean)
  const protectedPositions = [...forcedSpawns, ...banditCampPositions]
  const spawns = forcedSpawns
  if (spawns.length !== spawnCount) return null
  const map = buildHeadlessMap(
    terrain,
    size,
    seed,
    spawns,
    spawnCount,
    environmentId,
    protectedPositions.length ? protectedPositions : spawns
  )
  finalizeRelief(map, size, seed, protectedPositions.length ? protectedPositions : spawns)
  const resourcesScope = createResourceScope(map)
  const resourceOptions = createMacroTreeOptions(options.macroTerrainRows, params.treeTextureFamily, seed)
  await runtimeNeutralResources.call(
    resourcesScope,
    protectedPositions.length ? protectedPositions : spawns,
    resourceOptions
  )
  await runtimeBiomeTrees.call(resourcesScope, protectedPositions.length ? protectedPositions : spawns, resourceOptions)
  const resourcesOnReliefBorders = [...map.resources].filter(resource => map.grid[resource.i]?.[resource.j]?.inclined)
  if (resourcesOnReliefBorders.length) {
    console.warn(
      `  ! ${size} seed ${seed}: ${resourcesOnReliefBorders.length} resource(s) landed on relief border tiles`
    )
  }
  try {
    return finalizeBlueprintPayload(
      encodeBlueprint(map, size, seed, environmentId, options, spawns, banditCampPositions)
    )
  } catch (error) {
    if (error.code === 'CAVE_PLACEMENT_FAILED') return null
    throw error
  }
}

module.exports = { blueprint }
