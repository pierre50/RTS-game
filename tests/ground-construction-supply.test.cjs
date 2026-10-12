const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { simulateOfflineWorld } = loadTsModule('app/services/world/offline/OfflineWorldSimulation.ts')
const { offlineResourceWork } = loadTsModule('app/services/world/work/OfflineWorkResources.ts')
const { canAutonomouslyWork } = loadTsModule('app/lib/equipment/workTools.ts')

function fixture(stock = {}) {
  const unit = {
    type: 'Villager',
    label: 'builder',
    i: 10,
    j: 10,
    inactif: true,
    autonomousJob: 'construction',
    inventory: { toolsInitialized: true, activeWeapons: { tool: 'hammer_ceramic' }, resources: { wheat: 12 } },
  }
  const site = {
    type: 'House',
    label: 'site',
    i: 12,
    j: 12,
    isBuilt: false,
    hitPoints: 1,
    totalHitPoints: 11,
    constructionMaterials: { cost: { wood: 2, stone: 2 }, delivered: {}, consumed: {} },
  }
  const center = { type: 'TownCenter', label: 'town', i: 5, j: 5, isBuilt: true, inventory: { resources: stock } }
  const player = {
    type: 'Human',
    label: 'player',
    units: [unit],
    buildings: [
      center,
      site,
      { type: 'StoragePit', label: 'depot', i: 7, j: 7, isBuilt: true, inventory: { resources: stock } },
    ],
  }
  const resources = Array.from({ length: 8 }, (_, n) => ({
    type: n < 4 ? 'GroundWood' : 'GroundStone',
    label: `ground-${n}`,
    i: 15 + n,
    j: 12,
    quantity: 1,
    totalQuantity: 1,
    isNaturalResource: true,
  }))
  const state = { players: [player], resources, animals: [], camera: { x: 0, y: 0 } }
  const options = {
    fromElapsedMs: 0,
    toElapsedMs: 120000,
    terrain: Array.from({ length: 40 }, () => Array.from({ length: 40 }, () => ({ category: 'Land' }))),
    unitConfig: () => ({ speed: 1.5, gatherAmount: { forager: 1 } }),
    buildingConfig: () => ({ size: 1, constructionTime: 4, totalHitPoints: 11 }),
    cycleMs: () => 1000,
    wheatMatureFrame: 5,
    runtimeOwnsMeals: true,
    runtimeOwnsDailyEvents: true,
    runtimeOwnsTraining: true,
  }
  return { unit, site, player, state, options }
}

function buildUntilComplete(f) {
  const gathered = {}
  for (let from = 0; from < 120000 && !f.site.isBuilt; from += 1000) {
    const report = simulateOfflineWorld(f.state, { ...f.options, fromElapsedMs: from, toElapsedMs: from + 1000 })
    for (const [key, amount] of Object.entries(report.gathered)) gathered[key] = (gathered[key] ?? 0) + amount
  }
  return { gathered }
}

test('a builder can gather ground materials without gaining access to trees or mines', () => {
  const f = fixture()
  assert.equal(canAutonomouslyWork(f.unit, 'wood'), false)
  assert.equal(canAutonomouslyWork(f.unit, 'wood', true), true)
  for (const [job, ground, deposit] of [
    ['wood', 'GroundWood', 'Tree'],
    ['stone', 'GroundStone', 'Stone'],
  ]) {
    f.unit.autonomousJob = job
    assert.equal(offlineResourceWork(f.player, f.unit, { type: ground, quantity: 1 }, 5), 'forager')
    assert.equal(offlineResourceWork(f.player, f.unit, { type: deposit, quantity: 20 }, 5), undefined)
  }
  f.unit.inventory.activeWeapons.tool = 'hammer_ceramic~condition:0'
  assert.equal(canAutonomouslyWork(f.unit, 'wood', true), false)
  assert.equal(offlineResourceWork(f.player, f.unit, { type: 'GroundStone', quantity: 1 }, 5), undefined)
})

test('an equipped worker collects finite wood and stones, then consumes them on the project', () => {
  const f = fixture()
  f.unit.inventory.equipment = ['axe_ceramic', 'pickaxe_ceramic']
  const report = buildUntilComplete(f)
  assert.equal(f.site.isBuilt, true)
  assert.deepEqual(f.site.constructionMaterials.consumed, { wood: 2, stone: 2 })
  assert.equal(report.gathered.wood, 2)
  assert.equal(report.gathered.stone, 2)
  assert.equal(f.state.resources.length, 4)
  assert.equal(f.state.naturalResourceRespawnSlots.length, 4)
})

test('available village stock is used before harvesting ground items', () => {
  const f = fixture({ wood: 2, stone: 2 })
  const report = buildUntilComplete(f)
  assert.equal(f.site.isBuilt, true)
  assert.equal(report.gathered.wood ?? 0, 0)
  assert.equal(report.gathered.stone ?? 0, 0)
  assert.equal(f.state.resources.length, 8)
})

test('unreachable ground items cannot supply a project', () => {
  const f = fixture()
  f.options.isKnown = () => false
  simulateOfflineWorld(f.state, f.options)
  assert.equal(f.site.isBuilt, false)
  assert.equal(f.state.resources.length, 8)
})

