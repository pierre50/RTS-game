const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const options = {
  moduleCache: new Map(),
  mocks: {
    './villagerKnownTargets': { knownConstructionTargets: unit => unit.owner.buildings },
    '../visuals/unitSpriteAssets': { applyUnitActivitySpritesheets() {} },
    '../grid/queries': { getClosestInstanceWithPath: (_unit, candidates) => ({ instance: candidates[0] }) },
    '../../lib/audio/sound': { playAudibleSoundCue() {} },
    '../BuildingInteriorSpaceSystem': {},
    '../spacePortal/SpacePortalSystem': {},
    '../../../services/BuildingInteriorSpaceSystem': {},
    '../../services/BuildingInteriorSpaceSystem': {},
    '../../services/rest/UnitRestLifecycle': {},
  },
}
const load = path => loadTsModule(path, options)
const { assignVillagerAutonomy } = load('app/lib/units/autonomy/villagerAutonomy.ts')
const { markVillagerAutonomyTargetRejected } = load('app/lib/units/autonomy/villagerAutonomyTargeting.ts')
const { ResourceDeliverySystem } = load('app/screens/game/GameResourceDelivery.ts')
const { planCollectiveTasks } = load('app/lib/economy/collectiveTasks.ts')
const { collectiveVillageEventSnapshot, settleCollectiveVillageEvents, hasCollectiveVillageEvent } = load(
  'app/services/CollectiveVillageEvents.ts'
)
const { isDeliveryTargetRejected } = load('app/lib/resources/resourceDeliveryRecovery.ts')
const { consumeVillageWorkChange } = load('app/lib/units/village/villageWorkEvents.ts')

test('construction tries a farther site after a refused route, including on subsequent retries', () => {
  const near = { type: 'House', label: 'blocked', i: 1, j: 0 }
  const far = { type: 'House', label: 'reachable', i: 4, j: 0 }
  const attempts = []
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 0,
    j: 0,
    owner: { isPlayed: true, buildings: [near, far] },
    context: { dayNight: { state: { hour: 10 } } },
    getActionCondition: () => true,
    sendToBuilding(target) {
      attempts.push(target.label)
      if (target === near) return false
      this.dest = target
      this.action = 'build'
      return true
    },
  }
  assert.equal(assignVillagerAutonomy(unit, 'construction'), true)
  assert.deepEqual(attempts, ['blocked', 'reachable'])
  markVillagerAutonomyTargetRejected(unit, near)
  attempts.length = 0
  assert.equal(assignVillagerAutonomy(unit, 'construction', { preserveRejectedTargets: true }), true)
  assert.deepEqual(attempts, ['reachable'])
})

function deliveryFixture(phase = 'toBuilding') {
  let tick
  const scheduler = {
    elapsedMs: 0,
    add(fn) {
      tick = fn
      return 1
    },
    remove() {},
  }
  const context = { scheduler, dayNight: { state: { hour: 10 } } }
  const site = {
    type: 'TownCenter',
    label: 'site',
    i: 10,
    j: 10,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 101,
    constructionMaterials: { cost: { stone: 10 }, consumed: {}, delivered: {} },
  }
  const depot = {
    family: 'building',
    type: 'StoragePit',
    label: 'depot',
    i: 12,
    j: 10,
    isBuilt: true,
    inventory: { resources: { stone: 10 } },
  }
  const unit = {
    type: 'Villager',
    label: 'worker',
    i: 10,
    j: 9,
    context,
    collectiveTask: 'construction',
    autonomousJob: 'construction',
    inventory: { resources: { wheat: 12 } },
    resourceDeliveryState: { phase, building: depot, chest: depot, pickup: { stone: 10 } },
    sendToEvt() {
      return false
    },
    stop() {
      assert.equal(this.autonomousJob, null)
      this.inactif = true
      this.dest = null
      this.action = null
    },
  }
  const owner = { isPlayed: true, units: [unit], buildings: [site, depot], population: 1 }
  unit.owner = owner
  context.players = [owner]
  new ResourceDeliverySystem(context)
  return {
    unit,
    owner,
    depot,
    scheduler,
    tick: time => {
      scheduler.elapsedMs = time
      tick()
    },
  }
}

