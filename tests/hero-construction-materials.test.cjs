const { workerInventory } = require('./helpers/workerInventory.cjs')
const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
function fixture(resources = {}, cost = { wood: 100, stone: 50 }, extraMocks = {}) {
  const calls = { animation: 0, sound: 0, fragments: 0, energy: 0, stopped: 0, messages: [] }
  const site = {
    family: 'building',
    type: 'House',
    hitPoints: 101,
    constructionProgress: 0,
    constructionWorkRequired: 101,
    totalHitPoints: 101,
    constructionTime: 101,
    constructionMaterials: { cost, consumed: {}, delivered: {} },
  }
  const unit = {
    controlMode: 'hero',
    dest: site,
    action: 'build',
    sprite: {},
    inventory: { ...workerInventory('hammer_ceramic'), resources },
    getActionCondition: () => true,
    stop: () => calls.stopped++,
    context: { menu: { showMessage: (message, severity) => calls.messages.push([message, severity]) } },
  }
  const options = {
    moduleCache: new Map(),
    mocks: {
      '../../../lib': { showHitPointGainFeedback() {}, SLASH_IMPACT_FRAME: 1 },
      '../../../lib/units/unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' },
      '../../../lib/units/unitEnergy': {
        spendOrWaitForEnergy: () => {
          calls.energy++
          return true
        },
      },
      '../../../lib/units/unitExperience': {
        getBuildRateXpMultiplier: () => 1,
        grantUnitXp() {},
        XP_CATEGORIES: { building: 'building' },
      },
      '../../../lib/entities/workImpactFragments': { spawnWorkImpactFragments: () => calls.fragments++ },
      '../UnitBuildVisuals': { shouldSyncBuildHealthDisplay: () => false },
      '../UnitManualHeroWork': { stopManualHeroAction: unit => unit.stop() },
      '../UnitResourceGathering': { isBuildingEntity: target => target?.family === 'building' },
      './UnitWorkSwing': { getWorkAnimationReleaseFrame: () => 1, finishWorkSwing() {} },
      ...extraMocks,
    },
  }
  const load = path => loadTsModule(path, options)
  const { handleBuildAction } = load('app/classes/unit/work/UnitBuildingAction.ts')
  const runtime = {
    unit,
    prepareLoopingWorkAction: () => {
      calls.animation++
      return true
    },
    bindWorkImpact: (_frame, fn) => {
      runtime.impact = fn
    },
    ensureWorkContact: () => true,
    getWorkSound: () => 'build',
    playSound: () => calls.sound++,
  }
  const deposit = () => {
    const { deliverConstructionMaterials } = load('app/lib/economy/constructionMaterials.ts')
    return deliverConstructionMaterials(site, [unit.inventory.resources])
  }
  return { unit, site, calls, runtime, load, deposit, start: () => handleBuildAction(runtime) }
}
test('an unfunded hero build stops before animation and reports the exact missing materials', () => {
  const f = fixture()
  f.start()
  assert.equal(f.calls.animation, 0)
  assert.equal(f.calls.energy, 0)
  assert.equal(f.calls.sound, 0)
  assert.equal(f.calls.fragments, 0)
  assert.equal(f.calls.stopped, 1)
  assert.match(f.calls.messages[0][0], /100 Bois, 50 Pierre/)
  assert.equal(f.calls.messages[0][1], 'warning')
  assert.equal(f.site.hitPoints, 101)
})
test('striking an unfunded site leaves hero cargo in the bag for the transfer menu', () => {
  const f = fixture({ wood: 20 })
  f.start()
  assert.equal(f.site.constructionProgress, 0)
  assert.equal(f.unit.inventory.resources.wood, 20)
  assert.deepEqual(f.site.constructionMaterials.delivered, {})
  assert.deepEqual(f.site.constructionMaterials.consumed, {})
  assert.equal(f.calls.animation, 0)
  assert.equal(f.calls.energy, 0)
  assert.equal(f.calls.sound, 0)
  assert.match(f.calls.messages[0][0], /100 Bois, 50 Pierre/)
})
test('complete delivery starts animation but only a work impact advances construction', () => {
  const f = fixture({ wood: 100, stone: 50 })
  f.deposit()
  f.start()
  assert.equal(f.site.constructionProgress, 0)
  assert.equal(f.calls.animation, 1)
  assert.deepEqual(f.site.constructionMaterials.consumed, {})
  f.runtime.impact()
  assert.equal(f.site.constructionProgress, 1 / 101)
  assert.equal(f.calls.energy, 1)
  assert.equal(f.calls.sound, 1)
  assert.deepEqual(f.site.constructionMaterials.consumed, { wood: 100, stone: 50 })
})
test('a worker out of contact cannot deliver materials remotely', () => {
  const f = fixture({ wood: 100, stone: 50 })
  f.runtime.ensureWorkContact = () => false
  f.start()
  assert.deepEqual(f.site.constructionMaterials.delivered, {})
  assert.deepEqual(f.unit.inventory.resources, { wood: 100, stone: 50 })
  assert.equal(f.calls.animation, 0)
})
test('legacy paid construction and repairs still allow work without charging materials again', () => {
  const f = fixture()
  delete f.site.constructionMaterials
  f.start()
  f.runtime.impact()
  assert.equal(f.site.hitPoints, 101)
  assert.equal(f.calls.messages.length, 0)
})

