const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const moduleCache = new Map()
const { notifyVillageStateChanged } = loadTsModule('app/lib/units/village/villageStateEvents.ts', { moduleCache })
const { updateCollectiveVillage, flushCollectiveVillageWork } = loadTsModule('app/services/CollectiveVillageWork.ts', {
  moduleCache,
  mocks: {
    '../lib/units/autonomy/villagerAutonomy': {
      assignVillagerAutonomy(unit, job) {
        unit.orders.push(job)
        if (unit.unavailableJobs?.includes(job)) {
          unit.autonomyBlockedJob = job
          return false
        }
        unit.autonomyBlockedJob = null
        unit.autonomousJob = job
        unit.inactif = false
        unit.action = 'chopwood'
        unit.dest = { type: 'Tree' }
        return true
      },
    },
    '../lib/units/autonomy/villagerKnownTargets': { knownResources: () => [], knownFoodTargets: () => [] },
  },
})
function fixture() {
  const context = { dayNight: { state: { hour: 10, minute: 0 } } }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 10,
    context,
    inactif: true,
    inventory: { resources: { wheat: 12 } },
    orders: [],
    stop() {
      this.inactif = true
      this.dest = null
      this.action = null
    },
    sendToBuilding(site) {
      this.orders.push('construction')
      this.dest = site
      this.action = 'build'
      this.inactif = false
      return true
    },
  }
  const center = {
    type: 'TownCenter',
    label: 'home',
    i: 5,
    j: 5,
    isBuilt: true,
    inventory: { resources: { wheat: 100 } },
  }
  const site = {
    type: 'House',
    label: 'house',
    i: 12,
    j: 12,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { wood: 10 }, delivered: {}, consumed: {} },
  }
  const owner = {
    type: 'Human',
    isPlayed: true,
    population: 1,
    populationMax: 1,
    units: [unit],
    buildings: [center, site],
  }
  unit.owner = owner
  return { owner, unit, site, center }
}

test('idle human villagers gather for their project, build when supplied, then stop', () => {
  const { owner, unit, site, center } = fixture()
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood'])
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood'])
  unit.inventory.resources.wood = 10
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood', 'construction'])
  site.isBuilt = true
  updateCollectiveVillage(owner)
  assert.equal(unit.inactif, true)
  assert.equal(unit.collectiveTask, null)
  assert.equal(unit.autonomousJob, null)
})

test('explicit gathering, training and following the hero are not reassigned', () => {
  for (const extra of [
    { autonomousJob: 'stone', inactif: false, action: 'minestone' },
    { trainingTargetType: 'Fantassin', collectiveTask: 'wood' },
    { followingHero: true, collectiveTask: 'wood' },
    { action: 'attack', collectiveTask: 'wood' },
    { action: 'flee', collectiveTask: 'wood' },
    { combatMode: 'recover', collectiveTask: 'wood' },
    { followAssistIntent: { target: {} }, collectiveTask: 'wood' },
  ]) {
    const { owner, unit } = fixture()
    Object.assign(unit, extra)
    updateCollectiveVillage(owner)
    assert.deepEqual(unit.orders, [])
  }
})

test('a villager ordered to build can fetch missing materials rather than wait forever', () => {
  const { owner, unit, site } = fixture()
  Object.assign(unit, { autonomousJob: 'construction', dest: site, inactif: false, action: 'build', work: 'builder' })
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood'])
})

test('a failed automatic assignment remains collective while waiting for a target', () => {
  const { owner, unit } = fixture()
  const { updateCollectiveVillage: update } = loadTsModule('app/services/CollectiveVillageWork.ts', {
    mocks: {
      '../lib/units/autonomy/villagerAutonomy': {
        assignVillagerAutonomy(unit, job) {
          unit.autonomousJob = job
          return false
        },
      },
    },
  })
  update(owner)
  assert.equal(unit.collectiveTask, 'wood')
  unit.inventory.resources.wood = 10
  update(owner)
  assert.equal(unit.collectiveTask, 'construction')
})

test('idle villagers of the hero replenish depot defaults without a construction site', () => {
  const { owner, unit, site } = fixture()
  site.isBuilt = true
  owner.age = 1
  const pit = {
    type: 'StoragePit',
    i: 8,
    j: 8,
    isBuilt: true,
    inventory: { resources: { wood: 145, stone: 90, gold: 30, copper: 15, tin: 6, iron: 9 } },
  }
  owner.buildings.push(pit)
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood'])
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood'])
  pit.inventory.resources.wood = 150
  updateCollectiveVillage(owner)
  assert.equal(unit.collectiveTask, null)
  assert.equal(unit.inactif, true)
})

