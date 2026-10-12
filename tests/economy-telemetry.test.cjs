const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const cache = new Map()
const load = file => loadTsModule(file, { moduleCache: cache })
const meter = load('app/lib/economy/economyTelemetry.ts')
const live = load('app/classes/unit/UnitResourceGathering.ts')
const { consumeVillageFood } = load('app/lib/economy/villageFood.ts')
const { craftHeroRecipe, HERO_CRAFT_RECIPES } = load('app/lib/hero/heroCrafting.ts')
const { resetHarvestedWheat } = load('app/lib/resources/wheatGrowth.ts')
const { buildOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
const { simulateOfflineWorld } = load('app/services/world/offline/OfflineWorldSimulation.ts')
const { DAY_NIGHT_CONFIG } = load('app/config/gameplay.ts')
const { economyFlowCommand } = load('app/dev-console/actions/economyFlow.ts')
test.afterEach(() => meter.readEconomyTelemetry(true))
const sum = (capture, kind, mode) =>
  capture.rows.filter(r => r.kind === kind && (!mode || r.mode === mode)).reduce((n, r) => n + r.amount, 0)
function setup() {
  const owner = { label: 'village', civ: 'Hellas', type: 'Human', units: [], buildings: [] }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 0,
    j: 0,
    owner,
    inventory: { resources: { wood: 0, wheat: 3, berry: 2 }, equipment: [] },
    work: 'woodcutter',
  }
  owner.units.push(unit)
  let now = 0
  meter.startEconomyTelemetry(
    () => now,
    () => [owner]
  )
  return {
    owner,
    unit,
    tick: value => {
      now = value
    },
  }
}

