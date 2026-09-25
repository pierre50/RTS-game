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
    '../../lib/objectives/ageObjectives': {},
  },
})

for (const type of ['Chest', 'FireCamp', 'Trap']) {
  test(`a lone hero builds ${type} instantly using bag resources and can still place a legacy item`, () => {
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
    assert.equal(player.buildings[0].isBuilt, true)
    assert.deepEqual(hero.inventory.resources, {})
    assert.equal(buyPlayerBuilding(player, 2, 2, type), false)
    assert.equal(buyPlayerBuilding(player, 2, 2, type, { alreadyPaid: true }), true)
    assert.equal(player.buildings.length, 2)
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
