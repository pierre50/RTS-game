const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const { getBuildingConfigForAge, getBuildingAge } = loadTsModule('app/lib/buildings/buildingAge.ts')

const expected = {
  House: [{ wood: 60, stone: 15, leather: 2 }, 75, { wood: 80, stone: 40, fiber: 4 }, 125],
  Barracks: [{ wood: 200, stone: 60, leather: 6 }, 350, { wood: 240, stone: 120, fiber: 8 }, 550],
  Granary: [{ wood: 160, stone: 40, leather: 4 }, 350, { wood: 200, stone: 80, fiber: 6 }, 500],
  StoragePit: [{ wood: 180, stone: 100 }, 350, { wood: 220, stone: 160, fiber: 4 }, 550],
  Market: [{ wood: 180, stone: 50, leather: 4 }, 350, { wood: 240, stone: 100, fiber: 10 }, 500],
  Temple: [{ wood: 140, stone: 200, leather: 2 }, 350, { wood: 180, stone: 300, fiber: 8 }, 600],
  TownCenter: [{ wood: 350, stone: 160, leather: 8 }, 600, { wood: 400, stone: 260, fiber: 12 }, 950],
}

test('the agreed age 0 and age 1 costs and HP are applied exactly', () => {
  for (const [type, [cost0, hp0, cost1, hp1]] of Object.entries(expected)) {
    const zero = getBuildingConfigForAge(definitions[type], 0)
    const one = getBuildingConfigForAge(definitions[type], 1)
    assert.deepEqual(zero.cost, cost0, type)
    assert.deepEqual(one.cost, cost1, type)
    assert.equal(zero.totalHitPoints, hp0, type)
    assert.equal(one.totalHitPoints, hp1, type)
    assert.equal(zero.constructionTime, one.constructionTime, 'work duration is not changed by this balance pass')
  }
  for (const age of [0, 1, 2]) {
    assert.deepEqual(getBuildingConfigForAge(definitions.Farm, age).cost, { wood: 10 })
  }
})

test('tiers fall back to the latest defined age without changing shared definitions', () => {
  const before = JSON.stringify(definitions)
  assert.equal(getBuildingConfigForAge(definitions.House, 2).totalHitPoints, 125)
  assert.equal(getBuildingConfigForAge(definitions.House, 0).totalHitPoints, 75)
  assert.deepEqual(getBuildingConfigForAge(definitions.Stable, 1).cost, definitions.Stable.cost)
  assert.equal(JSON.stringify(definitions), before)
})

test('building age survives new owners and supports legacy saves', () => {
  assert.equal(getBuildingAge({ buildingAge: 0, assetAge: 1 }, 2), 0)
  assert.equal(getBuildingAge({ assetAge: 1 }, 2), 1)
  assert.equal(getBuildingAge({}, 1), 1)
  assert.equal(getBuildingAge({ assetAge: null }, 1), 1)
})

function loadBuilding() {
  const noop = () => {}
  const controller = class {}
  return loadTsModule('app/classes/building/Building.ts', {
    mocks: {
      '../../constants': { FAMILY_TYPES: { building: 'building' } },
      '../../lib': {},
      '../Instance': {
        Instance: class {
          constructor(context) {
            this.context = context
          }
          assignProperties(values) {
            Object.assign(this, values)
          }
        },
      },
      '../../ui/entity/BuildingInterface': { BuildingInterface: controller },
      './BuildingLifecycle': { BuildingLifecycle: controller },
      './BuildingFire': { stopFlameAmbientSound: noop },
      './BuildingProduction': { BuildingProduction: controller },
      './BuildingCombat': { BuildingCombat: controller },
      '../../lib/audio/settings': { onVisualSettingsChange: () => noop },
      './BuildingInterfaceSetup': { createBuildingEntityInterface: () => ({}) },
      './BuildingSetup': {
        activateBuiltBuilding: noop,
        attachInitialBuildingVisuals: noop,
        createInitialBuildingSprite: noop,
        occupyBuildingFootprint: noop,
        restoreBuildingRallyPoint: noop,
        resumeInitialBuildingWork: noop,
        setupBuildingTransform: noop,
        stableHorsesFromOptions: () => [],
      },
      './BuildingVisuals': {},
    },
  }).Building
}