test('capture is opt-in, bounded to a session and refuses to erase an active measurement', () => {
  assert.equal(meter.economyTelemetryActive(), false)
  const { owner, tick } = setup()
  meter.recordEconomyFlow(owner, 'gathered', { wood: 3 })
  assert.equal(
    meter.startEconomyTelemetry(
      () => 0,
      () => []
    ),
    false
  )
  tick(60000)
  const capture = meter.readEconomyTelemetry(true)
  assert.equal(capture.elapsedMs, 60000)
  assert.equal(capture.active, false)
  meter.recordEconomyFlow(owner, 'gathered', { wood: 10 })
  assert.equal(sum(meter.readEconomyTelemetry(), 'gathered'), 3)
})
test('live harvest records only accepted quantity and delivery is not a second harvest', () => {
  const { owner, unit } = setup()
  const gain = live.addGatheredResource(unit, 'wood', 1000)
  assert.ok(gain > 0 && gain < 1000)
  const depot = { type: 'StoragePit', label: 'depot', owner, inventory: { resources: { wood: gain } } }
  unit.inventory.resources.wood -= gain
  owner.buildings.push(depot)
  const capture = meter.readEconomyTelemetry()
  assert.equal(sum(capture, 'gathered', 'live'), gain)
  assert.equal(capture.stocks[0].delta.wood, gain)
})
test('meals report physical food components once, not the virtual food aggregate', () => {
  const { owner, unit } = setup()
  const result = consumeVillageFood(owner, 4)
  assert.equal(result.consumed, 4)
  const capture = meter.readEconomyTelemetry()
  assert.equal(sum(capture, 'meals'), 4)
  assert.ok(capture.rows.every(r => r.resource !== 'food'))
  assert.equal(
    Object.values(unit.inventory.resources).reduce((n, v) => n + v, 0),
    1
  )
})
test('failed craft contributes no flow, ten arrow crafts record whole material payments and ten distinct outputs', () => {
  const { owner, unit } = setup()
  unit.type = 'Hero'
  const recipe = HERO_CRAFT_RECIPES.find(r => r.id === 'arrow_bronze')
  assert.equal(craftHeroRecipe(owner, unit, recipe), false)
  assert.equal(meter.readEconomyTelemetry().rows.length, 0)
  Object.assign(unit.inventory.resources, { wood: 5, bronzeIngot: 1 })
  assert.equal(craftHeroRecipe(owner, unit, recipe, 10), true)
  const capture = meter.readEconomyTelemetry()
  assert.equal(sum(capture, 'craftConsumed'), 6)
  assert.equal(sum(capture, 'craftProduced'), 10)
  assert.equal(capture.rows.find(r => r.kind === 'craftProduced').resource, 'item:arrow_bronze')
})
test('construction counts actual consumed materials, including old deliveries, without charging repairs twice', () => {
  const { owner, unit } = setup()
  unit.inventory.activeWeapons = { tool: 'hammer_ceramic' }
  unit.inventory.resources.wood = 3
  const target = {
    type: 'House',
    label: 'house',
    i: 0,
    j: 0,
    hitPoints: 1,
    totalHitPoints: 10,
    constructionTime: 4,
    constructionMaterials: { cost: { wood: 4 }, consumed: {}, delivered: { wood: 1 } },
  }
  owner.buildings.push(target)
  const step = {
    state: { players: [owner], resources: [] },
    player: owner,
    playerIndex: 0,
    unit,
    target,
    day: 1,
    spatial: {},
    rules: { buildingConfig: () => ({ constructionTime: 4, totalHitPoints: 10 }) },
    report: { buildingsCompleted: 0 },
    cycle: 1000,
  }
  meter.withOfflineEconomyTelemetry([owner], 0, 10000, () => buildOffline(step, 4000))
  assert.equal(sum(meter.readEconomyTelemetry(), 'construction', 'offline'), 4)
  assert.equal(target.isBuilt, true)
  meter.withOfflineEconomyTelemetry([owner], 10000, 11000, () => buildOffline(step, 1000))
  assert.equal(sum(meter.readEconomyTelemetry(), 'construction'), 4)
})
test('wheat reset records potential map renewal once, without adding to owned stock', () => {
  setup()
  const wheat = { type: 'Wheat', quantity: 0, totalQuantity: 10, currentFrame: 5 }
  assert.equal(resetHarvestedWheat(wheat), true)
  assert.equal(resetHarvestedWheat(wheat), false)
  const capture = meter.readEconomyTelemetry()
  assert.equal(sum(capture, 'renewed'), 10)
  assert.equal(capture.rows[0].player, 'monde')
  assert.equal(capture.stocks[0].delta.wheat, 0)
})
test('real offline simulation records the same harvest and meal counts as its own report', () => {
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 10,
    hitPoints: 18,
    autonomousJob: 'wood',
    inventory: { resources: { wheat: 12 }, equipment: [] },
  }
  const player = {
    type: 'Human',
    label: 'offline-village',
    population: 1,
    populationMax: 1,
    units: [unit],
    buildings: [
      { type: 'TownCenter', label: 'center', i: 6, j: 6, isBuilt: true, inventory: { resources: { wheat: 100 } } },
      { type: 'StoragePit', label: 'pit', i: 6, j: 12, isBuilt: true, inventory: { resources: {} } },
      { type: 'Granary', label: 'grain', i: 6, j: 16, isBuilt: true, inventory: { resources: { wheat: 100 } } },
    ],
  }
  const state = {
    camera: { x: 0, y: 0 },
    world: { mapType: 'world-region', size: 30 },
    runtime: { dayNightElapsedMs: 0 },
    players: [player],
    animals: [],
    resources: [{ type: 'Tree', label: 'tree', i: 10, j: 12, quantity: 30, totalQuantity: 30, hitPoints: 0 }],
  }
  let now = 0
  meter.startEconomyTelemetry(
    () => now,
    () => [player]
  )
  const result = simulateOfflineWorld(state, {
    fromElapsedMs: 30000,
    toElapsedMs: DAY_NIGHT_CONFIG.dayLengthMs,
    terrain: Array.from({ length: 31 }, () => Array.from({ length: 31 }, () => ({ category: 'Grass' }))),
    unitConfig: () => ({ speed: 1.5, totalHitPoints: 18, gatherAmount: { woodcutter: 1 } }),
    buildingConfig: () => ({ size: 2, constructionTime: 48, totalHitPoints: 96 }),
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
  })
  now = DAY_NIGHT_CONFIG.dayLengthMs
  const capture = meter.readEconomyTelemetry()
  assert.ok((result.gathered.wood ?? 0) > 0, JSON.stringify({ result, unit, player }))
  assert.equal(sum(capture, 'gathered', 'offline'), result.gathered.wood)
  assert.equal(sum(capture, 'meals', 'offline'), result.foodConsumed)
  assert.ok(capture.rows.filter(r => r.kind === 'meals').every(r => r.player === 'offline-village'))
  assert.equal(capture.offlineWindows.length, 1)
})
test('nested offline scopes do not duplicate windows and restore live mode after exceptions', () => {
  const { owner } = setup()
  assert.throws(
    () =>
      meter.withOfflineEconomyTelemetry([owner], 0, 10, () =>
        meter.withOfflineEconomyTelemetry([owner], 0, 10, () => {
          throw new Error('test')
        })
      ),
    /test/
  )
  meter.recordEconomyFlow(owner, 'gathered', { wood: 1 })
  const capture = meter.readEconomyTelemetry()
  assert.equal(capture.offlineWindows.length, 1)
  assert.equal(capture.rows[0].mode, 'live')
})
test('stock inventory aliases count only once and command guards malformed arguments', () => {
  const { owner } = setup()
  const chest = { label: 'chest', inventory: { resources: { gold: 3 } } }
  owner.buildings.push(chest, { label: 'house', interiorBuildings: [chest] })
  assert.equal(meter.readEconomyTelemetry().stocks[0].after.gold, 3)
  assert.equal(economyFlowCommand(['typo'], {}).ok, false)
  assert.equal(economyFlowCommand(['show'], {}).ok, true)
  assert.equal(economyFlowCommand(['stop'], {}).ok, true)
})

