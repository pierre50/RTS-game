const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { planContinentVillageSlots } = require('../tools/maps/continent-villages.cjs')
const { assignContinentVillages } = loadTsModule('app/lib/campaign/continentVillagePlacement.ts')
const { buildWorldRegionPlayerConfigs } = loadTsModule('app/screens/game/WorldRegionPlayers.ts')
const { CIVILIZATIONS } = loadTsModule('app/config/civilizations.ts')
const preferences = require('../app/config/civilizationPlacement.json')

function fixture() {
  const size = 599,
    stride = size + 1
  const terrain = Buffer.alloc(stride ** 2, 0)
  const biomeCodes = Buffer.alloc(stride ** 2)
  for (let i = 0; i < stride; i++)
    for (let j = 0; j < stride; j++) biomeCodes[i * stride + j] = 'TFDS'[Math.floor(j / 150)].charCodeAt(0)
  return { size, terrain, biomeCodes, seed: 5000 }
}
test('generator reserves deterministic, spaced biome sites without assigning civilizations', () => {
  const input = fixture()
  const sites = planContinentVillageSlots(input)
  assert.deepEqual(planContinentVillageSlots(input), sites)
  assert.equal(sites.length, 8)
  assert.deepEqual(
    sites.map(s => s.biome).sort(),
    ['temperate', 'temperate', 'blackforest', 'blackforest', 'desert', 'desert', 'steppe', 'steppe'].sort()
  )
  for (const site of sites) {
    assert.equal(site.civ, undefined)
    for (const other of sites)
      if (site !== other) assert.ok(Math.hypot(site.local.i - other.local.i, site.local.j - other.local.j) >= 100)
  }
})
test('runtime dispatch gives each civilization its preferred biome and exactly one human for every choice', () => {
  const source = { size: 599, terrain: [], settlements: planContinentVillageSlots(fixture()) }
  const before = structuredClone(source)
  const placed = assignContinentVillages(source)
  assert.deepEqual(source, before, 'cached blueprint stays anonymous')
  assert.equal(new Set(placed.settlements.map(s => s.civ)).size, 8)
  for (const site of placed.settlements) {
    const scores = preferences[site.civ].biomes
    assert.equal(scores[site.biome], Math.max(...Object.values(scores)))
  }
  for (const { value: civ } of CIVILIZATIONS) {
    const roster = buildWorldRegionPlayerConfigs({ players: [{ civ, isHuman: true }] }, placed)
    assert.equal(roster.length, 8)
    assert.deepEqual(
      roster.filter(p => p.isHuman).map(p => p.civ),
      [civ]
    )
    assert.equal(roster.filter(p => !p.isHuman).length, 7)
  }
})
test('missing biomes use safe alternatives, and legacy assigned blueprints stay unchanged', () => {
  const input = fixture()
  input.biomeCodes.fill('T'.charCodeAt(0))
  const source = { size: input.size, terrain: [], settlements: planContinentVillageSlots(input) }
  assert.equal(assignContinentVillages(source).settlements.length, 8)
  const legacy = { size: 10, settlements: [{ kind: 'village', civ: 'Hellas' }] }
  assert.equal(assignContinentVillages(legacy), legacy)
})

test('actual player creation uses the assigned sites for all human choices, including non-first civilizations', () => {
  class Human { constructor(options) { Object.assign(this, options, { type: 'Human' }) } }
  class AI { constructor(options) { Object.assign(this, options, { type: 'AI' }) } }
  const { generatePlayers } = loadTsModule('app/classes/map/MapPlayerGeneration.ts', {
    mocks: { '../../lib': { playerColors: ['blue', 'red'] }, '../../lib/resources/playerResourceTotals': {},
      '../players': { Human, AI }, './BanditCampGeneration': {} },
  })
  const blueprint = assignContinentVillages({ size: 599, terrain: [], settlements: planContinentVillageSlots(fixture()) })
  for (const { value: civ } of CIVILIZATIONS) for (const heroOnlyStart of [true, false]) {
    const roster = buildWorldRegionPlayerConfigs({ players: [{ civ, isHuman: true }] }, blueprint)
    const grid = []
    for (const site of blueprint.settlements) {
      grid[site.local.i] ??= []
      grid[site.local.i][site.local.j] = { category: 'Land' }
    }
    const map = { size: 599, grid, settlements: blueprint.settlements, heroOnlyStart, noAI: false,
      startingAge: 0, context: { app: {}, gamebox: {}, map: {}, scheduler: {} } }
    const players = generatePlayers(map, roster)
    assert.equal(players.length, 8)
    assert.equal(players.filter(p => p.type === 'AI').length, 7)
    assert.deepEqual(players.filter(p => p.isPlayed).map(p => p.civ), [civ])
    for (const player of players) {
      const site = blueprint.settlements.find(s => s.civ === player.civ)
      assert.deepEqual({ i: player.i, j: player.j }, site.local)
    }
  }
})

test('1000 map retains the same civilization sites across human choices and reloads', () => {
  const manifest = require('../public/maps/worlds/world-test-1000/manifest.json')
  const source = { size: manifest.regionMapSize, settlements: manifest.settlements, worldManifest: manifest }
  const assigned = assignContinentVillages(source)
  const positions = assigned.settlements.filter(site => site.civ).map(site => [site.civ, site.local])
  assert.equal(positions.length, 8)
  assert.deepEqual(assignContinentVillages(structuredClone(source)).settlements, assigned.settlements)
  assert.equal(assignContinentVillages(assigned), assigned)
  assert.deepEqual(assigned.worldManifest.settlements, assigned.settlements)
  for (const { value: civ } of CIVILIZATIONS) {
    const players = buildWorldRegionPlayerConfigs({ players: [{ civ, isHuman: true }], heroStartVillage: civ }, assigned)
    assert.equal(players.filter(player => !player.isHuman).length, 8)
    assert.deepEqual(assigned.settlements.filter(site => site.civ).map(site => [site.civ, site.local]), positions)
  }
})