test('construction reserves the whole recipe and leaves only excess cargo in the bag', () => {
  for (const controlMode of ['hero', 'npc']) {
    const f = fixture({ wood: 120, stone: 60 })
    f.unit.controlMode = controlMode
    if (controlMode === 'hero') f.deposit()
    f.start()
    assert.deepEqual(f.unit.inventory.resources, { wood: 20, stone: 10 })
    assert.deepEqual(f.site.constructionMaterials.delivered, { wood: 100, stone: 50 })
    assert.equal(f.site.constructionProgress, 0)
    f.runtime.impact()
    assert.deepEqual(f.site.constructionMaterials.consumed, { wood: 100, stone: 50 })
    assert.equal(
      Object.values(f.site.constructionMaterials.delivered).reduce((a, b) => a + b, 0),
      0
    )
  }
})

test('a villager with no remaining useful material stops without animation', () => {
  const f = fixture({ wood: 20 })
  f.unit.controlMode = 'npc'
  f.site.constructionMaterials.consumed = { wood: 100 }
  f.site.constructionProgress = 100 / 150
  f.start()
  assert.equal(f.calls.animation, 0)
  assert.equal(f.calls.energy, 0)
  assert.equal(f.calls.stopped, 1)
  assert.equal(f.calls.messages.length, 0)
  assert.equal(f.unit.inventory.resources.wood, 20)
})

test('live construction consumes work and materials without healing combat damage', () => {
  const f = fixture({ wood: 4 }, { wood: 4 })
  f.site.constructionWorkRequired = 4
  f.deposit()
  f.start()
  f.runtime.impact()
  assert.equal(f.site.constructionProgress, 0.25)
  f.site.hitPoints -= 20
  for (let impact = 0; impact < 3; impact++) f.runtime.impact()
  assert.equal(f.site.constructionProgress, 1)
  assert.equal(f.site.hitPoints, 81)
  assert.equal(f.site.constructionMaterials.consumed.wood, 4)
})

test('a lone hero finishes each camp site through real work impacts, including trap fiber', () => {
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  for (const type of ['Trap', 'FireCamp', 'Chest']) {
    const config = definitions[type]
    const f = fixture({ ...config.cost }, config.cost)
    Object.assign(f.site, {
      type,
      hitPoints: config.totalHitPoints,
      totalHitPoints: config.totalHitPoints,
      constructionTime: config.constructionTime,
      constructionWorkRequired: config.constructionTime,
    })
    f.deposit()
    f.start()
    for (let impact = 0; impact < 4; impact++) f.runtime.impact()
    assert.equal(f.site.hitPoints, config.totalHitPoints)
    assert.deepEqual(f.site.constructionMaterials.consumed, config.cost)
    assert.equal(f.calls.messages.length, 0)
  }
})

