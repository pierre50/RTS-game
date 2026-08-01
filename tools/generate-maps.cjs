#!/usr/bin/env node

/* Builds map blueprints with the exact terrain and relief algorithms used by
 * MapGeneration, MapTerrain and MapResources. This script deliberately reads those methods
 * from their source files, so there is no second generator to maintain. */
const fs = require('node:fs')
const path = require('node:path')

// The resource generators yield with requestAnimationFrame between batches so the
// browser stays responsive; Node has no such API, so give them an event-loop tick instead.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = callback => setImmediate(() => callback(0))
}

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'public', 'maps')
const TERRAIN = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'DeepWater']
const TERRAIN_INDEX = new Map(TERRAIN.map((type, index) => [type, index]))

// app/constants/environments.ts is plain data (no pixi/DOM deps), so it can be loaded
// directly instead of duplicating its thresholds here like the mocks below have to.
function loadPlainTsModule(relativePath) {
  const filename = path.join(ROOT, relativePath)
  const babel = require('@babel/core')
  const { code } = babel.transformFileSync(filename, {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { ENVIRONMENT_TERRAIN_PARAMS, DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS } = loadPlainTsModule(
  'app/constants/environments.ts'
)

function mapSettingsFromRuntimeConfig() {
  const sizesSource = fs.readFileSync(path.join(ROOT, 'app/config/mapSizes.ts'), 'utf8')
  const sizes = [...sizesSource.matchAll(/value:\s*(\d+),\s*maxPlayers:\s*(\d+)(?:,\s*editorOnly:\s*true)?/g)]
    .map(([, size, maxPlayers]) => ({ size: Number(size), maxPlayers: Number(maxPlayers) }))
    .filter(({ size }) => size !== 16)
  if (!sizes.length) throw new Error('Could not read map sizes from app/config')
  return { sizes }
}

const MAP_SETTINGS = mapSettingsFromRuntimeConfig()
const SIZES = new Set(MAP_SETTINGS.sizes.map(({ size }) => size))
const maxPlayersForSize = size => MAP_SETTINGS.sizes.find(entry => entry.size === size)?.maxPlayers

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm maps:generate -- --size 256 --count 100

  --size <n[,n]>          144, 256, 512 (default: 256)
  --count <n>             maps per size, per environment (default: 10)
  --seed <n>              reproducible batch seed (default: current time)
  --out <directory>       output directory (default: public/maps)
  --environment <e[,e]>   ${ENVIRONMENT_IDS.join(', ')} (default: ${DEFAULT_ENVIRONMENT_ID} only, untagged filenames)`)
}

function argumentsFrom(argv) {
  const options = {
    sizes: [256],
    count: 10,
    seed: Date.now(),
    out: OUTPUT,
    environments: [DEFAULT_ENVIRONMENT_ID],
    explicitEnvironment: false,
  }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--') continue
    if (key === '--help') return { help: true }
    const value = argv[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--size') options.sizes = value.split(',').map(Number)
    else if (key === '--count') options.count = Number(value)
    else if (key === '--seed') options.seed = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else if (key === '--environment') {
      options.environments = value.split(',')
      options.explicitEnvironment = true
    } else throw new Error(`Unknown option: ${key}`)
  }
  if (!options.sizes.every(size => SIZES.has(size))) throw new Error('Unsupported --size')
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be positive')
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  if (!options.environments.every(env => Object.hasOwn(ENVIRONMENT_TERRAIN_PARAMS, env))) {
    throw new Error(`Unsupported --environment (expected one of: ${ENVIRONMENT_IDS.join(', ')})`)
  }
  return options
}

function hashSeed(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function randomFrom(seed) {
  let state = hashSeed(seed)
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function getDeterministicCellVariantIndex(i, j, count, seed = 0) {
  if (!Number.isFinite(count) || count <= 0) return 0
  let hash = hashSeed(seed)
  hash ^= Math.imul(i + 1, 374761393)
  hash = Math.imul(hash, 668265263)
  hash ^= Math.imul(j + 1, 1274126177)
  hash = Math.imul(hash, 2246822519)
  hash ^= hash >>> 15
  return (hash >>> 0) % count
}

function getDeterministicCellVariant(items = [], i, j, seed = 0) {
  if (!Array.isArray(items) || !items.length) return null
  return items[getDeterministicCellVariantIndex(i, j, items.length, seed)]
}

function getCellsAroundPoint(i, j, grid, radius, predicate) {
    const cells = []
    for (let x = Math.max(0, i - radius); x <= Math.min(grid.length - 1, i + radius); x++) {
      for (let y = Math.max(0, j - radius); y <= Math.min(grid.length - 1, j + radius); y++) {
        const cell = grid[x]?.[y]
        if (cell && predicate(cell)) cells.push(cell)
      }
    }
    return cells
}

function getZoneInGridWithCondition(bounds, grid, radius, predicate) {
  for (let i = bounds.minX; i <= bounds.maxX; i++) for (let j = bounds.minY; j <= bounds.maxY; j++) {
    const cell = grid[i]?.[j]
    if (!cell || !predicate(cell)) continue
    let valid = true
    for (let x = i - radius; x <= i + radius && valid; x++) for (let y = j - radius; y <= j + radius; y++) {
      if (!grid[x]?.[y] || !predicate(grid[x][y])) { valid = false; break }
    }
    if (valid) return cell
  }
  return null
}

const EIGHT_NEIGHBOR_OFFSETS = Object.freeze([
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
])
const EIGHT_NEIGHBOR_NAMES = Object.freeze(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])
function getNeighborRing(grid, i, j, predicate) {
  return EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => predicate(grid[i + di]?.[j + dj], di, dj))
}
function getNeighborFlagsFromRing(ring) {
  return Object.fromEntries(EIGHT_NEIGHBOR_NAMES.map((name, index) => [name, ring[index]]))
}
function getNeighborFlags(grid, i, j, predicate) {
  return getNeighborFlagsFromRing(getNeighborRing(grid, i, j, predicate))
}
function getCyclicGroups(ring) {
  const groups = []
  for (let index = 0; index < ring.length; index++) {
    const previous = (index + ring.length - 1) % ring.length
    if (!ring[index] || ring[previous]) continue
    const indices = []
    for (let cursor = index; ring[cursor]; cursor = (cursor + 1) % ring.length) indices.push(cursor)
    groups.push(indices)
  }
  return groups
}
function hasUnsupportedTransition({ n, ne, e, se, s, sw, w, nw }) {
  const cardinalCount = Number(n) + Number(e) + Number(s) + Number(w)
  const diagonalCount = Number(ne) + Number(se) + Number(sw) + Number(nw)
  if ((n && s) || (e && w) || cardinalCount >= 3) return true
  if (cardinalCount === 0) return diagonalCount > 1
  if (cardinalCount !== 1) return false
  if (n) return sw || se
  if (e) return nw || sw
  if (s) return nw || ne
  return ne || se
}
function getWaterBorderFrame({ n, s, w, e, nw, ne, sw, se }) {
  if (w && n) return '001'
  if (e && s) return '002'
  if (w && s) return '003'
  if (e && n) return '000'
  if (n) return '008'
  if (s) return '009'
  if (w) return '011'
  if (e) return '010'
  if (nw) return '005'
  if (sw) return '007'
  if (ne) return '004'
  if (se) return '006'
  return null
}

function loadRuntimeGenerators() {
  const Module = require('node:module')
  const babel = require('@babel/core')
  const originalLoad = Module._load
  const originalExtension = require.extensions['.ts']
  const isMapRuntime = filename =>
    filename.endsWith('/MapGeneration.ts') || filename.endsWith('/MapTerrain.ts') || filename.endsWith('/MapResources.ts')
  const pixi = { Assets: { cache: { get: () => ({}) } }, Sprite: class {}, Container: class {} }
  class HeadlessResource {
    constructor(options, context) {
      Object.assign(this, options)
      this.context = context
      this.size = 1
      const cell = context.map.grid[this.i]?.[this.j]
      if (cell) {
        cell.has = this
        cell.solid = true
      }
    }
  }
  const constants = {
    CELL_DEPTH: 1,
    RESOURCE_TYPES: {
      tree: 'Tree',
      berrybush: 'Berrybush',
      stone: 'Stone',
      gold: 'Gold',
      salmon: 'Salmon',
    },
    // Kept in sync with app/constants/ambient.ts: DarkForest/Jungle have no entry since
    // EnvironmentTerrainParams.forestCellTreeChance always overrides them.
    BIOME_TREE_CHANCE: {
      Grass: 0,
      Desert: 0,
    },
    BIOME_TREE_PLAYER_SAFE_DIST: 22,
    ENVIRONMENT_TERRAIN_PARAMS,
    DEFAULT_ENVIRONMENT_ID,
    getEnvironmentTerrainParams: environment =>
      ENVIRONMENT_TERRAIN_PARAMS[environment] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID],
  }
  Module._load = function (request, parent, isMain) {
    if (parent && isMapRuntime(parent.filename)) {
      if (request === 'pixi.js') return pixi
      if (request === '../Resource') return { Resource: HeadlessResource }
      if (request === '../../lib') {
        return {
          getCellsAroundPoint,
          getDeterministicCellVariant,
          getZoneInGridWithCondition,
        }
      }
      if (request === '../../constants') return constants
      if (request === '../../lib/terrain/topology') {
        return {
          EIGHT_NEIGHBOR_OFFSETS,
          getCyclicGroups,
          getNeighborFlags,
          getNeighborFlagsFromRing,
          getNeighborRing,
          getWaterBorderFrame,
          hasUnsupportedTransition,
        }
      }
      return {}
    }
    return originalLoad(request, parent, isMain)
  }
  require.extensions['.ts'] = (module, filename) => {
    if (isMapRuntime(filename)) {
      const code = babel.transformFileSync(filename, {
        presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
      }).code
      module._compile(code, filename)
      return
    }
    originalExtension(module, filename)
  }
  try {
    const { MapGeneration } = require(path.join(ROOT, 'app/classes/map/MapGeneration.ts'))
    const { MapTerrain } = require(path.join(ROOT, 'app/classes/map/MapTerrain.ts'))
    const { MapResources } = require(path.join(ROOT, 'app/classes/map/MapResources.ts'))
    return { MapGeneration, MapTerrain, MapResources }
  } finally {
    Module._load = originalLoad
    require.extensions['.ts'] = originalExtension
  }
}

const { MapGeneration, MapTerrain, MapResources } = loadRuntimeGenerators()
const runtimeTerrain = MapGeneration.prototype.generateTerrain
const runtimeRelief = MapTerrain.prototype.generateMapRelief
const runtimeClassifyDeepWater = MapTerrain.prototype.classifyDeepWater
const runtimeClampReliefAroundWaterLevels = MapTerrain.prototype.clampReliefAroundWaterLevels
const runtimeEnforceReliefStepContinuity = MapTerrain.prototype.enforceReliefStepContinuity
const runtimeFormatCellsWaterBorder = MapTerrain.prototype.formatCellsWaterBorder
const runtimeFormatCellsRelief = MapTerrain.prototype.formatCellsRelief
const runtimeSpawns = MapGeneration.prototype.findPlayerPlaces
const runtimePlayerResources = MapResources.prototype.generateResourcesAroundPlayersAsync
const runtimeNeutralResources = MapResources.prototype.generateNeutralResourceGroupsAsync
const runtimeBiomeTrees = MapResources.prototype.generateBiomeTreesAsync
const runtimeGenerateForestAroundPlayer = MapResources.prototype.generateForestAroundPlayer
const runtimeFindNeutralResourceCenter = MapResources.prototype.findNeutralResourceCenter
const runtimePlaceResourceGroup = MapResources.prototype.placeResourceGroup
const runtimePlaceResourceGroupAt = MapResources.prototype.placeResourceGroupAt

function coastDistances(map) {
  const n = map.size + 1
  const distances = new Int16Array(n * n).fill(9999)
  const queue = []
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if (map.grid[i][j].category === 'Water') {
      const index = i * n + j
      distances[index] = 0
      queue.push(index)
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor], i = Math.floor(index / n), j = index % n
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const ni = i + di, nj = j + dj
      if (ni < 0 || ni >= n || nj < 0 || nj >= n) continue
      const next = ni * n + nj
      if (distances[next] > distances[index] + 1) {
        distances[next] = distances[index] + 1
        queue.push(next)
      }
    }
  }
  return distances
}

function buildHeadlessMap(terrain, size, seed, playersPos, positionsCount = playersPos.length, environment = DEFAULT_ENVIRONMENT_ID) {
  const map = {
    size,
    seed,
    playersPos,
    mapType: 'continent',
    environment,
    positionsCount,
    resourceDensity: 'moderate',
    grid: [],
    resources: new Set(),
    _coastDistances: null,
    random: randomFrom(`${seed}:0`),
  }
  for (let i = 0; i <= size; i++) {
    map.grid[i] = []
    for (let j = 0; j <= size; j++) {
      const type = TERRAIN[terrain[i][j]]
      map.grid[i][j] = {
        i,
        j,
        type,
        category: type === 'Water' || type === 'DeepWater' ? 'Water' : 'Land',
        z: 0,
        y: 0,
        has: null,
        waterBorder: false,
        border: false,
        solid: false,
        inclined: false,
        setWaterBorder(resourceName, index) {
          this.border = true
          this.waterBorder = true
          this.waterBorderResourceName = resourceName
          this.waterBorderIndex = index
        },
        setReliefBorder() {
          this.inclined = true
        },
      }
    }
  }
  map.getReliefCoastDistances = () => map._coastDistances || (map._coastDistances = coastDistances(map))
  map.getMaxReliefLevelFromCoastDistance = distance => Math.max(0, distance - 3)
  map.getMinReliefLevelFromCoastDistance = distance => -map.getMaxReliefLevelFromCoastDistance(distance)
  map.setCellReliefLevelDirect = (cell, level) => { cell.z = level }
  map.clampReliefAroundWater = dist => {
    for (let i = 0; i <= size; i++) for (let j = 0; j <= size; j++) {
      const cell = map.grid[i][j]
      if (cell.category === 'Water') continue
      const max = map.getMaxReliefLevelFromCoastDistance(dist[i * (size + 1) + j])
      cell.z = Math.max(-max, Math.min(max, cell.z))
    }
  }
  map.flattenPlayerStartZones = () => {
    for (const pos of playersPos) {
      for (let i = Math.max(0, pos.i - 6); i <= Math.min(size, pos.i + 6); i++) {
        for (let j = Math.max(0, pos.j - 6); j <= Math.min(size, pos.j + 6); j++) {
          if (map.grid[i][j].category !== 'Water') map.grid[i][j].z = 0
        }
      }
    }
  }
  map.clampReliefAroundWaterLevels = () => runtimeClampReliefAroundWaterLevels.call({ map })
  map.enforceReliefStepContinuity = (...args) => runtimeEnforceReliefStepContinuity.apply({ map }, args)
  map.formatCellsWaterBorder = () => runtimeFormatCellsWaterBorder.call({ map })
  // Mirrors MapTerrain#rebuildTerrainAppearance: sprite backfill is purely visual and
  // has no headless equivalent, so it's stubbed out - only the border/inclined flags matter here.
  map.formatCellsRelief = () => runtimeFormatCellsRelief.call({ map, rebuildTerrainBackfill() {} })
  map.addChild = instance => instance
  map.randomRange = (min, max) => Math.floor(map.random() * (max - min + 1) + min)
  map.randomItem = (items = []) => items[Math.floor(map.random() * items.length)]
  map.context = { map }
  const resourcesScope = { map }
  map.generateForestAroundPlayer = (...args) => runtimeGenerateForestAroundPlayer.apply(resourcesScope, args)
  map.findNeutralResourceCenter = (...args) => runtimeFindNeutralResourceCenter.apply(resourcesScope, args)
  map.placeResourceGroup = (...args) => runtimePlaceResourceGroup.apply(resourcesScope, args)
  map.placeResourceGroupAt = (...args) => runtimePlaceResourceGroupAt.apply(resourcesScope, args)
  return map
}

function encode(array) { return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64') }

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

function flattenFinalProtectedZones(map, spawns, waterRadius = 3, spawnRadius = 6) {
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

  for (const spawn of spawns) {
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

async function blueprint(size, seed, environmentId = DEFAULT_ENVIRONMENT_ID) {
  const playerCount = maxPlayersForSize(size)
  const params = ENVIRONMENT_TERRAIN_PARAMS[environmentId] ?? ENVIRONMENT_TERRAIN_PARAMS[DEFAULT_ENVIRONMENT_ID]
  const context = { map: { seed, positionsCount: playerCount } }
  const terrain = runtimeTerrain.call(context, size + 1, seed, params)
  const spawnMap = buildHeadlessMap(terrain, size, seed, [], playerCount, environmentId)
  const spawns = runtimeSpawns.call({ map: spawnMap })
  if (spawns.length !== playerCount) return null
  const map = buildHeadlessMap(terrain, size, seed, spawns, playerCount, environmentId)
  runtimeRelief.call({ map })
  runtimeClassifyDeepWater.call({ map })
  const waterLevelBounds = map.clampReliefAroundWaterLevels()
  const unrestrictedReliefDistances = new Int16Array((map.size + 1) ** 2).fill(map.size + 4)
  map.enforceReliefStepContinuity(unrestrictedReliefDistances, new Set(), waterLevelBounds)
  map.formatCellsWaterBorder()
  const protectedShoreCells = normalizeShoreRelief(map)
  enforceGeneratedReliefContinuity(map, protectedShoreCells)
  const flattenedCells = flattenFinalProtectedZones(map, spawns)
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
  await runtimePlayerResources.call({ map }, spawns)
  await runtimeNeutralResources.call({ map }, spawns)
  await runtimeBiomeTrees.call({ map }, spawns)
  const resourcesOnReliefBorders = [...map.resources].filter(resource => map.grid[resource.i]?.[resource.j]?.inclined)
  if (resourcesOnReliefBorders.length) {
    console.warn(
      `  ! ${size} seed ${seed}: ${resourcesOnReliefBorders.length} resource(s) landed on relief border tiles`
    )
  }
  const flatTerrain = Uint8Array.from(map.grid.flat().map(cell => TERRAIN_INDEX.get(cell.type) ?? 0))
  const relief = Int8Array.from(map.grid.flat().map(cell => cell.z))
  const resources = [...map.resources].map(resource => ({
    type: resource.type,
    i: resource.i,
    j: resource.j,
  }))
  return {
    format: 'map-blueprint',
    version: 1,
    size,
    seed,
    environment: environmentId,
    encoding: 'base64',
    cellCount: flatTerrain.length,
    terrain: encode(flatTerrain),
    relief: encode(relief),
    spawns,
    resources,
  }
}

async function main() {
  let options
  try { options = argumentsFrom(process.argv.slice(2)) } catch (error) { usage(error.message); process.exitCode = 1; return }
  if (options.help) return usage()
  const random = randomFrom(options.seed)
  const manifest = { format: 'map-manifest', version: 1, generatedAt: new Date().toISOString(), batchSeed: options.seed, maps: [] }
  for (const size of options.sizes) {
    const directory = path.join(options.out, String(size))
    fs.mkdirSync(directory, { recursive: true })
    for (const environmentId of options.environments) {
      const envSlug = environmentId.toLowerCase()
      let written = 0, attempts = 0
      while (written < options.count) {
        if (++attempts > options.count * 30) throw new Error(`Could not find enough valid ${size} ${environmentId} maps`)
        const seed = Math.floor(random() * 0x7fffffff), map = await blueprint(size, seed, environmentId)
        if (!map) continue
        const id = options.explicitEnvironment
          ? `map-${size}-${envSlug}-${String(written + 1).padStart(3, '0')}`
          : `map-${size}-${String(written + 1).padStart(3, '0')}`
        const relativePath = `${size}/${id}.map`
        fs.writeFileSync(path.join(options.out, relativePath), `${JSON.stringify({ ...map, id })}\n`)
        manifest.maps.push({ id, size, environment: environmentId, path: relativePath, seed, spawns: map.spawns.length })
        written++
      }
      console.log(`Generated ${written} map(s): ${size} (${environmentId})`)
    }
  }
  fs.mkdirSync(options.out, { recursive: true })
  fs.writeFileSync(path.join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Manifest: ${path.relative(ROOT, path.join(options.out, 'manifest.json'))}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