for (const phase of ['toBuilding', 'toChest']) {
  test(`stalled ${phase} pickup releases the job, avoids the failed depot and later retries it`, () => {
    const { unit, owner, depot, scheduler, tick } = deliveryFixture(phase)
    tick(14999)
    assert.ok(unit.resourceDeliveryState)
    tick(15000)
    assert.equal(unit.resourceDeliveryState, null)
    assert.equal(unit.inactif, true)
    assert.equal(unit.collectiveTask, 'construction')
    assert.equal(consumeVillageWorkChange(owner), true)
    assert.equal(isDeliveryTargetRejected(unit, depot), true)
    assert.deepEqual(unit.inventory.resources, { wheat: 12 })
    assert.equal(depot.inventory.resources.stone, 10)
    assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'stone')
    const alternate = { ...depot, label: 'alternate', i: 14, inventory: { resources: { stone: 5 } } }
    owner.buildings.push(alternate)
    assert.equal(planCollectiveTasks(owner, [unit]).get(unit).pickup.building, alternate)
    owner.buildings.pop()
    settleCollectiveVillageEvents(owner)
    scheduler.elapsedMs = 45000
    assert.equal(isDeliveryTargetRejected(unit, depot), false)
    assert.equal(hasCollectiveVillageEvent(owner), true)
    assert.equal(planCollectiveTasks(owner, [unit]).get(unit).pickup.building, depot)
  })
}

test('a moving delivery can take longer than the stall timeout', () => {
  const { unit, tick } = deliveryFixture()
  for (let time = 10000; time <= 60000; time += 10000) {
    unit.i++
    tick(time)
    assert.ok(unit.resourceDeliveryState)
  }
})

test('a stalled deposit tries another depot and preserves its return task and cargo', () => {
  const { unit, owner, depot, tick } = deliveryFixture()
  const alternate = { ...depot, label: 'alternate', i: 14, owner }
  depot.owner = owner
  owner.buildings = [depot, alternate]
  unit.collectiveTask = null
  unit.inventory.resources = { wood: 20, wheat: 12 }
  delete unit.resourceDeliveryState.pickup
  const returnTask = { action: 'chopwood', work: 'woodcutter', autonomousJob: 'wood', dest: { type: 'Tree' } }
  unit.resourceDeliveryState.returnTask = returnTask
  let sent
  unit.sendToDelivery = (building, task) => {
    sent = { building, task }
    return true
  }
  tick(15000)
  assert.equal(sent.building, alternate)
  assert.equal(sent.task, returnTask)
  assert.deepEqual(unit.inventory.resources, { wood: 20, wheat: 12 })
})

test('delivery phases and active interior transfers reset the stall timer', () => {
  const { unit, tick } = deliveryFixture()
  unit.spacePortalState = {}
  tick(30000)
  unit.spacePortalState = null
  unit.resourceDeliveryState.phase = 'toChest'
  tick(31000)
  tick(45999)
  assert.ok(unit.resourceDeliveryState)
  tick(46000)
  assert.equal(unit.resourceDeliveryState, null)
})

test('new recoverable depot material triggers planning within the same stock deficit bucket', () => {
  const { unit, owner, depot } = deliveryFixture()
  unit.resourceDeliveryState = null
  unit.inactif = true
  depot.inventory.resources = {}
  settleCollectiveVillageEvents(owner)
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).job, 'stone')
  depot.inventory.resources.stone = 1
  assert.equal(hasCollectiveVillageEvent(owner), true)
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit).pickup.building, depot)
  const snapshot = collectiveVillageEventSnapshot(owner)
  depot.inventory.resources.stone = 2
  assert.equal(collectiveVillageEventSnapshot(owner), snapshot)
  depot.inventory.resources.stone = 0
  assert.notEqual(collectiveVillageEventSnapshot(owner), snapshot)
})
