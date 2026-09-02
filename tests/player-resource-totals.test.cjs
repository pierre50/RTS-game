const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResourceTotals() {
  return loadTsModule('app/lib/resources/playerResourceTotals.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { chest: 'Chest', townCenter: 'TownCenter' },
        RESOURCE_NAMES: ['wood', 'food', 'stone'],
        UNIT_TYPES: { hero: 'Hero' },
      },
    },
  })
}

test('player chest resource totals sum only owned living chests', () => {
  const { getPlayerResourceTotals } = loadResourceTotals()
  const player = { label: 'p1', buildings: [] }
  const other = { label: 'p2' }
  player.buildings = [
    {
      owner: player,
      type: 'Chest',
      inventory: { resources: { wood: 5.8, food: 3 } },
    },
    {
      owner: { label: 'p1' },
      type: 'Chest',
      inventory: { resources: { wood: 2, stone: 4 } },
    },
    {
      owner: other,
      type: 'Chest',
      inventory: { resources: { wood: 99 } },
    },
    {
      owner: player,
      type: 'House',
      inventory: { resources: { wood: 99 } },
    },
    {
      isDestroyed: true,
      owner: player,
      type: 'Chest',
      inventory: { resources: { food: 99 } },
    },
  ]

  assert.deepEqual(getPlayerResourceTotals(player, { includeHero: false }), { wood: 7, food: 3, stone: 4 })
})

test('player resource totals include the hero bag and starting town center stock', () => {
  const { getPlayerResourceTotals } = loadResourceTotals()
  const player = { label: 'p1', buildings: [], units: [] }
  const hero = { owner: player, type: 'Hero', inventory: { resources: { wood: 4, stone: 1 } } }
  player.units = [hero]
  player.buildings = [
    { owner: player, type: 'Chest', inventory: { resources: { wood: 7 } } },
    { owner: player, type: 'TownCenter', inventory: { resources: { food: 8 } } },
  ]

  assert.deepEqual(getPlayerResourceTotals(player), { wood: 11, food: 8, stone: 1 })
})

test('visible player resource totals hide unseen storage but keep the hero bag', () => {
  const { getPlayerResourceTotals } = loadResourceTotals()
  const player = {
    label: 'p1',
    buildings: [],
    units: [],
    views: {
      isVisible: (i, j) => i === 2 && j === 3,
      withSpace: (_spaceId, callback) => callback(),
    },
  }
  const hero = { owner: player, type: 'Hero', inventory: { resources: { wood: 4, stone: 1 } } }
  player.units = [hero]
  player.buildings = [
    { i: 2, j: 3, owner: player, type: 'Chest', inventory: { resources: { wood: 7 } } },
    { i: 8, j: 9, owner: player, type: 'Chest', inventory: { resources: { wood: 99, food: 99 } } },
    { i: 8, j: 9, owner: player, type: 'TownCenter', inventory: { resources: { food: 8 } } },
  ]

  assert.deepEqual(getPlayerResourceTotals(player, { visibleOnly: true }), { wood: 11, food: 0, stone: 1 })
})

test('missing chest resources compares costs against stored chest totals', () => {
  const { getMissingPlayerResources } = loadResourceTotals()
  const player = {
    label: 'p1',
    buildings: [{ owner: { label: 'p1' }, type: 'Chest', inventory: { resources: { wood: 7, food: 1 } } }],
  }

  assert.deepEqual(getMissingPlayerResources(player, { wood: 5, food: 3, stone: 2 }, { includeHero: false }), {
    food: 2,
    stone: 2,
  })
})