test('an exhausted builder really stops, collects stone and returns to the same town center', () => {
  const stateLib = {}
  const stone = { family: 'resource', type: 'Stone', label: 'stone', i: 14, j: 10, quantity: 100 }
  const f = fixture(
    { wood: 1, wheat: 12 },
    { wood: 1, stone: 1 },
    {
      '../../lib': stateLib,
      '../../lib/hero/heroTools': { applyToolAppearance() {} },
      './UnitActions': { UnitActions: class {} },
      './villagerKnownTargets': {
        knownConstructionTargets: unit => unit.owner.buildings,
        knownResources: (_unit, type) =>
          (Array.isArray(type) ? type.includes('Stone') : type === 'Stone') ? [stone] : [],
        knownFoodTargets: () => [],
      },
    }
  )
  const { unit, site, load } = f
  stateLib.resumeVillagerAutonomy = load('app/lib/units/autonomy/villagerAutonomy.ts').resumeVillagerAutonomy
  const { stopUnit } = load('app/classes/unit/UnitStateHandlers.ts')
  const { flushCollectiveVillageWork } = load('app/services/CollectiveVillageWork.ts')
  const { notifyVillageWorkChanged } = load('app/lib/units/village/villageWorkEvents.ts')
  const owner = {
    type: 'Human',
    config: { units: {} },
    isPlayed: true,
    units: [unit],
    buildings: [site],
    population: 1,
  }
  Object.assign(site, { type: 'TownCenter', label: 'town', i: 10, j: 10, owner })
  const orders = []
  Object.assign(unit, {
    type: 'Villager',
    label: 'worker',
    controlMode: 'npc',
    i: 10,
    j: 9,
    owner,
    autonomousJob: 'construction',
    collectiveTask: 'construction',
    work: 'builder',
    inactif: false,
    currentCell: { has: unit, place() {} },
    appearanceLayerSprites: new Map(),
    handleChangeDest() {},
    stopInterval() {},
    setTextures(sheet) {
      this.currentSheet = sheet
    },
    stop() {
      stopUnit(this)
    },
    sendToBuilding(target) {
      orders.push('construction')
      Object.assign(this, {
        dest: target,
        action: 'build',
        work: 'builder',
        autonomousJob: 'construction',
        inactif: false,
      })
      return true
    },
    sendToStone(target) {
      orders.push('stone')
      Object.assign(this, { dest: target, action: 'minestone', work: 'stoneminer', inactif: false })
      return true
    },
  })
  unit.context.dayNight = { state: { hour: 10, minute: 0 } }
  flushCollectiveVillageWork(owner, 0)
  f.start()
  assert.equal(site.constructionProgress, 0)
  assert.equal(unit.inventory.resources.wood, 0)
  assert.deepEqual(site.constructionMaterials.delivered, { wood: 1 })
  assert.equal(unit.inactif, true)
  assert.equal(unit.action, null)
  assert.equal(unit.dest, null)
  assert.equal(unit.autonomousJob, null)
  assert.equal(unit.collectiveTask, 'construction')
  assert.equal(unit.currentSheet, load('app/constants/index.ts').SHEET_TYPES.standing)
  assert.deepEqual(orders, [])
  flushCollectiveVillageWork(owner, 1)
  assert.deepEqual(orders, ['stone'])
  assert.equal(unit.dest, stone)
  assert.equal(unit.collectiveTask, 'stone')
  // Complete the harvest at the command boundary, then let the real planner return the worker.
  unit.inventory.resources.stone = 1
  notifyVillageWorkChanged(owner)
  flushCollectiveVillageWork(owner, 2)
  assert.deepEqual(orders, ['stone', 'construction'])
  assert.equal(unit.dest, site)
  f.start()
  for (let i = 0; i < 101; i++) f.runtime.impact()
  assert.equal(site.hitPoints, site.totalHitPoints)
  assert.deepEqual(site.constructionMaterials.consumed, { wood: 1, stone: 1 })
})

