const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadAccounting() {
  const constants = {
    BUILDING_TYPES: { chest: 'Chest' },
    RESOURCE_NAMES: ['wood', 'food', 'stone', 'gold', 'copper', 'iron'],
    UNIT_TYPES: { hero: 'Hero' },
  }
  return loadTsModule('app/lib/accounting.ts', {
    mocks: {
      '../constants': constants,
      '../../constants': constants,
    },
  })
}

test('player affordability uses chest inventory instead of legacy resource fields', () => {
  const { canAfford } = loadAccounting()
  const player = {
    label: 'p1',
    wood: 999,
    buildings: [],
  }

  assert.equal(canAfford(player, { wood: 5 }), false)
})

test('payCost withdraws player costs from owned chests', () => {
  const { canAfford, payCost } = loadAccounting()
  const player = { label: 'p1', buildings: [] }
  player.buildings = [
    { owner: player, type: 'Chest', inventory: { resources: { wood: 3 } } },
    { owner: player, type: 'Chest', inventory: { resources: { wood: 4, stone: 2 } } },
  ]

  assert.equal(canAfford(player, { wood: 5, stone: 1 }), true)
  payCost(player, { wood: 5, stone: 1 })

  assert.deepEqual(player.buildings[0].inventory.resources, {})
  assert.deepEqual(player.buildings[1].inventory.resources, { wood: 2, stone: 1 })
})

test('payCost can complete player costs from the hero bag', () => {
  const { canAfford, payCost } = loadAccounting()
  const player = { label: 'p1', buildings: [], units: [] }
  const hero = { owner: player, type: 'Hero', inventory: { resources: { wood: 4 } } }
  player.buildings = [{ owner: player, type: 'Chest', inventory: { resources: { wood: 3 } } }]
  player.units = [hero]

  assert.equal(canAfford(player, { wood: 5 }), true)
  payCost(player, { wood: 5 })

  assert.deepEqual(player.buildings[0].inventory.resources, {})
  assert.deepEqual(hero.inventory.resources, { wood: 2 })
  assert.equal(player.wood, 2)
})

test('plain resource ledgers keep the legacy accounting behavior', () => {
  const { canAfford, payCost, refundCost } = loadAccounting()
  const ledger = { wood: 7 }

  assert.equal(canAfford(ledger, { wood: 5 }), true)
  payCost(ledger, { wood: 5 })
  assert.equal(ledger.wood, 2)
  refundCost(ledger, { wood: 3 })
  assert.equal(ledger.wood, 5)
})
