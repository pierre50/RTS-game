const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')
const { getBuildingConfigForLevel, getBuildingLevel } = loadTsModule('app/lib/buildings/buildingLevel.ts')

const expected = {
  House: [
    {
      wood: 40,
      stone: 10,
    },
    75,
    {
      wood: 60,
      stone: 30,
      fiber: 4,
    },
    125,
  ],
  StoragePit: [
    {
      wood: 60,
      stone: 20,
    },
    350,
    {
      wood: 100,
      stone: 40,
      fiber: 4,
    },
    550,
  ],
  Granary: [
    {
      wood: 50,
      stone: 20,
    },
    350,
    {
      wood: 80,
      stone: 40,
      fiber: 4,
    },
    500,
  ],
  TownCenter: [
    {
      wood: 150,
      stone: 80,
    },
    600,
    {
      wood: 220,
      stone: 100,
      fiber: 8,
    },
    950,
  ],
  Barracks: [
    {
      wood: 120,
      stone: 40,
    },
    350,
    {
      wood: 180,
      stone: 80,
      fiber: 8,
    },
    550,
  ],
  Market: [
    {
      wood: 100,
      stone: 40,
    },
    350,
    {
      wood: 160,
      stone: 70,
      fiber: 6,
    },
    500,
  ],
  Temple: [
    {
      wood: 140,
      stone: 200,
    },
    350,
    {
      wood: 180,
      stone: 300,
      fiber: 8,
    },
    600,
  ],
}

test('the agreed level 0 and level 1 costs and HP are applied exactly', () => {
  for (const [type, [cost0, hp0, cost1, hp1]] of Object.entries(expected)) {
    const zero = getBuildingConfigForLevel(definitions[type], 0)
    const one = getBuildingConfigForLevel(definitions[type], 1)
    assert.deepEqual(zero.cost, cost0, type)
    assert.deepEqual(one.cost, cost1, type)
    assert.equal(zero.totalHitPoints, hp0, type)
    assert.equal(one.totalHitPoints, hp1, type)
    assert.equal(zero.constructionTime, one.constructionTime, 'work duration is not changed by this balance pass')
  }
  for (const age of [0, 1, 2]) {
    assert.deepEqual(getBuildingConfigForLevel(definitions.Farm, age).cost, { wheat: 1 })
  }
})

test('tiers fall back to the latest defined level without changing shared definitions', () => {
  const before = JSON.stringify(definitions)
  assert.equal(getBuildingConfigForLevel(definitions.House, 3).totalHitPoints, 188)
  assert.equal(getBuildingConfigForLevel(definitions.House, 0).totalHitPoints, 75)
  assert.deepEqual(getBuildingConfigForLevel(definitions.Stable, 3).cost, definitions.Stable.levelStats[2].cost)
  assert.equal(JSON.stringify(definitions), before)
})

test('building level is independent of its owner', () => {
  assert.equal(getBuildingLevel({ buildingLevel: 0, assetLevel: 1 }, 2), 0)
  assert.equal(getBuildingLevel({ assetLevel: 1 }, 2), 1)
  assert.equal(getBuildingLevel({}, 1), 0)
  assert.equal(getBuildingLevel({ assetLevel: null }, 1), 0)
})

function loadBuilding() {
  const noop = () => {}
  const controller = class {}
  return loadTsModule('app/classes/building/Building.ts', {
    mocks: {
      '../../constants': {
        CAMP_DECORATION_BUILDING_TYPES: loadTsModule('app/constants/entities.ts').CAMP_DECORATION_BUILDING_TYPES,
        FAMILY_TYPES: { building: 'building' },
      },
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
        resumeInitialBuildingWork: noop,
        setupBuildingTransform: noop,
        stableHorsesFromOptions: () => [],
      },
      './BuildingVisuals': {},
    },
  }).Building
}

