const test = require('node:test')
const assert = require('node:assert/strict')
const { estimateObjective, objectiveCatalogue } = require('../tools/economy/objectives.cjs')
const { craftCatalogue } = require('../tools/economy/catalogue.cjs')
const { buildingInventory } = require('../tools/economy/model.cjs')
const { performanceCatalogue } = require('../tools/economy/performance.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validateCapture } = require('../tools/economy/capture.cjs')
const buildings = buildingInventory(require('../public/assets/data/gameplay/buildings.json')).buildings
const data = objectiveCatalogue(
  buildings,
  craftCatalogue(),
  performanceCatalogue(
    require('../public/assets/data/gameplay/equipment.json'),
    require('../public/assets/data/gameplay/units.json')
  )
)
const defaults = {
  objective: 'maison',
  forgeReady: true,
  stock: {},
  workers: 1,
  level: 1,
  tier: 0,
  capacity: 10,
  distance: 20,
  speed: 2,
  impactSeconds: 1,
  woodOverhead: 1,
  pausePercent: 20,
  craftSeconds: 0,
  stationTravelSeconds: 0,
}
test('house time separates gathering, round trips, construction and non-overlapping pauses', () => {
  const result = estimateObjective(data, defaults)
  assert.deepEqual(result.missing, { wood: 40, stone: 10 })
  assert.deepEqual(result.phases, { harvest: 150, travel: 100, build: 180, craft: 0, pause: 107.5 })
  assert.equal(result.total, 537.5)
  assert.equal(result.nextWoodBefore, result.nextWoodAfter)
})
test('available ingots reduce raw requirements; absent forge is added once', () => {
  const result = estimateObjective(data, { ...defaults, objective: 'hache-bronze', stock: { bronzeIngot: 1 } })
  assert.deepEqual(result.missing, { wood: 6, copper: 2, tin: 1 })
  assert.equal(result.steps.find(s => s.label === 'bronzeIngot').batches, 1)
  const absent = estimateObjective(data, { ...defaults, objective: 'hache-bronze', forgeReady: false })
  assert.deepEqual(absent.missing, { wood: 68, stone: 20, copper: 4, tin: 2 })
  assert.equal(absent.phases.build, 480)
  assert.ok(absent.nextWoodAfter < absent.nextWoodBefore)
  const owned = estimateObjective(data, {
    ...defaults,
    objective: 'bronze',
    forgeReady: false,
    stock: { bronzeIngot: 1 },
  })
  assert.equal(owned.total, 0)
  assert.equal(owned.blockers.length, 0)
})
test('whole batches share surplus and capacity limits each harvest release', () => {
  const fixture = structuredClone(data)
  fixture.recipes.find(r => r.outputResource === 'bronzeIngot').outputCount = 3
  const result = estimateObjective(fixture, { ...defaults, objective: 'hache-bronze' })
  assert.equal(result.steps.find(s => s.label === 'bronzeIngot').batches, 1)
  assert.equal(result.surplus.bronzeIngot, 1)
  const capacity = estimateObjective(data, { ...defaults, capacity: 1, tier: 3 })
  assert.equal(capacity.resources.find(r => r.resource === 'wood').lots, 40)
  assert.throws(() => estimateObjective(data, { ...defaults, pausePercent: 100 }))
  assert.throws(() => estimateObjective(data, { ...defaults, workers: 1.5 }))
  assert.throws(() => estimateObjective(data, { ...defaults, stock: { wood: -1 } }))
})
test('manual objective timing separates game and real clocks, snapshots and interrupted completion', () => {
  const meter = loadTsModule('app/lib/economy/economyObjectives.ts')
  meter.resetEconomyObjectives()
  meter.markEconomyObjective('goal', 'maison', 100, 1000)
  meter.markEconomyObjective('phase', 'harvest', 200, 1500)
  let copy = meter.readEconomyObjectives(500, false, 2500)
  assert.equal(copy[0].realMs, 1500)
  assert.equal(copy[0].gameMs, 400)
  meter.markEconomyObjective('phase', 'travel', 700, 3000)
  assert.equal(copy[0].gameMs, 400)
  meter.markEconomyObjective('finish', undefined, 900, 3500)
  copy = meter.readEconomyObjectives(1000, false, 4000)
  assert.equal(copy[0].completed, true)
  assert.equal(copy[0].realMs, 2500)
  assert.equal(copy[0].gameMs, 800)
  meter.markEconomyObjective('goal', 'bronze', 1000, 4000)
  const interrupted = meter.readEconomyObjectives(1200, true, 4500)
  assert.equal(interrupted[1].completed, false)
  assert.deepEqual(meter.readEconomyObjectives(2000, false, 9000), interrupted)
  const capture = {
    format: 'economy-flow-capture',
    version: 1,
    active: false,
    startedAtMs: 0,
    endedAtMs: 1200,
    elapsedMs: 1200,
    rows: [],
    stocks: [],
    offlineWindows: [],
    incomplete: false,
    objectives: interrupted,
  }
  assert.equal(validateCapture(capture), capture)
  assert.throws(() => validateCapture({ ...capture, objectives: [{ ...interrupted[0], realMs: 1 }] }))
})

test('bronze cannot silently assume tin absent from the audited map', () => {
  const result = estimateObjective(
    { ...data, mapStock: { wood: 1000, copper: 1000, tin: 0 } },
    { ...defaults, objective: 'bronze' }
  )
  assert.deepEqual(result.missingOnMap, ['tin'])
  assert.ok(result.blockers.some(b => b.includes('autre source')))
})

test('discovering bronze alone does not improve woodcutting without equipping a new axe', () => {
  const result = estimateObjective(data, { ...defaults, objective: 'bronze' })
  assert.equal(result.nextWoodAfter, result.nextWoodBefore)
})
