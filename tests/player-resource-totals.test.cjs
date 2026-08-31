const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResourceTotals() {
  return loadTsModule('app/lib/resources/playerResourceTotals.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { chest: 'Chest' },
        RESOURCE_NAMES: ['wood', 'food', 'stone'],
      },
    },
  })
}

test('player chest resource totals sum only owned living chests', () => {
  const { getPlayerChestResourceTotals } = loadResourceTotals()
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

  assert.deepEqual(getPlayerChestResourceTotals(player), { wood: 7, food: 3, stone: 4 })
})

test('missing chest resources compares costs against stored chest totals', () => {
  const { getMissingChestResources } = loadResourceTotals()
  const player = {
    label: 'p1',
    buildings: [{ owner: { label: 'p1' }, type: 'Chest', inventory: { resources: { wood: 7, food: 1 } } }],
  }

  assert.deepEqual(getMissingChestResources(player, { wood: 5, food: 3, stone: 2 }), { food: 2, stone: 2 })
})