test('live autonomy considers nearby ground supplies but does not send a hammer worker to trees', () => {
  const targets = [
    { type: 'Tree', i: 1, j: 1, quantity: 100 },
    { type: 'GroundWood', i: 2, j: 1, quantity: 1 },
    { type: 'GroundStone', i: 3, j: 1, quantity: 1 },
  ]
  const { assignVillagerAutonomy, hasVillagerAutonomyTarget } = loadTsModule(
    'app/lib/units/autonomy/villagerAutonomy.ts',
    {
      mocks: {
        './villagerKnownTargets': {
          knownResources: (_unit, type) =>
            targets.filter(target => (Array.isArray(type) ? type : [type]).includes(target.type)),
        },
        '../village/villagerSchedule': { shouldVillagerWork: () => true },
        './villagerAutonomyTargeting': {
          clearVillagerAutonomyTargetRejections() {},
          villagerJobCandidateLimit: () => 12,
          *planVillagerJobCandidates(_unit, _job, candidates) {
            assert.ok(candidates.every(candidate => candidate.action === 'forageberry'))
            return candidates[0].send(candidates[0].target)
          },
        },
      },
    }
  )
  const f = fixture()
  f.unit.sendToBerrybush = target => {
    f.unit.dest = target
    return true
  }
  assert.equal(hasVillagerAutonomyTarget(f.unit, 'wood'), true)
  assert.equal(assignVillagerAutonomy(f.unit, 'wood'), true)
  assert.equal(f.unit.dest.type, 'GroundWood')
  assert.equal(assignVillagerAutonomy(f.unit, 'stone'), true)
  assert.equal(f.unit.dest.type, 'GroundStone')
  f.unit.inventory.activeWeapons.tool = 'hammer_ceramic~condition:0'
  assert.equal(assignVillagerAutonomy(f.unit, 'wood'), false)
})

test('ground collection commands keep the wood/stone job instead of switching to food', () => {
  const { UnitCommands } = loadTsModule('app/classes/unit/UnitCommands.ts', { mocks: { '../../lib': {} } })
  for (const [type, job] of [
    ['GroundWood', 'wood'],
    ['GroundStone', 'stone'],
  ]) {
    const unit = { autonomousJob: job }
    const commands = Object.create(UnitCommands.prototype)
    commands.unit = unit
    commands.commonSendTo = () => {
      unit.autonomousJob = 'food'
      return true
    }
    assert.equal(commands.sendToBerrybush({ type }, true), true)
    assert.equal(unit.autonomousJob, job)
  }
})

test('ground gathering consumes one real item without wearing the equipped hammer', () => {
  const { gatherOffline } = loadTsModule('app/services/world/work/OfflineWorkImpacts.ts')
  const f = fixture()
  f.unit.autonomousJob = 'wood'
  f.unit.collectiveTask = 'wood'
  f.unit.action = 'minestone'
  const report = { gathered: {}, resourcesDepleted: 0 }
  const target = f.state.resources[0]
  gatherOffline(
    {
      state: f.state,
      player: f.player,
      playerIndex: 0,
      unit: f.unit,
      target,
      day: 1,
      spatial: { release() {} },
      rules: f.options,
      report,
      config: { gatherAmount: { forager: 1 } },
      cycle: 1000,
      work: 'forager',
      stored: 'wood',
    },
    450
  )
  assert.equal(f.unit.inventory.resources.wood, 1)
  assert.equal(f.unit.inventory.activeWeapons.tool, 'hammer_ceramic')
  assert.equal(target.quantity, 0)
  assert.equal(f.state.resources.includes(target), false)
  assert.equal(f.state.naturalResourceRespawnSlots.length, 1)
})

test('moving between branches does not trigger a food-job delivery, and return trips retain the material job', () => {
  const depot = { type: 'StoragePit' }
  const { getDeliveryBeforeGatherJobSwitch } = loadTsModule('app/classes/unit/UnitResourceDeliveryCommands.ts', {
    mocks: {
      '../../lib': { getAutonomyJobForWork: () => 'food' },
      '../../lib/economy/collectiveTasks': { readyConstructionSite: () => undefined },
      '../../lib/units/unitControl': { isHeroControlled: () => false },
      '../../lib/resources/resourceDelivery': {
        unitHasDeliverableResources: () => true,
        findResourceDeliveryTarget: () => depot,
      },
    },
  })
  const unit = { type: 'Villager', autonomousJob: 'wood' }
  assert.equal(getDeliveryBeforeGatherJobSwitch(unit, { type: 'GroundWood' }, 'forager', 'forageberry'), null)
  unit.autonomousJob = 'stone'
  const transfer = getDeliveryBeforeGatherJobSwitch(unit, { type: 'GroundWood' }, 'forager', 'forageberry')
  assert.equal(transfer.target, depot)
  assert.equal(transfer.returnTask.autonomousJob, 'wood')
})

test('villagers collect ground wood by hand while the hero retains its E interaction', () => {
  const { getResourceActionConditions } = loadTsModule('app/lib/combat/resourceActionConditions.ts')
  const target = { type: 'GroundWood', family: 'resource', quantity: 1 }
  assert.equal(getResourceActionConditions({ type: 'Villager' }, target).forageberry(), true)
  assert.equal(getResourceActionConditions({ type: 'Hero' }, target).forageberry(), false)
  target.quantity = 0
  assert.equal(getResourceActionConditions({ type: 'Villager' }, target).forageberry(), false)
})
