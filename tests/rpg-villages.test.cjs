const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { replenishRpgVillage } = loadTsModule('app/services/world/RpgVillageSupplies.ts', {
  mocks: { '../../lib/resources/playerResourceTotals': { syncPlayerResourceFieldsFromChests() {} } },
})
function village(extra = {}) {
  const owner = {
    label: 'village',
    type: 'AI',
    developmentMode: 'static',
    settlementType: 'village',
    units: [{}],
    buildings: [],
    ...extra,
  }
  owner.buildings.push({
    type: 'Granary',
    label: 'granary',
    i: 0,
    j: 0,
    owner,
    isBuilt: true,
    inventory: { resources: { wheat: 170 } },
  })
  owner.buildings.push({
    type: 'StoragePit',
    label: 'pit',
    i: 5,
    j: 5,
    owner,
    isBuilt: true,
    inventory: { resources: { wood: 100, stone: 70 } },
  })
  return owner
}
test('supplies top up modestly once per saved day and never exceed targets or capacity', () => {
  const owner = village()
  assert.equal(replenishRpgVillage(owner, 1), true)
  assert.deepEqual(owner.buildings[0].inventory.resources, { wheat: 200 })
  assert.deepEqual(owner.buildings[1].inventory.resources, { wood: 120, stone: 80 })
  owner.buildings[0].inventory.resources.wheat = 0
  assert.equal(replenishRpgVillage(owner, 1), false)
  const restored = structuredClone(owner)
  assert.equal(replenishRpgVillage(restored, 1), false)
  replenishRpgVillage(owner, 300)
  assert.equal(owner.buildings[0].inventory.resources.wheat, 30, 'no huge catch-up delivery')
  owner.buildings[0].inventory.resources = { wheat: 190, meat: 105 }
  replenishRpgVillage(owner, 301)
  assert.deepEqual(owner.buildings[0].inventory.resources, { wheat: 195, meat: 105 })
})
test('supplies reach the actual interior chest and respect combined depot capacity', () => {
  const owner = village({ settlementType: 'city' })
  const depot = owner.buildings[0]
  depot.inventory.resources = { wheat: 180 }
  const chest = {
    type: 'Chest',
    label: 'interior:village:granary:default:storage-chest',
    owner,
    inventory: { resources: { wheat: 10, meat: 105 } },
  }
  owner.buildings.push(chest)
  replenishRpgVillage(owner, 1)
  assert.equal(depot.inventory.resources.wheat, 180)
  assert.equal(chest.inventory.resources.wheat, 15)
  assert.equal(owner.buildings[1].inventory.resources.iron, 2)
  chest.isDestroyed = true
  replenishRpgVillage(owner, 2)
  assert.equal(chest.inventory.resources.wheat, 15)
})
test('human, dynamic AI, bandits, abandoned and destroyed settlements get no free stock', () => {
  for (const extra of [
    { isPlayed: true },
    { type: 'Human' },
    { type: 'Bandits' },
    { developmentMode: 'dynamic' },
    { units: [] },
  ]) {
    const owner = village(extra)
    replenishRpgVillage(owner, 1)
    assert.equal(owner.buildings[0].inventory.resources.wheat, 170)
  }
  const owner = village()
  owner.buildings[0].isDead = true
  owner.buildings[1].isBuilt = false
  assert.equal(replenishRpgVillage(owner, 1), false)
})

