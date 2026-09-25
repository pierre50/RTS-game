const { sourcePosition } = require('../caves/settlements.cjs')
const { planContinentCamps, SMALL_CAMP_LAND_CELLS, LAIR_FRACTION } = require('../caves/continent-camps.cjs')
// Single-region continent. Run: node tools/maps/generate-large-test.cjs [--size 5000] [--out directory]
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { createLocalMapLayout, localToGrid } = loadGenerationTs('app/lib/localMapLayout.ts')
const { CONTINENT_WORLD_SEED } = loadGenerationTs('app/config/continentWorlds.ts')
const { planContinentVillageSlots } = require('./continent-villages.cjs')
const { encodePreparedTerrain } = loadGenerationTs('app/serialization/PreparedTerrainCodec.ts')
const { generateLargeContent } = require('./large-content.cjs')
const { normalizeLargeCoast } = require('./large-coast.cjs')
const { planContinentCaves, CAVE_LAND_CELLS } = require('../caves/continent-placement.cjs')
const { MACRO_TERRAIN_CODE_TO_TYPE, TERRAIN_INDEX } = require('./config.cjs')
globalThis.requestAnimationFrame ??= callback => setImmediate(() => callback(0))
const root = path.resolve(__dirname, '../..')

async function main() {
  let testEdge = 5000,
    cellsPerCave = CAVE_LAND_CELLS,
    cellsPerCamp = SMALL_CAMP_LAND_CELLS,
    lairFraction = LAIR_FRACTION,
    requestedOutput,
    requestedSeed,
    biomes = 'blackforest,desert,temperate,steppe',
    landMask = path.join(root, 'public/maps/world-masks/continent-001.png')
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index],
      value = process.argv[index + 1]
    if (key === '--size') testEdge = Number(value)
    else if (key === '--camp-land-cells') cellsPerCamp = Number(value)
    else if (key === '--lair-fraction') lairFraction = Number(value)
    else if (key === '--cave-land-cells') cellsPerCave = Number(value)
    else if (key === '--seed') requestedSeed = Number(value)
    else if (key === '--biomes' && value) biomes = value
    else if (key === '--land-mask' && value) landMask = path.resolve(value)
    else if (key === '--out' && value) requestedOutput = path.resolve(value)
    else throw new Error(`Unknown or incomplete option: ${key}`)
  }
  if (!Number.isInteger(testEdge) || testEdge < 512 || testEdge > 5000)
    throw new Error('Size must be between 512 and 5000')
  if (!Number.isSafeInteger(cellsPerCamp) || cellsPerCamp < 1)
    throw new Error('Camp density must be a positive integer')
  if (!Number.isFinite(lairFraction) || lairFraction < 0 || lairFraction > 1)
    throw new Error('Lair fraction must be between 0 and 1')
  const seed = requestedSeed ?? CONTINENT_WORLD_SEED
  if (!Number.isSafeInteger(cellsPerCave) || cellsPerCave < 1)
    throw new Error('Cave density must be a positive integer')
  if (!Number.isSafeInteger(seed)) throw new Error('Seed must be an integer')
  const worldId = `world-test-${testEdge}`,
    sourceSize = testEdge - 1
  const layout = createLocalMapLayout(sourceSize)
  const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2),
    stride = size + 1
  const output = requestedOutput ?? path.join(root, 'public/maps/worlds', worldId)
  fs.mkdirSync(path.join(output, 'maps'), { recursive: true })
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'rts-continent-'))
  try {
    const maskPath = path.join(temporary, 'mask.bin')
    const result = spawnSync(
      'python3',
      [
        path.join(__dirname, 'large-mask.py'),
        landMask,
        String(layout.columns),
        String(layout.rows),
        maskPath,
        path.join(temporary, 'continent-preview.png'),
        String(seed),
        biomes,
      ],
      { encoding: 'utf8' }
    )
    if (result.status !== 0) throw new Error(result.stderr || 'Mask conversion failed')
    const mask = fs.readFileSync(maskPath)
    if (mask.length !== layout.columns * layout.rows) throw new Error('Invalid biome raster size')
    const biomeCodes = Buffer.alloc(stride * stride, 'W'.charCodeAt(0))
    const biomeCounts = {}
    const terrainForCode = new Map(
      Object.entries(MACRO_TERRAIN_CODE_TO_TYPE).map(([code, type]) => [code.charCodeAt(0), TERRAIN_INDEX.get(type)])
    )
    const terrain = Buffer.alloc(stride * stride, 255),
      relief = Buffer.alloc(stride * stride)
    let activeCells = 0,
      landCells = 0
    for (let row = 0; row < layout.rows; row++) {
      for (let column = 0; column < layout.columns; column++) {
        if (row % 2 === 1 && column === layout.columns - 1) continue
        const { i, j } = localToGrid(column, row, layout)
        const code = mask[row * layout.columns + column]
        const type = terrainForCode.get(code)
        if (type === undefined) throw new Error(`Invalid biome code: ${code}`)
        biomeCodes[i * stride + j] = code
        const name = String.fromCharCode(code)
        biomeCounts[name] = (biomeCounts[name] ?? 0) + 1
        terrain[i * stride + j] = type
        activeCells++
        if (type !== 2) landCells++
      }
    }
    const coastCleanup = normalizeLargeCoast(terrain, size, biomeCodes)
    landCells += coastCleanup.added
    for (const [code, count] of Object.entries(coastCleanup.addedByBiome))
      biomeCounts[code] = (biomeCounts[code] ?? 0) + count
    biomeCounts.W = (biomeCounts.W ?? 0) - coastCleanup.added
    console.log(`${worldId}: coast cleanup filled ${coastCleanup.added} cells in ${coastCleanup.passes} passes`)
    const region = { x: 0, y: 0 }
    const settlements = planContinentVillageSlots({ terrain, biomeCodes, size, seed,
      sourcePosition: point => sourcePosition(point, layout) })
    const id = `${worldId}-r0-0`
    const cavePlan = planContinentCaves({ terrain, size, seed, id, settlements, cellsPerCave })
    const camps = planContinentCamps({
      terrain,
      size,
      seed,
      id,
      settlements,
      caves: cavePlan.caves,
      cellsPerCamp,
      lairFraction,
    })
    console.log(
      `${worldId}: ${cavePlan.caves.length}/${cavePlan.target} caves; ${activeCells} cells, ${landCells} land; generating shared runtime resources`
    )
    const content = await generateLargeContent(
      terrain,
      size,
      settlements,
      seed,
      progress => console.log(JSON.stringify(progress)),
      biomeCodes,
      cavePlan.caves,
      camps
    )
    const campSettlements = camps.map(camp => ({
      id: camp.id,
      kind: 'banditCamp',
      region,
      local: { i: camp.i, j: camp.j },
      world: sourcePosition(camp, layout),
      strength: camp.unitTypes.length,
    }))
    const blueprint = {
      format: 'map-blueprint',
      version: 2,
      id,
      sourceSize,
      size,
      seed,
      mapType: 'world-region',
      environment: 'Temperate',
      encoding: 'base64',
      cellCount: terrain.length,
      localGridLayout: layout,
      terrain: terrain.toString('base64'),
      relief: relief.toString('base64'),
      terrainAppearanceData: Buffer.from(encodePreparedTerrain(content.appearance, size)).toString('base64'),
      preparedContentVersion: 2,
      generation: {
        version: 5,
        villagePlacement: { version: 1, mode: 'biome-slots', placed: settlements.length },
        generator: 'macro-continent',
        coastCleanup,
        seed,
        biomes: biomes.split(','),
        biomeCounts,
        campPlacement: { version: 1, cellsPerCamp, lairFraction, placed: camps.length },
        cavePlacement: {
          version: 1,
          cellsPerCave,
          minDistance: cavePlan.minDistance,
          target: cavePlan.target,
          placed: cavePlan.caves.length,
        },
      },
      spawns: settlements.map(site => site.local),
      settlements: [...settlements, ...campSettlements],
      resources: content.resources,
      animals: content.animals,
      banditCampPositions: camps,
      caves: cavePlan.caves,
    }
    const manifest = {
      format: 'macro-world-map-manifest',
      version: 1,
      worldSeed: seed,
      macroPreviewPath: 'continent-preview.png',
      regionMapSize: sourceSize,
      regionsWide: 1,
      regionsHigh: 1,
      settlements: [...settlements, ...campSettlements],
      maps: [
        {
          id,
          path: `${id}.map`,
          size: sourceSize,
          environment: 'Temperate',
          region,
          seed,
          spawns: settlements.length,
          settlements: [...settlements, ...campSettlements],
        },
      ],
    }
    const destination = path.join(output, 'maps', `${id}.map`)
    fs.writeFileSync(`${destination}.tmp`, JSON.stringify(blueprint))
    fs.renameSync(`${destination}.tmp`, destination)
    fs.copyFileSync(path.join(temporary, 'continent-preview.png'), path.join(output, 'continent-preview.png'))
    fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
    console.log(
      JSON.stringify({
        worldId,
        landCells,
        biomeCounts,
        resources: content.resources.length,
        trees: content.resources.filter(resource => resource.type === 'Tree').length,
        animals: content.animals.length,
        shoreCells: content.appearance.length,
        settlements: settlements.length,
        caves: cavePlan.caves.length,
        camps: camps.length,
      })
    )
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true })
  }
}
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