test('live builder advances renovation with its cargo without changing building health', () => {
  const f = fixture({ wood: 120 }, { wood: 100 })
  Object.assign(f.site, {
    isBuilt: true,
    hitPoints: 75,
    totalHitPoints: 75,
    buildingUpgrade: { targetLevel: 1, hitPoints: 1, totalHitPoints: 101, constructionTime: 101 },
  })
  let updates = 0
  f.site.updateHitPoints = () => updates++
  f.start()
  f.runtime.impact()
  assert.equal(f.site.buildingUpgrade.constructionProgress, 1 / 101)
  assert.equal(f.site.hitPoints, 75)
  assert.equal(f.site.isBuilt, true)
  assert.equal(f.unit.inventory.resources.wood, 20)
  assert.equal(updates, 1)
})

test('every interior furnishing completes through hero work and applies its final appearance once', () => {
  const definitions = require('../public/assets/data/gameplay/buildings.json')
  const { INTERIOR_FURNITURE_TYPES } = loadTsModule('app/lib/buildings/furniture/interiorFurnitureCatalog.ts')
  for (const type of INTERIOR_FURNITURE_TYPES) {
    const config = definitions[type]
    const f = fixture({ ...config.cost }, config.cost, {
      'pixi.js': { AnimatedSprite: class {} },
      '../../services/BuildingInteriorSpaceSystem': { syncHouseInteriorSpace() {} },
      '../../lib': { getPercentage: (hp, total) => (hp * 100) / total, updateInstanceVisibility() {} },
      './BuildingSowing': {},
      './BuildingDestruction': {},
      './BuildingFinalTexture': {},
      './BuildingFire': { updateBuildingFireDamage() {} },
      './BuildingVisuals': { clearBuildingConstructionReveal() {}, syncBuildingConstructionReveal() {} },
    })
    let completed = 0
    let textures = 0
    Object.assign(f.site, {
      type,
      isBuilt: false,
      indestructible: type.startsWith('Camp'),
      totalHitPoints: config.totalHitPoints,
      hitPoints: config.totalHitPoints,
      constructionWorkRequired: config.constructionTime,
      constructionTime: config.constructionTime,
      owner: { hasBuilt: [] },
      context: { menu: {} },
      finalTexture: () => textures++,
      onBuilt: () => completed++,
      updateShadow() {},
      scanForInitialTarget() {},
    })
    const { BuildingLifecycle } = f.load('app/classes/building/BuildingLifecycle.ts')
    const lifecycle = new BuildingLifecycle(f.site)
    f.site.updateHitPoints = action => lifecycle.updateHitPoints(action)
    f.site.updateTexture = () => lifecycle.updateTexture()
    f.deposit()
    f.start()
    for (let impact = 0; impact < 100 && !f.site.isBuilt; impact++) f.runtime.impact()
    assert.equal(f.site.isBuilt, true, `${type}: construction must finish`)
    assert.equal(f.site.hitPoints, config.totalHitPoints, type)
    assert.equal(completed, 1, `${type}: completion effects`)
    assert.equal(textures, 1, `${type}: final appearance`)
    assert.deepEqual(f.site.constructionMaterials.consumed, config.cost, type)
    if (f.site.indestructible) {
      f.site.hitPoints--
      lifecycle.updateHitPoints('attack')
      assert.equal(f.site.hitPoints, config.totalHitPoints, `${type}: preset protection remains effective`)
    }
  }
})
