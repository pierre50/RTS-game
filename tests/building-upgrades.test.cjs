const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const options = {
  moduleCache: new Map(),
  mocks: {
    '../../services/BuildingInteriorSpaceSystem': {
      expelBuildingInteriorOccupants: (context, building, options) => context.expel(building, options),
    },
    '../../lib/chief': { heroCanCommand: hero => hero.isChief },
    '../../lib/hero/heroActionRange': { isHeroInteractionTargetReachable: hero => hero.reachable !== false },
  },
}
const load = path => loadTsModule(path, options)
const { completeBuildingUpgrade, nextBuildingUpgrade } = load('app/lib/buildings/buildingUpgrade.ts')
const { startBuildingUpgrade, canStartBuildingUpgrade } = load('app/classes/building/BuildingUpgrade.ts')
const {
  advanceMaterialConstruction,
  applyConstructionWork,
  remainingConstructionMaterials,
  missingConstructionMaterialsForNextPoint,
  hasConstructionWork,
} = load('app/lib/economy/constructionMaterials.ts')
const { consumeVillageWorkChange } = load('app/lib/units/villageWorkEvents.ts')
function fixture() {
  const owner = { label: 'village', age: 0, populationMax: 5, config: { buildings: definitions } }
  const hero = { owner, type: 'Hero', hitPoints: 45, isChief: true }
  const chest = { type: 'Chest', isBuilt: true, inventory: { resources: { wood: 200 } } }
  const building = {
    owner,
    family: 'building',
    type: 'House',
    label: 'house',
    i: 10,
    j: 10,
    buildingLevel: 0,
    isBuilt: true,
    hitPoints: 60,
    totalHitPoints: 75,
    shelterCapacity: 5,
    interiorBuildings: [chest],
    inventory: { resources: { stone: 100 } },
  }
  owner.buildings = [building]
  return { owner, hero, building, chest }
}
test('starting renovation preserves availability, health, interior and resources and wakes village work', () => {
  const { owner, hero, building, chest } = fixture()
  assert.equal(startBuildingUpgrade(building, hero), true)
  assert.equal(building.isBuilt, true)
  assert.equal(building.hitPoints, 60)
  assert.equal(building.totalHitPoints, 75)
  assert.equal(building.shelterCapacity, 5)
  assert.equal(building.interiorBuildings[0], chest)
  assert.deepEqual(chest.inventory.resources, { wood: 200 })
  assert.deepEqual(building.inventory.resources, { stone: 100 })
  assert.deepEqual(remainingConstructionMaterials(building), definitions.House.levelStats[1].cost)
  assert.equal(consumeVillageWorkChange(owner), true)
  assert.equal(startBuildingUpgrade(building, hero), false)
})
test('upgrade requires own reachable completed building and command authority', () => {
  for (const change of [
    f => (f.hero.isChief = false),
    f => (f.hero.reachable = false),
    f => (f.hero.owner = {}),
    f => (f.building.isBuilt = false),
    f => (f.building.isDead = true),
    f => (f.building.isDestroyed = true),
    f => (f.building.buildingLevel = 2),
  ]) {
    const f = fixture()
    change(f)
    assert.equal(canStartBuildingUpgrade(f.building, f.hero), false)
    assert.equal(startBuildingUpgrade(f.building, f.hero), false)
    assert.equal(f.building.buildingUpgrade, undefined)
  }
  assert.equal(nextBuildingUpgrade(definitions.Forge, 0), 1)
})
test('materials constrain independent renovation progress and completion applies housing delta exactly once', () => {
  const { owner, hero, building, chest } = fixture()
  startBuildingUpgrade(building, hero)
  const work = building.buildingUpgrade
  assert.equal(advanceMaterialConstruction(building, work.constructionTime, []), 0)
  const bag = { wood: 60 }
  applyConstructionWork(building, advanceMaterialConstruction(building, work.constructionTime, [bag]))
  assert.ok(work.constructionProgress > 0 && work.constructionProgress < 1)
  assert.equal(completeBuildingUpgrade(building, definitions.House), false)
  assert.deepEqual(remainingConstructionMaterials(building), { stone: 30, fiber: 4 })
  assert.deepEqual(missingConstructionMaterialsForNextPoint(building, {}), { stone: 30, fiber: 4 })
  assert.equal(building.hitPoints, 60)
  // Combat damage during renovation does not reset construction progress.
  building.hitPoints = 40
  Object.assign(bag, { stone: 30, fiber: 4 })
  applyConstructionWork(building, advanceMaterialConstruction(building, work.constructionTime, [bag]))
  assert.equal(completeBuildingUpgrade(building, definitions.House), true)
  assert.equal(building.buildingLevel, 1)
  assert.equal(building.totalHitPoints, 125)
  assert.equal(building.hitPoints, 90)
  assert.equal(building.shelterCapacity, 10)
  assert.equal(owner.populationMax, 0)
  assert.equal(building.interiorBuildings[0], chest)
  assert.equal(hasConstructionWork(building), false)
  assert.equal(completeBuildingUpgrade(building, definitions.House), false)
  assert.equal(owner.populationMax, 0)
  assert.deepEqual(bag, { wood: 0, stone: 0, fiber: 0 })
})