test('a builder gathering wood finishes the batch instead of returning after each item', () => {
  const { owner, unit, site } = fixture()
  site.type = 'TownCenter'
  site.constructionMaterials.cost.wood = 150
  unit.inventory.resources.wheat = 12
  updateCollectiveVillage(owner)
  const tree = unit.dest
  tree.hitPoints = 6
  // Felling an uncut tree does not trigger a return to the town-center construction site.
  for (let hp = 5; hp >= 0; hp--) {
    tree.hitPoints = hp
    updateCollectiveVillage(owner)
    assert.equal(unit.dest, tree)
  }
  // The twelve provisions occupy bag slots; eighteen wood completes this trip.
  for (let wood = 1; wood < 18; wood++) {
    unit.inventory.resources.wood = wood
    updateCollectiveVillage(owner)
    assert.equal(unit.dest, tree)
  }
  unit.inventory.resources.wood = 18
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, site)
  assert.deepEqual(unit.orders, ['wood', 'construction'])
  unit.inventory.resources.wood = 0
  site.constructionMaterials.delivered.wood = 18
  updateCollectiveVillage(owner)
  assert.equal(unit.collectiveTask, 'wood')
  const nextTree = unit.dest
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, nextTree)
})

test('gatherers bring a partial bag when it covers the actual remaining construction need', () => {
  const { owner, unit, site } = fixture()
  updateCollectiveVillage(owner)
  unit.inventory.resources.wood = 10
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, site)
  assert.deepEqual(unit.orders, ['wood', 'construction'])
})

test('a new site interrupts an outdoor stock delivery and keeps cargo for building', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources.wood = 10
  unit.action = 'delivery'
  unit.inactif = false
  unit.collectiveTask = 'wood'
  unit.resourceDeliveryState = { phase: 'toBuilding', building: { type: 'StoragePit' } }
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, site)
  assert.equal(unit.resourceDeliveryState, null)
  assert.equal(unit.inventory.resources.wood, 10)
})

test('urgent food precedes construction but a full daily ration does not trigger comfort restocking', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources = { wheat: 1, wood: 10 }
  updateCollectiveVillage(owner)
  assert.equal(unit.collectiveTask, 'food')
  unit.inventory.resources.wheat = 4
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, site)
  assert.equal(unit.collectiveTask, 'construction')
})

test('combat and following still block reassignment of an ongoing stock delivery', () => {
  for (const extra of [{ followingHero: true }, { action: 'attack' }, { combatMode: 'recover' }]) {
    const { owner, unit } = fixture()
    unit.inventory.resources.wood = 10
    unit.resourceDeliveryState = { phase: 'toBuilding', building: { type: 'StoragePit' } }
    Object.assign(unit, extra)
    updateCollectiveVillage(owner)
    assert.deepEqual(unit.orders, [])
    assert.ok(unit.resourceDeliveryState)
  }
})

test('a rejected resource assignment tries another useful construction material immediately', () => {
  const { owner, unit, site } = fixture()
  site.constructionMaterials.cost = { wood: 10, stone: 10 }
  unit.unavailableJobs = ['wood']
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood', 'stone'])
  assert.equal(unit.collectiveTask, 'stone')
  assert.equal(unit.autonomyBlockedJob, null)
})

test('rejecting every resource remains bounded and leaves a truthful blocked state', () => {
  const { owner, unit, site } = fixture()
  site.constructionMaterials.cost = { wood: 10, stone: 10 }
  unit.unavailableJobs = ['wood', 'stone', 'food']
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood', 'stone'])
  assert.equal(unit.inactif, true)
  assert.equal(unit.autonomyBlockedJob, 'stone')
})

test('human and AI workers gather the remaining trap fiber then resume construction', () => {
  for (const type of ['Human', 'AI']) {
    const { owner, unit, site } = fixture()
    owner.type = type
    site.type = 'Trap'
    site.constructionMaterials = { cost: { wood: 5, fiber: 2 }, consumed: { wood: 5 }, delivered: {} }
    updateCollectiveVillage(owner)
    assert.equal(unit.collectiveTask, 'fiber')
    assert.deepEqual(unit.orders, ['food'])
    unit.inventory.resources.fiber = 2
    updateCollectiveVillage(owner)
    assert.equal(unit.collectiveTask, 'construction')
    assert.equal(unit.dest, site)
  }
})

