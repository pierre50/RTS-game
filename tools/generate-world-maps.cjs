#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const {
  BLUEPRINT_MAP_SIZE,
  DEFAULT_ENVIRONMENT_ID,
  ENVIRONMENT_IDS,
  blueprint,
  randomFrom,
} = require('./generate-maps.cjs')

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT = path.join(ROOT, 'public', 'maps', 'worlds')
const DEFAULT_MACRO_SCRIPT = path.join(ROOT, 'tools', 'generate-macro-world.py')

const BIOME_ENVIRONMENTS = {
  temperate: 'Temperate',
  blackforest: 'BlackForest',
  jungle: 'Jungle',
  desert: 'Desert',
}

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm world:generate -- --seed 12345

  Generates one ${BLUEPRINT_MAP_SIZE}x${BLUEPRINT_MAP_SIZE} map blueprint per macro-world region.

  --seed <n>              reproducible world seed (default: current time)
  --out <directory>       output root (default: public/maps/worlds)
  --biomes <a,b,c>        macro biome sectors (default: blackforest,jungle,desert,temperate)
  --no-preview-labels     hide region coordinates on the macro preview`)
}

function argumentsFrom(argv) {
  const options = {
    seed: Date.now(),
    out: DEFAULT_OUTPUT,
    biomes: 'blackforest,jungle,desert,temperate',
    labels: true,
  }
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index]
    if (key === '--') continue
    if (key === '--help') return { help: true }
    if (key === '--no-preview-labels') {
      options.labels = false
      continue
    }
    const value = argv[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--seed') options.seed = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else if (key === '--biomes') options.biomes = value
    else throw new Error(`Unknown option: ${key}`)
  }
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  const unknownBiomes = options.biomes
    .split(',')
    .map(biome => biome.trim())
    .filter(Boolean)
    .filter(biome => !BIOME_ENVIRONMENTS[biome])
  if (unknownBiomes.length) throw new Error(`Unsupported biome(s): ${unknownBiomes.join(', ')}`)
  return options
}

function slug(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function regionId(region) {
  return `r${region.x}-${region.y}`
}

function environmentForRegion(region) {
  return BIOME_ENVIRONMENTS[region.dominantBiome] ?? DEFAULT_ENVIRONMENT_ID
}

function createMacroPlan({ seed, out, biomes, labels }) {
  const worldDirectory = path.join(out, `world-${seed}`)
  const previewPath = path.join(worldDirectory, 'macro-world-preview.png')
  const planPath = path.join(worldDirectory, 'macro-world-regions.json')
  fs.mkdirSync(worldDirectory, { recursive: true })

  const args = [
    DEFAULT_MACRO_SCRIPT,
    '--seed',
    String(seed),
    '--out',
    previewPath,
    '--json-out',
    planPath,
    '--biomes',
    biomes,
  ]
  if (!labels) args.push('--no-labels')
  const result = spawnSync('python3', args, { cwd: ROOT, encoding: 'utf8' })
  if (result.status !== 0) {
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
    throw new Error(output || 'Macro-world generation failed')
  }

  return { worldDirectory, previewPath, planPath, plan: JSON.parse(fs.readFileSync(planPath, 'utf8')) }
}

async function generateRegionMap(region, worldSeed, mapsDirectory) {
  const environment = environmentForRegion(region)
  const random = randomFrom(`${worldSeed}:${region.x}:${region.y}:${environment}`)
  for (let attempt = 1; attempt <= 30; attempt++) {
    const seed = Math.floor(random() * 0x7fffffff)
    const map = await blueprint(BLUEPRINT_MAP_SIZE, seed, environment)
    if (!map) continue
    const id = `world-${worldSeed}-${regionId(region)}-${slug(environment)}`
    const relativePath = `${BLUEPRINT_MAP_SIZE}/${id}.map`
    fs.writeFileSync(path.join(mapsDirectory, relativePath), `${JSON.stringify({ ...map, id, macroRegion: region })}\n`)
    return {
      id,
      size: BLUEPRINT_MAP_SIZE,
      environment,
      dominantBiome: region.dominantBiome,
      biomeWeights: region.biomeWeights,
      waterRatio: region.waterRatio,
      region: { x: region.x, y: region.y },
      path: relativePath,
      seed,
      spawns: map.spawns.length,
    }
  }
  throw new Error(`Could not generate a valid map for region ${regionId(region)} (${environment})`)
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

  const { worldDirectory, previewPath, planPath, plan } = createMacroPlan(options)
  const mapsDirectory = path.join(worldDirectory, 'maps')
  fs.rmSync(mapsDirectory, { recursive: true, force: true })
  fs.mkdirSync(path.join(mapsDirectory, String(BLUEPRINT_MAP_SIZE)), { recursive: true })

  const manifest = {
    format: 'macro-world-map-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    worldSeed: options.seed,
    regionMapSize: plan.regionMapSize,
    regionsWide: plan.regionsWide,
    regionsHigh: plan.regionsHigh,
    biomeSectors: plan.biomeSectors,
    macroPreviewPath: path.relative(worldDirectory, previewPath),
    macroRegionsPath: path.relative(worldDirectory, planPath),
    maps: [],
  }

  for (const region of plan.regions) {
    const entry = await generateRegionMap(region, options.seed, mapsDirectory)
    manifest.maps.push(entry)
    console.log(`Generated ${entry.id}: ${entry.environment}`)
  }

  const manifestPath = path.join(worldDirectory, 'manifest.json')
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`World manifest: ${path.relative(ROOT, manifestPath)}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
