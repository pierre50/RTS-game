const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const definitions = require('../public/assets/data/gameplay/buildings.json')

const accounting = loadTsModule('app/lib/accounting.ts')
const { buyPlayerBuilding } = loadTsModule('app/classes/players/PlayerBuildingPlacement.ts', {
  mocks: {
    '../../lib': {
      canAfford: accounting.canAfford,
      payCost: accounting.payCost,
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

for (const type of ['Chest', 'FireCamp', 'Trap', 'CampBrazier']) {
  test(`a lone hero places ${type} without payment, builds from the bag, and preserves prepaid items`, () => {
    const player = {
      age: 0,
      isPlayed: true,
      label: 'player',
      buildings: [],
      config: { buildings: definitions },
      isBuildingEligible: () => true,
      context: { map: { grid: [], instantMode: false }, players: [], menu: { updateTopbar() {} } },
      spawnBuilding(options) {
        this.buildings.push({ ...options, owner: this })
      },
    }
    const hero = { type: 'Hero', owner: player, inventory: { resources: { ...definitions[type].cost } } }
    player.units = [hero]
    player.context.controls = { heroUnit: hero }
    assert.equal(buyPlayerBuilding(player, 1, 1, type), true)
    const site = player.buildings[0]
    assert.equal(site.isBuilt, false)
    assert.deepEqual(hero.inventory.resources, definitions[type].cost)
    assert.deepEqual(site.constructionMaterials, { cost: definitions[type].cost, consumed: {}, delivered: {} })
    Object.assign(site, { hitPoints: 1, totalHitPoints: definitions[type].totalHitPoints })
    const { advanceMaterialConstruction } = loadTsModule('app/lib/economy/constructionMaterials.ts')
    const { advanceConstruction } = loadTsModule('app/lib/economy/workRules.ts')
    for (let impact = 0; impact < 4; impact++) {
      site.hitPoints = advanceMaterialConstruction(
        site,
        advanceConstruction(site.hitPoints, site.totalHitPoints, definitions[type].constructionTime),
        [hero.inventory.resources]
      )
    }
    assert.equal(site.hitPoints, site.totalHitPoints)
    assert.deepEqual(site.constructionMaterials.consumed, definitions[type].cost)
    assert.ok(Object.values(hero.inventory.resources).every(amount => amount === 0))
    assert.equal(buyPlayerBuilding(player, 2, 2, type), true)
    assert.equal(player.buildings[1].isBuilt, false)
    assert.equal(buyPlayerBuilding(player, 2, 2, type, { alreadyPaid: true }), true)
    assert.equal(player.buildings.length, 3)
    assert.equal(player.buildings[2].constructionMaterials, undefined)
  })
}

test('a player can place multiple town centers on a map with another faction center', () => {
  const resident = { buildings: [{ type: 'TownCenter', isBuilt: true, hitPoints: 100 }], type: 'AI' }
  const player = {
    age: 0,
    buildings: [{ type: 'TownCenter', isBuilt: true, hitPoints: 100 }],
    config: { buildings: definitions },
    isBuildingEligible: () => true,
    context: { map: { grid: [], instantMode: false }, players: [resident], menu: {} },
    spawnBuilding(options) {
      this.buildings.push({ ...options, owner: this })
    },
  }
  player.context.players.push(player)
  assert.equal(buyPlayerBuilding(player, 5, 5, 'TownCenter', { alreadyPaid: true }), true)
  assert.equal(buyPlayerBuilding(player, 12, 12, 'TownCenter', { alreadyPaid: true }), true)
  assert.equal(player.buildings.length, 3)
  assert.equal(resident.buildings.length, 1)
})

test('brazier appearance is chosen once and survives save restoration', () => {
  const { assignCampBrazierAppearance, isCampBuilding } = loadTsModule('app/lib/buildings/campConstruction.ts')
  assert.equal(isCampBuilding('CampBrazier'), true)
  for (const [roll, expected] of [
    [0.1, 'CampBrazier'],
    [0.9, 'CampTorchStand'],
  ]) {
    const building = { type: 'CampBrazier' }
    assignCampBrazierAppearance(building, () => roll)
    assert.equal(building.assetType, expected)
    const restored = JSON.parse(JSON.stringify(building))
    assignCampBrazierAppearance(restored, () => 1 - roll)
    assert.equal(restored.assetType, expected)
  }
})