test('goal commands are captured, stop interrupts and a new session clears measurements', () => {
  const { tick } = setup()
  let now = 0
  const context = { players: [], dayNight: { getElapsedMs: () => now } }
  assert.equal(economyFlowCommand(['goal', 'maison'], context).ok, true)
  now = 200
  tick(now)
  economyFlowCommand(['phase', 'build'], context)
  now = 700
  tick(now)
  economyFlowCommand(['finish'], context)
  const result = meter.readEconomyTelemetry(true)
  assert.equal(result.objectives[0].gameMs, 700)
  assert.equal(result.objectives[0].completed, true)
  assert.deepEqual(
    result.objectives[0].segments.map(s => s.phase),
    ['other', 'build']
  )
  assert.equal(economyFlowCommand(['goal', 'bronze'], context).ok, false)
  economyFlowCommand(['start'], context)
  assert.deepEqual(meter.readEconomyTelemetry().objectives, [])
})

test('reserved chantier cargo remains stock until independent construction work commits it', () => {
  const { owner, unit } = setup()
  const { createConstructionMaterials, deliverConstructionMaterials, advanceMaterialConstruction } = load(
    'app/lib/economy/constructionMaterials.ts'
  )
  const site = {
    hitPoints: 100,
    constructionProgress: 0,
    constructionWorkRequired: 100,
    constructionMaterials: createConstructionMaterials({ wood: 10 }),
  }
  owner.buildings.push(site)
  unit.inventory.resources.wood = 10
  meter.recordEconomyFlow(owner, 'gathered', { wood: 10 })
  deliverConstructionMaterials(site, [unit.inventory.resources])
  let capture = meter.readEconomyTelemetry()
  assert.equal(capture.stocks[0].delta.wood, 10)
  assert.equal(sum(capture, 'construction'), 0)
  meter.observeEconomyChange(
    owner,
    'construction',
    () => site.constructionMaterials.consumed,
    'added',
    () => advanceMaterialConstruction(site, 1)
  )
  capture = meter.readEconomyTelemetry()
  assert.equal(capture.stocks[0].delta.wood, 0)
  assert.equal(sum(capture, 'construction'), 10)
})
