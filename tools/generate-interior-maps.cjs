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

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm interiors:generate -- --type town-center --count 1

  --type <name>          town-center (default: town-center)
  --count <n>            interior variants to generate (default: 1)
  --seed <n>             reproducible batch seed (default: current time)
  --size <n>             blueprint size; cell count is (size + 1)^2 (default: 15)
  --out <directory>      output directory (default: public/maps/interiors)`)
}

function argumentsFrom(argv) {
  const options = {
    count: 1,
    out: OUTPUT,
    seed: Date.now(),
    size: 15,
    type: 'town-center',
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
  if (options.type !== 'town-center') throw new Error('Unsupported --type')
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be positive')
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  if (!Number.isInteger(options.size) || options.size < 15) throw new Error('--size must be an integer >= 15')
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

function townCenterInterior({ id, seed, size }) {
  const width = size + 1
  const center = size / 2
  const radiusI = Math.max(5, Math.floor(width * 0.36))
  const radiusJ = Math.max(4, Math.floor(width * 0.25))
  const terrain = new Uint8Array(width * width).fill(DIRT)
  const relief = new Int8Array(width * width)
  const floorMask = new Uint8Array(width * width)

  for (let i = 0; i <= size; i++) {
    for (let j = 0; j <= size; j++) {
      const ovalDistance = (i - center) ** 2 / radiusI ** 2 + (j - center) ** 2 / radiusJ ** 2
      floorMask[i * width + j] = ovalDistance <= 1 ? 1 : 0
    }
  }

  const spawn = { i: Math.round(center), j: Math.min(size - 2, Math.round(center + radiusJ * 0.62)) }
  const exit = {
    id: 'main',
    i: Math.round(center),
    j: Math.min(size - 1, Math.round(center + radiusJ * 0.92)),
    direction: 'south',
  }

  return {
    format: 'map-blueprint',
    version: 1,
    id,
    kind: 'interior',
    interiorType: 'TownCenter',
    size,
    seed,
    encoding: 'base64',
    cellCount: terrain.length,
    terrain: encode(terrain),
    relief: encode(relief),
    floorMask: encode(floorMask),
    floorShape: {
      type: 'oval',
      center: { i: center, j: center },
      radius: { i: radiusI, j: radiusJ },
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
  const manifest = {
    format: 'interior-map-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    batchSeed: options.seed,
    interiors: [],
  }

  const directory = path.join(options.out, options.type)
  fs.mkdirSync(directory, { recursive: true })
  for (let index = 0; index < options.count; index++) {
    const seed = Math.floor(random() * 0x7fffffff)
    const id = `${options.type}-oval-${String(index + 1).padStart(3, '0')}`
    const map = townCenterInterior({ id, seed, size: options.size })
    const relativePath = `${options.type}/${id}.map`
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

  fs.mkdirSync(options.out, { recursive: true })
  fs.writeFileSync(path.join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Generated ${options.count} interior map(s): ${options.type}`)
  console.log(`Manifest: ${path.relative(ROOT, path.join(options.out, 'manifest.json'))}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
