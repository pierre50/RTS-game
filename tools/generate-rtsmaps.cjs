#!/usr/bin/env node

/* Builds map blueprints with the exact terrain and relief algorithms used by
 * MapGeneration, MapTerrain and MapResources. This script deliberately reads those methods
 * from their source files, so there is no second generator to maintain. */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'public', 'maps')
const TERRAIN = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest']

function mapSettingsFromRuntimeConfig() {
  const sizesSource = fs.readFileSync(path.join(ROOT, 'app/config/mapSizes.js'), 'utf8')
  const typesSource = fs.readFileSync(path.join(ROOT, 'app/config/mapTypes.js'), 'utf8')
  const sizes = [...sizesSource.matchAll(/value:\s*(\d+),\s*maxPlayers:\s*(\d+)(?:,\s*editorOnly:\s*true)?/g)]
    .map(([, size, maxPlayers]) => ({ size: Number(size), maxPlayers: Number(maxPlayers) }))
    .filter(({ size }) => size !== 16)
  const types = [...typesSource.matchAll(/value:\s*'([^']+)'/g)].map(([, type]) => type)
  if (!sizes.length || !types.length) throw new Error('Could not read map settings from app/config')
  return { sizes, types }
}

const MAP_SETTINGS = mapSettingsFromRuntimeConfig()
const TYPES = new Set(MAP_SETTINGS.types)
const SIZES = new Set(MAP_SETTINGS.sizes.map(({ size }) => size))
const maxPlayersForSize = size => MAP_SETTINGS.sizes.find(entry => entry.size === size)?.maxPlayers

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm maps:generate -- --size 256 --type plain --count 100

  --size <n[,n]>        144, 256, 512 (default: 256)
  --type <name[,name]>  plain, continent, lac, ilot (default: all)
  --count <n>           maps per size/type (default: 10)
  --seed <n>            reproducible batch seed (default: current time)
  --out <directory>     output directory (default: public/maps)`)
}

function argumentsFrom(argv) {
  const options = { sizes: [256], types: [...TYPES], count: 10, seed: Date.now(), out: OUTPUT }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--') continue
    if (key === '--help') return { help: true }
    const value = argv[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--size') options.sizes = value.split(',').map(Number)
    else if (key === '--type') options.types = value.split(',')
    else if (key === '--count') options.count = Number(value)
    else if (key === '--seed') options.seed = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else throw new Error(`Unknown option: ${key}`)
  }
  if (!options.sizes.every(size => SIZES.has(size))) throw new Error('Unsupported --size')
  if (!options.types.every(type => TYPES.has(type))) throw new Error('Unsupported --type')
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be positive')
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
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
  const originalExtension = require.extensions['.js']
  const isMapRuntime = filename =>
    filename.endsWith('/MapGeneration.js') || filename.endsWith('/MapTerrain.js') || filename.endsWith('/MapResources.js')
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
    BIOME_TREE_CHANCE: {
      DarkForest: 0.92,
      Jungle: 0.92,
      Grass: 0,
      Desert: 0,
    },
    BIOME_TREE_PLAYER_SAFE_DIST: 22,
  }
  Module._load = function (request, parent, isMain) {
    if (parent && isMapRuntime(parent.filename)) {
      if (request === 'pixi.js') return pixi
      if (request === '../resource') return { Resource: HeadlessResource }
      if (request === '../../lib') return { getCellsAroundPoint, getZoneInGridWithCondition }
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
  require.extensions['.js'] = (module, filename) => {
    if (isMapRuntime(filename)) {
      const code = babel.transformFileSync(filename, { presets: [['@babel/preset-env', { targets: { node: 'current' } }]] }).code
      module._compile(code, filename)
      return
    }
    originalExtension(module, filename)
  }
  try {
    const { MapGeneration } = require(path.join(ROOT, 'app/classes/map/MapGeneration.js'))
    const { MapTerrain } = require(path.join(ROOT, 'app/classes/map/MapTerrain.js'))
    const { MapResources } = require(path.join(ROOT, 'app/classes/map/MapResources.js'))
    return { MapGeneration, MapTerrain, MapResources }
  } finally {
    Module._load = originalLoad
    require.extensions['.js'] = originalExtension
  }
}

const { MapGeneration, MapTerrain, MapResources } = loadRuntimeGenerators()
const runtimeTerrain = MapGeneration.prototype.generateTerrain
const runtimeRelief = MapTerrain.prototype.generateMapRelief
const runtimeClampReliefAroundWaterLevels = MapTerrain.prototype.clampReliefAroundWaterLevels
const runtimeEnforceReliefStepContinuity = MapTerrain.prototype.enforceReliefStepContinuity
const runtimeSpawns = MapGeneration.prototype.findPlayerPlaces
const runtimeIlotAnchors = MapGeneration.prototype.getIlotSpawnAnchors
const runtimePlayerResources = MapResources.prototype.generateResourcesAroundPlayers
const runtimeNeutralResources = MapResources.prototype.generateNeutralResourceGroups
const runtimeBiomeTrees = MapResources.prototype.generateBiomeTrees
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

function buildHeadlessMap(terrain, size, seed, playersPos, mapType = 'plain', positionsCount = playersPos.length) {
  const map = {
    size,
    seed,
    playersPos,
    mapType,
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
      map.grid[i][j] = { i, j, type, category: type === 'Water' ? 'Water' : 'Land', z: 0, y: 0, has: null, waterBorder: false, border: false, solid: false, inclined: false }
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
      for (let i = Math.max(0, pos.i - 4); i <= Math.min(size, pos.i + 4); i++) {
        for (let j = Math.max(0, pos.j - 4); j <= Math.min(size, pos.j + 4); j++) {
          if (map.grid[i][j].category !== 'Water') map.grid[i][j].z = 0
        }
      }
    }
  }
  map.clampReliefAroundWaterLevels = () => runtimeClampReliefAroundWaterLevels.call({ map })
  map.enforceReliefStepContinuity = (...args) => runtimeEnforceReliefStepContinuity.apply({ map }, args)
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

function blueprint(size, mapType, seed) {
  const playerCount = maxPlayersForSize(size)
  const context = { map: { seed, positionsCount: playerCount } }
  const terrain = runtimeTerrain.call(context, size + 1, mapType, seed)
  const spawnMap = buildHeadlessMap(terrain, size, seed, [], mapType, playerCount)
  const spawns = runtimeSpawns.call({ map: spawnMap, getIlotSpawnAnchors: () => runtimeIlotAnchors.call({ map: spawnMap }) })
  if (spawns.length !== playerCount) return null
  const map = buildHeadlessMap(terrain, size, seed, spawns, mapType, playerCount)
  runtimeRelief.call({ map })
  const waterLevelBounds = map.clampReliefAroundWaterLevels()
  const unrestrictedReliefDistances = new Int16Array((map.size + 1) ** 2).fill(map.size + 4)
  map.enforceReliefStepContinuity(unrestrictedReliefDistances, new Set(), waterLevelBounds)
  runtimePlayerResources.call({ map }, spawns)
  runtimeNeutralResources.call({ map }, spawns)
  runtimeBiomeTrees.call({ map }, spawns)
  const flatTerrain = Uint8Array.from(terrain.flat())
  const relief = Int8Array.from(map.grid.flat().map(cell => cell.z))
  const resources = [...map.resources].map(resource => ({
    type: resource.type,
    i: resource.i,
    j: resource.j,
  }))
  return {
    format: 'rts-map-blueprint',
    version: 1,
    size,
    mapType,
    seed,
    encoding: 'base64',
    cellCount: flatTerrain.length,
    terrain: encode(flatTerrain),
    relief: encode(relief),
    spawns,
    resources,
  }
}

function main() {
  let options
  try { options = argumentsFrom(process.argv.slice(2)) } catch (error) { usage(error.message); process.exitCode = 1; return }
  if (options.help) return usage()
  const random = randomFrom(options.seed)
  const manifest = { format: 'rts-map-manifest', version: 1, generatedAt: new Date().toISOString(), batchSeed: options.seed, maps: [] }
  for (const size of options.sizes) for (const mapType of options.types) {
    const directory = path.join(options.out, String(size), mapType)
    fs.mkdirSync(directory, { recursive: true })
    let written = 0, attempts = 0
    while (written < options.count) {
      if (++attempts > options.count * 30) throw new Error(`Could not find enough valid ${size}/${mapType} maps`)
      const seed = Math.floor(random() * 0x7fffffff), map = blueprint(size, mapType, seed)
      if (!map) continue
      const id = `${mapType}-${size}-${String(written + 1).padStart(3, '0')}`, relativePath = `${size}/${mapType}/${id}.rtsmap`
      fs.writeFileSync(path.join(options.out, relativePath), `${JSON.stringify({ ...map, id })}\n`)
      manifest.maps.push({ id, size, mapType, path: relativePath, seed, spawns: map.spawns.length })
      written++
    }
    console.log(`Generated ${written} map(s): ${size}/${mapType}`)
  }
  fs.mkdirSync(options.out, { recursive: true })
  fs.writeFileSync(path.join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Manifest: ${path.relative(ROOT, path.join(options.out, 'manifest.json'))}`)
}

main()
