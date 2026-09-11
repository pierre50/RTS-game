const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { selectFactionRaidArmy, commitFactionRaidArmy, returnFactionRaidUnit, expeditionState } = loadTsModule(
  'app/services/tribute/FactionRaidEconomy.ts'
)

function fixture(difficulty = 'medium') {
  const units = Array.from({ length: 10 }, (_, i) => ({
    label: `soldier-${i}`,
    type: i % 2 ? 'Bowman' : 'Fantassin',
    i: 5 + i,
    j: 10,
    hitPoints: 20,
    totalHitPoints: 20,
  }))
  units.push({ label: 'chief', type: 'Chief', i: 5, j: 5, hitPoints: 20 })
  const player = {
    label: 'ai',
    factionId: 'civ-hellas',
    type: 'AI',
    units,
    buildings: [],
    population: 11,
    populationMax: 20,
  }
  const state = { players: [player], resources: [], animals: [], world: { worldRegionId: 'home' } }
  const region = {
    regionId: 'home',
    initialState: state,
    terrain: Array(25).fill('.'.repeat(25)),
    summaries: {},
    simulatedUntilMs: 0,
  }
  const economy = { regions: { home: region } }
  const context = { map: { difficulty }, getCampaignEconomy: () => economy, getCurrentWorldId: () => 'target' }
  return { context, player, region, state }
}

test('expeditions use actual types, preserve chiefs and retain a difficulty-dependent garrison', () => {
  for (const [difficulty, count] of [
    ['easy', 3],
    ['medium', 4],
    ['hard', 5],
  ]) {
    const { context, player } = fixture(difficulty)
    const army = selectFactionRaidArmy(context, 'civ-hellas')
    assert.equal(army.units.length, count)
    assert.ok(army.units.every(unit => ['Fantassin', 'Bowman'].includes(unit.type)))
    assert.equal(commitFactionRaidArmy(context, army), true)
    assert.equal(player.population, 11 - count)
    assert.ok(player.units.some(unit => unit.type === 'Chief'))
    assert.equal(commitFactionRaidArmy(context, army), false)
  }
})

test('no army is invented for unknown factions, small forces, trainees or the active world', () => {
  const { context, player, region } = fixture()
  assert.equal(selectFactionRaidArmy(context, 'unknown'), null)
  region.worldId = 'target'
  assert.equal(selectFactionRaidArmy(context, 'civ-hellas'), null)
  delete region.worldId
  player.units.forEach(unit => {
    unit.trainingTargetType = 'Bowman'
  })
  assert.equal(selectFactionRaidArmy(context, 'civ-hellas'), null)
})

test('stale selection after an asynchronous preload cannot remove replacement army data', () => {
  const { context, player } = fixture()
  const army = selectFactionRaidArmy(context, 'civ-hellas')
  player.units = structuredClone(player.units)
  assert.equal(commitFactionRaidArmy(context, army), false)
  assert.equal(player.population, 11)
})

test('survivors return once with current health; casualties never return; metadata survives JSON', () => {
  const { context, player } = fixture()
  const army = selectFactionRaidArmy(context, 'civ-hellas')
  const factionExpedition = JSON.parse(
    JSON.stringify(expeditionState(army, army.units[0], 'raid-1', 'civ-hellas', { gold: 50 }))
  )
  assert.equal(commitFactionRaidArmy(context, army), true)
  const survivor = { hitPoints: 7, factionExpedition }
  assert.equal(returnFactionRaidUnit(context, survivor), true)
  assert.equal(player.units.find(unit => unit.label === factionExpedition.original.label).hitPoints, 7)
  const population = player.population
  assert.equal(returnFactionRaidUnit(context, survivor), true)
  assert.equal(player.population, population)
  assert.equal(returnFactionRaidUnit(context, { ...survivor, isDead: true }), false)
})