test('new construction, restoration and captured buildings resolve HP from their own level', () => {
  const Building = loadBuilding()
  const owner = { age: 0, config: { buildings: definitions } }
  const context = { map: { addToInstanceBucket() {} } }
  const old = new Building({ type: 'House', i: 1, j: 1, owner, isBuilt: true }, context)
  assert.equal(old.totalHitPoints, 75)
  assert.equal(old.hitPoints, 75)
  owner.age = 1
  assert.equal(old.buildingLevel, 0)
  assert.equal(old.totalHitPoints, 75)
  const recent = new Building({ type: 'House', i: 2, j: 2, owner, isBuilt: true }, context)
  assert.equal(recent.totalHitPoints, 75)
  assert.deepEqual(recent.cost, { wood: 40, stone: 10 })
  const restored = new Building(
    { type: 'House', i: 1, j: 1, owner, buildingLevel: 0, assetLevel: 1, isBuilt: true, hitPoints: 37 },
    context
  )
  assert.equal(restored.totalHitPoints, 75)
  assert.equal(restored.hitPoints, 37)
  const site = new Building({ type: 'House', i: 1, j: 1, owner }, context)
  assert.equal(site.buildingLevel, 0)
  assert.equal(site.hitPoints, site.totalHitPoints)
  assert.equal(site.constructionProgress, 0)
  assert.equal(site.constructionWorkRequired, Math.max(1, site.constructionTime ?? 1))
  const damagedSite = new Building(
    {
      type: 'House',
      i: 1,
      j: 1,
      owner,
      isBuilt: false,
      hitPoints: 10,
      constructionProgress: 0.25,
      constructionWorkRequired: 40,
    },
    context
  )
  assert.equal(damagedSite.hitPoints, 10)
  assert.equal(damagedSite.constructionProgress, 0.25)
  assert.equal(damagedSite.constructionWorkRequired, 40)
  const legacy = new Building({ type: 'House', i: 1, j: 1, owner, assetLevel: 0, hitPoints: 90 }, context)
  assert.equal(legacy.totalHitPoints, 75)
  assert.equal(legacy.hitPoints, 75)
})

test('sprite selection uses the individual building level', () => {
  const { getBuildingAssetOwner } = loadTsModule('app/lib/graphics/assets.ts', {
    mocks: { '../civilizationAlias': {} },
  })
  assert.deepEqual(getBuildingAssetOwner({ owner: { age: 1, civ: 'Hellas' }, buildingLevel: 0 }), {
    level: 0,
    civ: 'Hellas',
  })
  assert.deepEqual(
    getBuildingAssetOwner({ owner: { age: 2, civ: 'Hellas' }, buildingLevel: 0, assetLevel: 1, assetCiv: 'Kemet' }),
    { level: 0, civ: 'Kemet' }
  )
})

test('new construction starts at base level and requires renovation for higher levels', () => {
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
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House'), true)
  assert.equal(player.wood, 80)
  player.fiber = 4
  assert.equal(buyPlayerBuilding(player, 1, 1, 'House'), true)
  assert.equal(player.spawned.buildingLevel, 0)
  assert.deepEqual(player.spawned.constructionMaterials.cost, getBuildingConfigForLevel(definitions.House, 0).cost)
  assert.deepEqual([player.wood, player.stone, player.fiber, player.leather], [80, 40, 4, 2])
  Object.assign(player, { age: 1, wood: 60, stone: 15, fiber: 0, leather: 2 })
  assert.equal(buyPlayerBuilding(player, 2, 2, 'House', { buildingLevel: 0 }), true)
  assert.equal(player.spawned.buildingLevel, 0)
  assert.equal(player.leather, 2)
  assert.equal(buyPlayerBuilding(player, 2, 2, 'House', { buildingLevel: 2, alreadyPaid: true }), false)
})

test('starter buildings use gathered wood and stone without requiring a prefilled chest', () => {
  for (const type of ['House', 'TownCenter', 'Granary', 'StoragePit', 'Barracks', 'Market']) {
    assert.ok(
      Object.keys(getBuildingConfigForLevel(definitions[type], 0).cost).every(resource =>
        ['wood', 'stone'].includes(resource)
      ),
      type
    )
  }
})