function ambientHarness(type = 'village') {
  const orders = []
  const context = {
    controls: {
      getViewportMetrics: () => ({ visibleLeft: -5000, visibleTop: -5000, visibleWidth: 10000, visibleHeight: 10000 }),
    },
    players: [],
    map: { grid: [], randomRange: () => 0 },
    scheduler: { elapsedMs: 0, add: () => 1, remove() {} },
    dayNight: { state: { hour: 10, minute: 0 } },
  }
  const owner = village({ settlementType: type, units: [] })
  for (let i = 0; i < 30; i++) {
    context.map.grid[i] = []
    for (let j = 0; j < 30; j++) context.map.grid[i][j] = { i, j, z: 0, category: 'Land' }
  }
  for (let index = 0; index < 10; index++)
    owner.units.push({
      type: 'Villager',
      label: `unit-${index}`,
      owner,
      context,
      i: 15,
      j: 15,
      villageHome: { i: 15, j: 15 },
      path: [],
      stop() {
        this.action = null
        this.dest = null
      },
      sendTo(cell) {
        orders.push({ unit: this.label, cell, type: 'walk' })
      },
      sendToFarm(cell) {
        orders.push({ unit: this.label, cell, type: 'farm' })
      },
    })
  context.players.push(owner)
  const { RpgVillageSystem } = loadTsModule('app/services/world/RpgVillageSystem.ts', {
    mocks: {
      '../../lib/units/village/villageActivity': { isDistantOwner: player => player.distant },
      '../../lib/units/unitSuspension': { isUnitSuspended: unit => unit.suspended },
      '../../lib/units/autonomy/villagerExploration': { cancelVillagerExplorationResume() {} },
      '../../lib/buildings/passageCells': {
        canUnitUseCellAsIdleDestination: (_unit, cell) => !cell.solid && !cell.has,
      },
      './RpgVillageSupplies': { replenishRpgVillage() {} },
    },
  })
  return { context, owner, orders, system: new RpgVillageSystem(context) }
}
test('ambient work caps participation and issues at most one adjacent order per tick', () => {
  for (const [type, limit] of [
    ['village', 2],
    ['city', 4],
  ]) {
    const { context, owner, orders, system } = ambientHarness(type)
    for (let i = 0; i < 12; i++) {
      const before = orders.length
      system.update()
      assert.ok(orders.length - before <= 1)
      context.scheduler.elapsedMs += 5000
    }
    assert.equal(new Set(orders.map(order => order.unit)).size, limit)
    for (const order of orders) assert.equal(Math.abs(order.cell.i - 15) + Math.abs(order.cell.j - 15), 1)
    assert.ok(owner.units.every(unit => !unit.autonomousJob))
  }
})
test('only the limited farmers harvest; distant, controlled, busy and fighting villagers remain untouched', () => {
  const { context, owner, orders, system } = ambientHarness()
  context.map.grid[16][15].has = {
    type: 'Wheat',
    i: 16,
    j: 15,
    quantity: 10,
    sprite: { currentFrame: 2, textures: [0, 1, 2] },
  }
  for (let i = 0; i < 3; i++) {
    system.update()
    context.scheduler.elapsedMs += 5000
  }
  assert.equal(orders.filter(order => order.type === 'farm').length, 2)
  assert.equal(orders.filter(order => order.type === 'walk').length, 0)
  owner.distant = true
  system.update()
  assert.equal(orders.length, 2)
  const other = ambientHarness()
  for (const unit of other.owner.units) {
    unit.combatMode = 'attack'
    unit.action = 'attack'
    unit.autonomousJob = 'food'
  }
  other.system.update()
  assert.equal(other.orders.length, 0)
  assert.ok(other.owner.units.every(unit => unit.action === 'attack' && unit.autonomousJob === 'food'))
})
test('generic autonomy declines RPG residents but still permits recruited companions and player villagers', () => {
  const { villagerAutonomySuspension } = loadTsModule('app/lib/units/autonomy/villagerAutonomyAvailability.ts', {
    mocks: {
      '../unitSuspension': { unitSuspensionReason: () => null },
      '../village/villagerSchedule': { shouldVillagerWork: () => true },
    },
  })
  const owner = village()
  const unit = { type: 'Villager', owner }
  assert.equal(villagerAutonomySuspension(unit), 'rpg-village')
  unit.owner = { type: 'Human', isPlayed: true }
  assert.equal(villagerAutonomySuspension(unit), null)
  unit.owner = owner
  unit.followingHero = true
  assert.equal(villagerAutonomySuspension(unit), 'player-control')
})

test('exhausted RPG work stops instead of searching for replacement resources', () => {
  const forbidden = () => {
    throw new Error('must not search for a replacement')
  }
  const { affectNewDest } = loadTsModule('app/classes/unit/movement/UnitAffectNewDest.ts', {
    mocks: {
      './UnitMovementHelpers': {},
      '../../../lib/units/targetPursuit': { updateTargetPursuit: () => false },
      '../../../lib': {
        findInstancesInSight: forbidden,
        getClosestInstanceWithPath: forbidden,
        resumeVillagerAutonomy: forbidden,
      },
    },
  })
  let stopped = false
  const unit = {
    type: 'Villager',
    owner: village(),
    action: 'farm',
    work: 'farmer',
    autonomousJob: 'food',
    dest: { type: 'Wheat', family: 'resource', quantity: 0 },
    stop() {
      stopped = true
    },
  }
  affectNewDest(unit)
  assert.equal(stopped, true)
  assert.equal(unit.autonomousJob, null)
  assert.equal(unit.work, null)
})

test('RPG farmers ignore young crops and choose harvestable wheat instead of retrying a refused order', () => {
  const { context, orders, system } = ambientHarness('village')
  const young = { type: 'Wheat', i: 16, j: 15, quantity: 10, sprite: { currentFrame: 0, textures: [0, 1, 2] } }
  const mature = { type: 'Wheat', i: 14, j: 15, quantity: 10, sprite: { currentFrame: 2, textures: [0, 1, 2] } }
  context.map.grid[16][15].has = young
  context.map.grid[14][15].has = mature
  system.update()
  assert.equal(orders[0].type, 'farm')
  assert.equal(orders[0].cell, mature)
  mature.sprite.currentFrame = 0
  context.scheduler.elapsedMs += 60000
  system.update()
  assert.equal(orders.at(-1).type, 'walk', 'workers stay active while all crops are growing')
})

test('RPG workers follow village activation even off camera and never enumerate a sleeping village', () => {
  const { context, owner, orders, system } = ambientHarness('village')
  context.controls.getViewportMetrics = () => ({
    visibleLeft: 10000,
    visibleTop: 10000,
    visibleWidth: 100,
    visibleHeight: 100,
  })
  system.update()
  assert.equal(orders.length, 1)
  owner.distant = true
  Object.defineProperty(owner, 'units', {
    get() {
      assert.fail('sleeping village units must not be inspected')
    },
  })
  system.update()
  assert.equal(orders.length, 1)
})
