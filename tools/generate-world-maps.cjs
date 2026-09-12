#!/usr/bin/env node
const { syncWorldSettlementManifest } = require('./caves/settlements.cjs')

const { writeScenery } = require('./maps/scenery.cjs')
const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const { BLUEPRINT_MAP_SIZE, DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS } = require('./maps/config.cjs')
const { blueprint } = require('./maps/blueprint.cjs')
const { randomFrom } = require('./maps/noise.cjs')

// Resource placement yields between batches in the browser.
if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = callback => setImmediate(() => callback(0))
}

const ROOT = path.resolve(__dirname, '..')
const DEFAULT_OUTPUT = path.join(ROOT, 'public', 'maps', 'worlds')
const DEFAULT_MACRO_SCRIPT = path.join(ROOT, 'tools', 'generate-macro-world.py')
const DEFAULT_CIVILIZATIONS_CONFIG = path.join(ROOT, 'app', 'config', 'civilizations.ts')
const DEFAULT_BIOMES = 'blackforest,desert,temperate,steppe'
const DEFAULT_LAND_MASK = path.join(ROOT, 'public', 'maps', 'world-masks', 'continent-001.png')

const BIOME_ENVIRONMENTS = {
  temperate: 'Temperate',
  blackforest: 'BlackForest',
  jungle: 'Jungle',
  desert: 'Desert',
  step: 'Steppe',
  steppe: 'Steppe',
}

const BIOME_ALIASES = {
  step: 'steppe',
}

function configuredCivilizations() {
  if (!fs.existsSync(DEFAULT_CIVILIZATIONS_CONFIG)) return []
  const source = fs.readFileSync(DEFAULT_CIVILIZATIONS_CONFIG, 'utf8')
  return [...source.matchAll(/value:\s*['"]([^'"]+)['"]/g)].map(match => match[1])
}

function resolvedCivilizations(value) {
  const civilizations = String(value || '')
    .split(',')
    .map(civilization => civilization.trim())
    .filter(Boolean)
  if (civilizations.length === 1 && civilizations[0].toLowerCase() === 'all') return configuredCivilizations()
  return civilizations
}

function usage(error = '') {
  if (error) console.error(`Error: ${error}\n`)
  console.log(`Usage: pnpm world:generate -- --seed 12345

  Generates one ${BLUEPRINT_MAP_SIZE}x${BLUEPRINT_MAP_SIZE} map blueprint per macro-world region.

  --seed <n>              reproducible world seed (default: current time)
  --out <directory>       output root (default: public/maps/worlds)
  --land-mask <path>      black/white source mask for land and water (default: public/maps/world-masks/continent-001.png)
  --no-land-mask          use procedural continent generation instead
  --biomes <a,b,c>        macro biome sectors (default: ${DEFAULT_BIOMES})
  --players <n>           civilization starting villages to plan (default: civilization count, or 0)
  --civilizations <a,b,c> civilization names for planned starting villages, or "all"
  --bandit-camps <n>      bandit camps to plan (default: 8)
  --settlement-disparity <n> settlement spread variance, 0.0 to 0.85 (default: 0.35)
  --no-preview-labels     hide region coordinates on the macro preview`)
}