test('unchanged ticks and movement never reassign a working villager', () => {
  const { owner, unit } = fixture()
  flushCollectiveVillageWork(owner, 0)
  for (let tick = 1; tick <= 60; tick++) {
    unit.i += 0.01
    flushCollectiveVillageWork(owner, tick * 1000)
  }
  assert.deepEqual(unit.orders, ['wood'])
})

test('a new construction and its completion wake the collective planner without waiting for an audit', () => {
  const { owner, unit, site } = fixture()
  owner.buildings.pop()
  flushCollectiveVillageWork(owner, 0)
  assert.deepEqual(unit.orders, [])
  owner.buildings.push(site)
  notifyVillageStateChanged(owner)
  flushCollectiveVillageWork(owner, 1000)
  assert.deepEqual(unit.orders, ['wood'])
  site.isBuilt = true
  notifyVillageStateChanged(owner)
  flushCollectiveVillageWork(owner, 2000)
  assert.equal(unit.collectiveTask, null)
  assert.equal(unit.autonomousJob, null)
})

test('reassignment clears the old autonomy before stopping, preventing an old-order restart', () => {
  const { owner, unit } = fixture()
  updateCollectiveVillage(owner)
  unit.inventory.resources.wood = 10
  unit.stop = function () {
    assert.equal(this.autonomousJob, null)
    this.inactif = true
    this.dest = null
    this.action = null
  }
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.orders, ['wood', 'construction'])
})

test('full wood bag frees exactly one slot to gather the missing stone', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources = { wheat: 4, wood: 26 }
  unit.collectiveTask = 'wood'
  unit.autonomousJob = 'wood'
  unit.inactif = false
  site.constructionMaterials.cost = { stone: 10 }
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.inventory.resources, { wheat: 4, wood: 25 })
  assert.equal(unit.collectiveTask, 'stone')
  assert.deepEqual(unit.orders, ['stone'])
  updateCollectiveVillage(owner)
  assert.equal(unit.inventory.resources.wood, 25)
  unit.inventory.resources.stone = 1
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, site)
  assert.equal(unit.inventory.resources.wood, 25)
})

test('unavailable replacement work never consumes the blocked cargo', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources = { wheat: 4, wood: 26 }
  unit.unavailableJobs = ['stone', 'food']
  site.constructionMaterials.cost = { stone: 10 }
  updateCollectiveVillage(owner)
  assert.deepEqual(unit.inventory.resources, { wheat: 4, wood: 26 })
})

test('full useful cargo goes to another local construction without deletion', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources = { wheat: 4, wood: 26 }
  site.constructionMaterials.cost = { stone: 10 }
  const other = { ...site, label: 'other', constructionMaterials: { cost: { wood: 20 }, delivered: {}, consumed: {} } }
  owner.buildings.push(other)
  updateCollectiveVillage(owner)
  assert.equal(unit.dest, other)
  assert.equal(unit.inventory.resources.wood, 26)
})

test('full bags with only food or equipment are never discarded', () => {
  for (const resources of [{ wheat: 30 }, {}]) {
    const { owner, unit, site } = fixture()
    unit.inventory.resources = resources
    if (!Object.keys(resources).length) unit.inventory.equipment = Array(30).fill('sword')
    site.constructionMaterials.cost = { stone: 10 }
    const before = structuredClone(unit.inventory)
    updateCollectiveVillage(owner)
    assert.deepEqual(unit.inventory, before)
  }
})

test('an available depot receives the full bag instead of deleting resources', () => {
  const { owner, unit, site } = fixture()
  unit.inventory.resources = { wheat: 4, wood: 26 }
  site.constructionMaterials.cost = { stone: 10 }
  owner.buildings.push({
    family: 'building',
    type: 'StoragePit',
    owner,
    i: 11,
    j: 11,
    isBuilt: true,
    inventory: { resources: {} },
  })
  let deliveries = 0
  unit.sendToDelivery = () => {
    deliveries++
    return true
  }
  updateCollectiveVillage(owner)
  assert.equal(unit.inventory.resources.wood, 26)
  assert.equal(deliveries, 1)
  assert.deepEqual(unit.orders, [])
})

test('hero and followers never discard resources through collective work', () => {
  for (const mode of [{ controlMode: 'hero' }, { followingHero: true }]) {
    const { owner, unit, site } = fixture()
    Object.assign(unit, mode)
    unit.inventory.resources = { wood: 50 }
    site.constructionMaterials.cost = { stone: 10 }
    updateCollectiveVillage(owner)
    assert.equal(unit.inventory.resources.wood, 50)
    assert.deepEqual(unit.orders, [])
  }
})
