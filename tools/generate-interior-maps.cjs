#!/usr/bin/env node

/* Generates small interior map blueprints. These use the same compact terrain /
 * relief encoding as world maps, but keep their own manifest because interiors
 * are selected by building type instead of world size/environment. */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const OUTPUT = path.join(ROOT, 'public', 'maps', 'interiors')
const TERRAIN = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']
const TERRAIN_INDEX = new Map(TERRAIN.map((type, index) => [type, index]))
const DIRT = TERRAIN_INDEX.get('Dirt')
const WATER = TERRAIN_INDEX.get('Water')

const INTERIOR_TYPES = {
  house: {
    directory: 'house',
    idPrefix: 'house-circle',
    interiorType: 'House',
    minSize: 13,
    size: 13,
  },
  'town-center': {
    directory: 'town-center',
    idPrefix: 'town-center-circle',
    interiorType: 'TownCenter',
    minSize: 15,
    size: 15,
  },
}

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm interiors:generate -- --type all --count 1

  --type <name>          all, town-center, house (default: all)
  --count <n>            interior variants to generate (default: 1)
  --seed <n>             reproducible batch seed (default: current time)
  --size <n>             override blueprint size for a single type
  --out <directory>      output directory (default: public/maps/interiors)`)
}

function argumentsFrom(argv) {
  const options = {
    count: 1,
    out: OUTPUT,
    seed: Date.now(),
    size: null,
    type: 'all',
  }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--') continue
    if (key === '--help') return { help: true }
    const value = argv[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--count') options.count = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else if (key === '--seed') options.seed = Number(value)
    else if (key === '--size') options.size = Number(value)
    else if (key === '--type') options.type = value
    else throw new Error(`Unknown option: ${key}`)
  }
  if (options.type !== 'all' && !INTERIOR_TYPES[options.type]) throw new Error('Unsupported --type')
  if (options.type === 'all' && options.size != null) throw new Error('--size can only be used with one --type')
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be positive')
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  if (options.size != null && (!Number.isInteger(options.size) || options.size < INTERIOR_TYPES[options.type].minSize)) {
    throw new Error(`--size must be an integer >= ${INTERIOR_TYPES[options.type].minSize}`)
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

function encode(array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength).toString('base64')
}

function buildingInterior({ id, interiorType, seed, size }) {
  const width = size + 1
  const center = size / 2
  const radius = Math.max(4, Math.floor(width * 0.31))
  const terrain = new Uint8Array(width * width).fill(WATER)
  const relief = new Int8Array(width * width)
  const floorMask = new Uint8Array(width * width)
  const borderMask = new Uint8Array(width * width)

  const indexOf = (i, j) => i * width + j

  for (let i = 0; i <= size; i++) {
    for (let j = 0; j <= size; j++) {
      const distance = Math.hypot(i - center, j - center)
      if (distance <= radius) {
        floorMask[indexOf(i, j)] = 1
        terrain[indexOf(i, j)] = DIRT
      }
    }
  }

  for (let i = 0; i <= size; i++) {
    for (let j = 0; j <= size; j++) {
      const index = indexOf(i, j)
      if (!floorMask[index]) continue
      let touchesOutside = false
      for (let di = -1; di <= 1 && !touchesOutside; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (di === 0 && dj === 0) continue
          const ni = i + di
          const nj = j + dj
          if (ni < 0 || nj < 0 || ni > size || nj > size || !floorMask[indexOf(ni, nj)]) {
            touchesOutside = true
            break
          }
        }
      }
      if (!touchesOutside) continue
      borderMask[index] = 1
    }
  }

  const exit = {
    id: 'main',
    i: Math.round(center),
    j: Math.min(size - 1, Math.round(center + radius * 0.76)),
    direction: 'south',
  }
  const spawn = { i: exit.i, j: exit.j }

  return {
    format: 'map-blueprint',
    version: 1,
    id,
    kind: 'interior',
    interiorType,
    size,
    seed,
    encoding: 'base64',
    cellCount: terrain.length,
    terrain: encode(terrain),
    relief: encode(relief),
    floorMask: encode(floorMask),
    borderMask: encode(borderMask),
    floorShape: {
      type: 'circle',
      center: { i: center, j: center },
      radius,
    },
    spawns: [spawn],
    exits: [exit],
    resources: [],
  }
}

async function main() {
  let options
  try {
    options = argumentsFrom(process.argv.slice(2))
  } catch (error) {
    usage(error.message)
    process.exitCode = 1
    return
  }
  if (options.help) return usage()

  const random = randomFrom(options.seed)
  const selectedTypes = options.type === 'all' ? ['town-center', 'house'] : [options.type]
  const manifest = {
    format: 'interior-map-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    batchSeed: options.seed,
    interiors: [],
  }

  for (const type of selectedTypes) {
    const profile = INTERIOR_TYPES[type]
    const size = options.size ?? profile.size
    const directory = path.join(options.out, profile.directory)
    fs.mkdirSync(directory, { recursive: true })
    for (let index = 0; index < options.count; index++) {
      const seed = Math.floor(random() * 0x7fffffff)
      const id = `${profile.idPrefix}-${String(index + 1).padStart(3, '0')}`
      const map = buildingInterior({ id, interiorType: profile.interiorType, seed, size })
      const relativePath = `${profile.directory}/${id}.map`
      fs.writeFileSync(path.join(options.out, relativePath), `${JSON.stringify(map)}\n`)
      manifest.interiors.push({
        id,
        interiorType: map.interiorType,
        kind: map.kind,
        path: relativePath,
        seed,
        size: map.size,
        spawns: map.spawns.length,
        exits: map.exits.length,
      })
    }
  }

  fs.mkdirSync(options.out, { recursive: true })
  fs.writeFileSync(path.join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Generated ${options.count * selectedTypes.length} interior map(s): ${selectedTypes.join(', ')}`)
  console.log(`Manifest: ${path.relative(ROOT, path.join(options.out, 'manifest.json'))}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