function argumentsFrom(argv) {
  const options = {
    seed: Date.now(),
    out: DEFAULT_OUTPUT,
    landMask: DEFAULT_LAND_MASK,
    useLandMask: true,
    biomes: DEFAULT_BIOMES,
    players: 0,
    civilizations: '',
    banditCamps: 8,
    settlementDisparity: 0.35,
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
    if (key === '--no-land-mask') {
      options.useLandMask = false
      continue
    }
    const value = argv[++index]
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--seed') options.seed = Number(value)
    else if (key === '--out') options.out = path.resolve(ROOT, value)
    else if (key === '--land-mask') options.landMask = path.resolve(ROOT, value)
    else if (key === '--biomes') options.biomes = value
    else if (key === '--players') options.players = Number(value)
    else if (key === '--civilizations') options.civilizations = value
    else if (key === '--bandit-camps') options.banditCamps = Number(value)
    else if (key === '--settlement-disparity') options.settlementDisparity = Number(value)
    else throw new Error(`Unknown option: ${key}`)
  }
  if (!Number.isFinite(options.seed)) throw new Error('--seed must be numeric')
  if (!Number.isInteger(options.players) || options.players < 0)
    throw new Error('--players must be a positive integer or zero')
  if (!Number.isInteger(options.banditCamps) || options.banditCamps < 0) {
    throw new Error('--bandit-camps must be a positive integer or zero')
  }
  if (!Number.isFinite(options.settlementDisparity)) throw new Error('--settlement-disparity must be numeric')
  options.resolvedCivilizations = resolvedCivilizations(options.civilizations)
  if (!options.players && options.resolvedCivilizations.length) options.players = options.resolvedCivilizations.length
  if (options.resolvedCivilizations.length) options.civilizations = options.resolvedCivilizations.join(',')
  options.biomes = options.biomes
    .split(',')
    .map(biome => BIOME_ALIASES[biome.trim()] || biome.trim())
    .filter(Boolean)
    .join(',')
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

function createMacroPlan({
  seed,
  out,
  landMask,
  useLandMask,
  biomes,
  labels,
  players,
  civilizations,
  banditCamps,
  settlementDisparity,
}) {
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
    ...(useLandMask ? ['--land-mask', landMask] : ['--no-land-mask']),
    '--biomes',
    biomes,
    '--players',
    String(players),
    '--bandit-camps',
    String(banditCamps),
    '--settlement-disparity',
    String(settlementDisparity),
  ]
  if (civilizations) args.push('--civilizations', civilizations)
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
  const settlements = Array.isArray(region.settlements) ? region.settlements : []
  const spawns = settlements
    .filter(settlement => settlement.kind === 'village' || settlement.kind === 'city')
    .map(settlement => settlement.local)
  const banditCampPositions = settlements
    .filter(settlement => settlement.kind === 'banditCamp')
    .map(settlement => settlement.local)
  const random = randomFrom(`${worldSeed}:${region.x}:${region.y}:${environment}`)
  for (let attempt = 1; attempt <= 30; attempt++) {
    const seed = Math.floor(random() * 0x7fffffff)
    const map = await blueprint(BLUEPRINT_MAP_SIZE, seed, environment, {
      spawns,
      banditCampPositions,
      macroTerrainRows: region.terrainRows,
      settlements,
    })
    if (!map) continue
    const id = `world-${worldSeed}-${regionId(region)}-${slug(environment)}`
    const relativePath = `${id}.map`
    fs.writeFileSync(path.join(mapsDirectory, relativePath), `${JSON.stringify({ ...map, id, macroRegion: region })}\n`)
    writeScenery({ ...map, id }, path.join(mapsDirectory, relativePath.replace(/\.map$/, '.scenery.json')))
    return {
      id,
      sceneryPath: relativePath.replace(/\.map$/, '.scenery.json'),
      size: BLUEPRINT_MAP_SIZE,
      environment,
      dominantBiome: region.dominantBiome,
      biomeWeights: region.biomeWeights,
      settlements: map.settlements ?? settlements,
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
  fs.mkdirSync(mapsDirectory, { recursive: true })

  const manifest = {
    format: 'macro-world-map-manifest',
    version: 1,
    generatedAt: new Date().toISOString(),
    worldSeed: options.seed,
    regionMapSize: plan.regionMapSize,
    regionsWide: plan.regionsWide,
    regionsHigh: plan.regionsHigh,
    biomeSectors: plan.biomeSectors,
    settlements: plan.settlements || [],
    macroPreviewPath: path.relative(worldDirectory, previewPath),
    macroRegionsPath: path.relative(worldDirectory, planPath),
    maps: [],
  }

  for (const region of plan.regions) {
    region.settlements = (plan.settlements || []).filter(
      settlement => settlement.region?.x === region.x && settlement.region?.y === region.y
    )
    const entry = await generateRegionMap(region, options.seed, mapsDirectory)
    manifest.maps.push(entry)
    console.log(`Generated ${entry.id}: ${entry.environment}`)
  }

  syncWorldSettlementManifest(manifest)
  const manifestPath = path.join(worldDirectory, 'manifest.json')
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`World manifest: ${path.relative(ROOT, manifestPath)}`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