test('all eleven atlas buildings can renovate from level 1 to 2 and stop at the maximum', () => {
  const assets = require('../public/assets/data/civilizations/hellas.json')
  for (const type of Object.keys(assets.buildings[2])) {
    const config = definitions[type]
    const previous = config.levelStats[1]
    const target = config.levelStats[2]
    const { building, hero, chest } = fixture()
    Object.assign(building, {
      type,
      buildingLevel: 1,
      hitPoints: previous.totalHitPoints - 15,
      totalHitPoints: previous.totalHitPoints,
    })
    assert.equal(nextBuildingUpgrade(config, 0), 1, type)
    assert.equal(startBuildingUpgrade(building, hero), true, type)
    assert.equal(building.buildingUpgrade.targetLevel, 2)
    assert.equal(building.buildingUpgrade.constructionTime, config.constructionTime)
    assert.deepEqual(remainingConstructionMaterials(building), target.cost)
    assert.equal(completeBuildingUpgrade(building, config), false)
    const materials = { ...target.cost }
    applyConstructionWork(
      building,
      advanceMaterialConstruction(building, building.buildingUpgrade.constructionTime, [materials])
    )
    assert.equal(completeBuildingUpgrade(building, config), true, type)
    assert.equal(building.buildingLevel, 2)
    assert.equal(building.totalHitPoints, target.totalHitPoints)
    assert.equal(building.hitPoints, target.totalHitPoints - 15)
    assert.equal(building.interiorBuildings[0], chest)
    assert.ok(Object.values(materials).every(amount => amount === 0))
    assert.equal(nextBuildingUpgrade(config, 2), undefined)
    assert.equal(canStartBuildingUpgrade(building, hero), false)
  }
})
test('collective planner delivers materials to a built building under renovation', () => {
  const { owner, hero, building } = fixture()
  startBuildingUpgrade(building, hero)
  const unit = { type: 'Villager', i: 10, j: 11, inactif: true, inventory: { resources: { food: 10, wood: 10 } } }
  owner.units = [unit]
  const { planCollectiveTasks } = load('app/lib/economy/collectiveTasks.ts')
  const task = planCollectiveTasks(owner, [unit]).get(unit)
  assert.equal(task.job, 'construction')
  assert.equal(task.site, building)
})
test('pre-delivered renovation material recruits builders even with full building health', () => {
  const { owner, hero, building } = fixture()
  building.hitPoints = 75
  startBuildingUpgrade(building, hero)
  building.constructionMaterials.delivered = { ...building.constructionMaterials.cost }
  const unit = { type: 'Villager', i: 10, j: 11, inactif: true, inventory: { resources: { food: 10 } } }
  owner.units = [unit]
  const { planCollectiveTasks } = load('app/lib/economy/collectiveTasks.ts')
  assert.equal(planCollectiveTasks(owner, [unit]).get(unit)?.site, building)
  assert.deepEqual(building.constructionMaterials.consumed, {})
})
test('house level adds no population places without actual beds', () => {
  const { getPopulationCapacityFromBuildings } = load('app/lib/buildings/buildingOccupancy.ts')
  for (const buildingLevel of [0, 1, 2]) {
    assert.equal(getPopulationCapacityFromBuildings([{ type: 'House', buildingLevel, isBuilt: true }]), 0)
  }
})
test('offline construction completes renovation without recreating the building or double housing', () => {
  const { owner, hero, building, chest } = fixture()
  startBuildingUpgrade(building, hero)
  const { buildOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
  const unit = {
    type: 'Villager',
    inventory: { resources: { ...building.constructionMaterials.cost } },
    buildQueue: ['house'],
  }
  const report = { buildingsCompleted: 0 }
  const result = buildOffline(
    {
      state: {},
      player: owner,
      playerIndex: 0,
      unit,
      target: building,
      spatial: {},
      rules: { buildingConfig: () => definitions.House },
      report,
      cycle: 1,
    },
    100000
  )
  assert.equal(result.status, 'next')
  assert.equal(building.buildingLevel, 1)
  assert.equal(building.isBuilt, true)
  assert.equal(building.hitPoints, 110)
  assert.equal(owner.populationMax, 0)
  assert.equal(building.interiorBuildings[0], chest)
  assert.equal(report.buildingsCompleted, 1)
})

test('offline construction finishes damaged sites by work progress and preserves the damage', () => {
  const { buildOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
  const target = {
    type: 'House',
    label: 'site',
    isBuilt: false,
    hitPoints: 31,
    totalHitPoints: 101,
    constructionProgress: 0.5,
  }
  const unit = { type: 'Villager', buildQueue: ['site'] }
  const report = { buildingsCompleted: 0 }
  const result = buildOffline(
    {
      state: {},
      player: {},
      playerIndex: 0,
      unit,
      target,
      spatial: {},
      report,
      cycle: 1,
      rules: { buildingConfig: () => ({ totalHitPoints: 101, constructionTime: 101 }) },
    },
    1000
  )
  assert.equal(result.status, 'next')
  assert.equal(target.isBuilt, true)
  assert.equal(target.constructionProgress, 1)
  assert.equal(target.hitPoints, 81)
  assert.equal(report.buildingsCompleted, 1)
})

test('offline repairs wait for full health while keeping construction complete', () => {
  const { buildOffline } = load('app/services/world/work/OfflineWorkImpacts.ts')
  const target = { type: 'House', isBuilt: true, hitPoints: 10, totalHitPoints: 20, constructionProgress: 1 }
  const report = { buildingsCompleted: 0 }
  const result = buildOffline(
    {
      state: {},
      player: {},
      playerIndex: 0,
      unit: { type: 'Villager' },
      target,
      spatial: {},
      report,
      cycle: 1,
      rules: { buildingConfig: () => ({ totalHitPoints: 20, constructionTime: 20 }) },
    },
    1
  )
  assert.equal(result.status, 'wait')
  assert.equal(target.hitPoints, 11)
  assert.equal(target.constructionProgress, 1)
  assert.equal(report.buildingsCompleted, 0)
})

test('upgrade row displays construction costs, starts an unfunded project and then shows progress', () => {
  const previous = global.document
  global.document = { createElement: () => ({ appendChild() {}, toDataURL: () => '' }) }
  const rows = []
  const { createHeroBuildingUpgrade } = loadTsModule('app/ui/hero-building/HeroBuildingUpgrade.ts', {
    ...options,
    mocks: {
      ...options.mocks,
      '../../lib/avatar': { renderBuildingAvatar: () => true },
      '../../lib/lang': { t: (key, values = {}) => `${key} ${JSON.stringify(values)}` },
      '../ActionDetailsFactory': { formatActionCost: cost => JSON.stringify(cost) },
      '../inventory/InventoryActionRow': {
        createInventoryActionRow: (_, row) => {
          rows.push(row)
          return { element: {}, icon: { appendChild() {} } }
        },
      },
    },
  })
  try {
    const { owner, hero, building } = fixture()
    const menu = { context: { player: owner, controls: { heroUnit: hero } } }
    let refreshed = 0
    createHeroBuildingUpgrade(menu, building, () => refreshed++)
    assert.equal(rows[0].disabled, false)
    assert.match(rows[0].metaParts[0].text, /constructionMaterialsCost/)
    assert.match(rows[0].description, /buildingUpgradeBedsPreserved/)
    rows[0].trailingAction.onClick()
    assert.equal(refreshed, 1)
    createHeroBuildingUpgrade(menu, building, () => refreshed++)
    assert.equal(rows[1].disabled, true)
    assert.match(rows[1].title, /buildingUpgradeProgress/)
    assert.match(rows[1].metaParts[0].text, /buildingUpgradeRemaining/)
    rows[0].trailingAction.onClick()
    assert.equal(refreshed, 1)
    delete building.buildingUpgrade
    building.trainingRequests = [{ type: 'Soldier' }]
    createHeroBuildingUpgrade(menu, building, () => refreshed++)
    assert.equal(rows[2].disabled, true)
    assert.match(rows[2].description, /buildingUpgradeTrainingBlocked/)
    rows[2].trailingAction.onClick()
    assert.equal(refreshed, 1)
    assert.equal(building.buildingUpgrade, undefined)
    building.trainingRequests = []
    building.buildingLevel = 1
    building.totalHitPoints = 125
    createHeroBuildingUpgrade(menu, building, () => refreshed++)
    assert.equal(rows[3].disabled, false)
    assert.match(rows[3].title, /"level":3/)
    rows[3].trailingAction.onClick()
    assert.equal(building.buildingUpgrade.targetLevel, 2)
    assert.deepEqual(remainingConstructionMaterials(building), definitions.House.levelStats[2].cost)
    delete building.buildingUpgrade
    building.buildingLevel = 2
    createHeroBuildingUpgrade(menu, building, () => refreshed++)
    assert.equal(rows[4].disabled, true)
    assert.match(rows[4].title, /buildingUpgradeMaximum/)
  } finally {
    global.document = previous
  }
})

test('full health renovation remains a valid live build target', () => {
  const { hero, building } = fixture()
  building.hitPoints = 75
  startBuildingUpgrade(building, hero)
  const { getActionCondition } = load('app/lib/combat/combatActionConditions.ts')
  assert.equal(getActionCondition(hero, building, 'build'), true)
  delete building.buildingUpgrade
  assert.equal(getActionCondition(hero, building, 'build'), false)
})

test('renovation refuses active, queued and incoming training without changing the building', () => {
  for (const change of [
    f => (f.building.trainingQueue = [{ type: 'Soldier' }]),
    f => (f.building.queue = ['Soldier']),
    f => (f.building.loading = 0),
    f => (f.building.trainingUnit = {}),
    f => (f.building.trainingRequests = [{ type: 'Soldier' }]),
    f => (f.owner.units = [{ dest: f.building, trainingTargetType: 'Soldier' }]),
  ]) {
    const f = fixture()
    change(f)
    assert.equal(canStartBuildingUpgrade(f.building, f.hero), false)
    assert.equal(startBuildingUpgrade(f.building, f.hero), false)
    assert.equal(f.building.buildingUpgrade, undefined)
    assert.equal(f.building.constructionMaterials, undefined)
  }
})

test('renovation closes entry before expelling units and reopens it on completion', () => {
  const { building, hero, owner } = fixture()
  const { canUnitEnterBuildingInterior } = load('app/lib/buildings/interiorAccess.ts')
  const { hasBuildingTrainingCapacity } = load('app/lib/buildings/buildingTraining.ts')
  let expelled = false
  building.context = {
    expel: (target, options) => {
      assert.equal(target, building)
      assert.equal(options.unitsOnly, true)
      assert.equal(canUnitEnterBuildingInterior(hero, building), false)
      expelled = true
    },
  }
  assert.equal(canUnitEnterBuildingInterior(hero, building), true)
  assert.equal(startBuildingUpgrade(building, hero), true)
  assert.equal(expelled, true)
  assert.equal(hasBuildingTrainingCapacity(building), false)
  building.buildingUpgrade.constructionProgress = 1
  assert.equal(completeBuildingUpgrade(building, definitions.House), true)
  assert.equal(canUnitEnterBuildingInterior(hero, building), true)
  assert.equal(hasBuildingTrainingCapacity(building), true)
})
