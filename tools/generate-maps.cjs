#!/usr/bin/env node
const path = require('node:path')
const fs = require('node:fs')
const {
  BLUEPRINT_MAP_SIZE,
  ENVIRONMENT_IDS,
  DEFAULT_ENVIRONMENT_ID,
  OUTPUT,
  ROOT,
  ENVIRONMENT_TERRAIN_PARAMS,
} = require('./maps/config.cjs')
const { randomFrom } = require('./maps/noise.cjs')
const { blueprint } = require('./maps/blueprint.cjs')

// The resource generators yield with requestAnimationFrame between batches so the
// browser stays responsive; Node has no such API, so give them an event-loop tick instead.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = callback => setImmediate(() => callback(0))
}

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm maps:generate -- --count 100

  Blueprints use the standard ${BLUEPRINT_MAP_SIZE}x${BLUEPRINT_MAP_SIZE} world-region size.

  --count <n>             maps per environment (default: 10)
  --seed <n>              reproducible batch seed (default: current time)
  --out <directory>       output directory (default: public/maps)
  --environment <e[,e]>   ${ENVIRONMENT_IDS.join(', ')} (default: ${DEFAULT_ENVIRONMENT_ID} only, untagged filenames)`)
}

function argumentsFrom(argv) {
  const options = {
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
    if (key === '--size')
      throw new Error(`--size was removed; map blueprints use the standard ${BLUEPRINT_MAP_SIZE} size`)
    else if (key === '--count') options.count = Number(value)
    else if (key === '--seed') options.seed = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else if (key === '--environment') {
      options.environments = value.split(',')
      options.explicitEnvironment = true
    } else throw new Error(`Unknown option: ${key}`)
  }
  if (!Number.isInteger(options.count) || options.count < 1) throw new Error('--count must be positive')
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  if (!options.environments.every(env => Object.hasOwn(ENVIRONMENT_TERRAIN_PARAMS, env))) {
    throw new Error(`Unsupported --environment (expected one of: ${ENVIRONMENT_IDS.join(', ')})`)
  }
  return options
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
    format: 'map-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    batchSeed: options.seed,
    maps: [],
  }
  const size = BLUEPRINT_MAP_SIZE
  const directory = path.join(options.out, String(size))
  fs.mkdirSync(directory, { recursive: true })
  for (const environmentId of options.environments) {
    const envSlug = environmentId.toLowerCase()
    let written = 0,
      attempts = 0
    while (written < options.count) {
      if (++attempts > options.count * 30) throw new Error(`Could not find enough valid ${size} ${environmentId} maps`)
      const seed = Math.floor(random() * 0x7fffffff),
        map = await blueprint(size, seed, environmentId)
      if (!map) continue
      const id = options.explicitEnvironment
        ? `map-${size}-${envSlug}-${String(written + 1).padStart(3, '0')}`
        : `map-${size}-${String(written + 1).padStart(3, '0')}`
      const relativePath = `${size}/${id}.map`
      fs.writeFileSync(path.join(options.out, relativePath), `${JSON.stringify({ ...map, id })}\n`)
      manifest.maps.push({
        id,
        size,
        environment: environmentId,
        path: relativePath,
        seed,
        spawns: map.spawns.length,
      })
      written++
    }
    console.log(`Generated ${written} map(s): ${size} (${environmentId})`)
  }
  fs.mkdirSync(options.out, { recursive: true })
  fs.writeFileSync(path.join(options.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Manifest: ${path.relative(ROOT, path.join(options.out, 'manifest.json'))}`)
}

if (require.main === module) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}

module.exports = {
  BLUEPRINT_MAP_SIZE,
  DEFAULT_ENVIRONMENT_ID,
  ENVIRONMENT_IDS,
  blueprint,
  randomFrom,
}