test('new construction, restoration and captured buildings resolve HP from their own age', () => {
  const Building = loadBuilding()
  const owner = { age: 0, config: { buildings: definitions } }
  const context = { map: { addToInstanceBucket() {} } }
  const old = new Building({ type: 'House', i: 1, j: 1, owner, isBuilt: true }, context)
  assert.equal(old.totalHitPoints, 75)
  assert.equal(old.hitPoints, 75)
  owner.age = 1
  assert.equal(old.buildingAge, 0)
  assert.equal(old.totalHitPoints, 75)
  const recent = new Building({ type: 'House', i: 2, j: 2, owner, isBuilt: true }, context)
  assert.equal(recent.totalHitPoints, 125)
  assert.deepEqual(recent.cost, { wood: 80, stone: 40, fiber: 4 })
  const restored = new Building(
    { type: 'House', i: 1, j: 1, owner, buildingAge: 0, assetAge: 1, isBuilt: true, hitPoints: 37 },
    context
  )
  assert.equal(restored.totalHitPoints, 75)
  assert.equal(restored.hitPoints, 37)
  const site = new Building({ type: 'House', i: 1, j: 1, owner }, context)
  assert.equal(site.buildingAge, 1)
  assert.equal(site.hitPoints, 1)
  const legacy = new Building({ type: 'House', i: 1, j: 1, owner, assetAge: 0, hitPoints: 90 }, context)
  assert.equal(legacy.totalHitPoints, 75)
  assert.equal(legacy.hitPoints, 75)
})

test('sprite selection prefers building age over owner or captured artwork age', () => {
  const { getBuildingAssetOwner } = loadTsModule('app/lib/graphics/assets.ts', {
    mocks: { '../civilizationAlias': {} },
  })
  assert.deepEqual(getBuildingAssetOwner({ owner: { age: 1, civ: 'Hellas' }, buildingAge: 0 }), {
    age: 0,
    civ: 'Hellas',
  })
  assert.deepEqual(
    getBuildingAssetOwner({ owner: { age: 2, civ: 'Hellas' }, buildingAge: 0, assetAge: 1, assetCiv: 'Kemet' }),
    { age: 0, civ: 'Kemet' }
  )
})

test('placement charges the chosen tier and rejects missing materials or locked ages', () => {
  const { buyPlayerBuilding } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', {
    mocks: {
      '../../lib': {
        canAfford: (player, cost) => Object.entries(cost).every(([key, amount]) => (player[key] ?? 0) >= amount),
        payCost: (player, cost) => {
          for (const [key, amount] of Object.entries(cost)) player[key] -= amount
        },
        isBuildingLimitReached: () => false,
        canPlaceBuildingAt: () => true,
        hasBuildingPlacementClearance: () => true,
      },
      '../../lib/buildings/passageCells': { createReservedPassageCellLookup: () => new Set() },
      '../../lib/entities/entityFade': {},
      '../../lib/mapSpaces': { getMapSpace: () => null },
      '../Resource': {},
      '../../lib/objectives/ageObjectives': {},
    },
  })
  const player = {
    age: 1,
    wood: 80,
    stone: 40,
    fiber: 3,
    leather: 2,
    config: { buildings: definitions },
    isBuildingEligible: () => true,
    context: { map: { grid: [], instantMode: false }, players: [], menu: {} },
    spawnBuilding(options) {
      this.spawned = options
    },
  }
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House'), false)
  assert.equal(player.wood, 80)
  player.fiber = 4
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House'), true)
  assert.equal(player.spawned.buildingAge, 1)
  assert.deepEqual([player.wood, player.stone, player.fiber, player.leather], [0, 0, 0, 2])
  Object.assign(player, { age: 1, wood: 60, stone: 15, fiber: 0, leather: 2 })
  assert.equal(buyPlayerBuilding(player, 2, 2, 'House', { buildingAge: 0 }), true)
  assert.equal(player.spawned.buildingAge, 0)
  assert.equal(player.leather, 0)
  assert.equal(buyPlayerBuilding(player, 2, 2, 'House', { buildingAge: 2, alreadyPaid: true }), false)
})
