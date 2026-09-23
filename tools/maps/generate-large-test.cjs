// A deliberately simple, single-region stress map. Run: node tools/maps/generate-large-test.cjs
const fs = require('node:fs')
const path = require('node:path')
const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { createLocalMapLayout, localToGrid } = loadGenerationTs('app/lib/localMapLayout.ts')
const { CIVILIZATIONS } = loadGenerationTs('app/config/civilizations.ts')

const root = path.resolve(__dirname, '../..')
const testEdge = 5000
const worldId = `world-test-${testEdge}`
const sourceSize = testEdge - 1 // Blueprint sizes are inclusive.
const layout = createLocalMapLayout(sourceSize)
const size = layout.columns - 1 + Math.ceil((layout.rows - 1) / 2)
const stride = size + 1
const terrain = Buffer.alloc(stride * stride, 255)
const relief = Buffer.alloc(stride * stride)
let activeCells = 0
for (let row = 0; row < layout.rows; row++) {
  for (let column = 0; column < layout.columns; column++) {
    if (row % 2 === 1 && column === layout.columns - 1) continue
    const { i, j } = localToGrid(column, row, layout)
    terrain[i * stride + j] = 0 // Flat grass; 255 outside the rectangular footprint.
    activeCells++
  }
}

const source = JSON.parse(fs.readFileSync(path.join(root,
  'public/maps/worlds/world-4242/maps/world-4242-r1-2-temperate.map'), 'utf8'))
const offsetI = Math.floor((size - source.size) / 2)
const offsetJ = Math.ceil((size - source.size) / 2)
const move = position => ({ ...position, i: position.i + offsetI, j: position.j + offsetJ })
const region = { x: 0, y: 0 }
// The prologue can choose a host civilization after the blueprint has loaded.
// Keep every offered host on this single region, with separate village sites.
const template = source.settlements[0]
const settlements = CIVILIZATIONS.map(({ value: civ }, index) => {
  const angle = 2 * Math.PI * (index - 1) / (CIVILIZATIONS.length - 1)
  const local = index === 0 ? move(template.local) : localToGrid(
    Math.round((layout.columns - 1) / 2 + 110 * Math.cos(angle)),
    Math.round((layout.rows - 1) / 2 + 440 * Math.sin(angle)),
    layout
  )
  return { ...template, id: `test-village-${civ}`, civ, playerIndex: index, region, local, world: local }
})
const id = `${worldId}-r0-0`
const blueprint = {
  format: 'map-blueprint', version: 2, id, sourceSize, size,
  seed: testEdge, mapType: 'world-region', environment: 'Temperate',
  encoding: 'base64', cellCount: terrain.length, localGridLayout: layout,
  terrain: terrain.toString('base64'), relief: relief.toString('base64'),
  terrainAppearanceData: '', preparedContentVersion: 1,
  spawns: settlements.map(settlement => settlement.local), settlements,
  resources: source.resources.map(move), animals: (source.animals ?? []).map(move),
  banditCampPositions: [], caves: [],
}
const manifest = {
  format: 'macro-world-map-manifest', version: 1, worldSeed: testEdge,
  regionMapSize: sourceSize, regionsWide: 1, regionsHigh: 1, settlements,
  maps: [{ id, path: `${id}.map`, size: sourceSize, environment: 'Temperate',
    region, seed: testEdge, spawns: blueprint.spawns.length, settlements }],
}
const output = path.join(root, 'public/maps/worlds', worldId)
fs.mkdirSync(path.join(output, 'maps'), { recursive: true })
fs.writeFileSync(path.join(output, 'maps', `${id}.map`), JSON.stringify(blueprint))
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`${worldId}: ${activeCells.toLocaleString('en-US')} terrain cells, ${blueprint.resources.length} resources, one region`)
