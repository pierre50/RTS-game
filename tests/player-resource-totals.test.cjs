const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadResourceTotals() {
  return loadTsModule('app/lib/resources/playerResourceTotals.ts', {
    mocks: {
      '../../constants': {
        BUILDING_TYPES: { chest: 'Chest', storagePit: 'StoragePit', townCenter: 'TownCenter' },
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone'],
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
      inventory: { resources: { wood: 5.8, wheat: 3 } },
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
      inventory: { resources: { wheat: 99 } },
    },
  ]

  assert.deepEqual(getPlayerResourceTotals(player, { includeHero: false }), {
    wood: 7,
    berry: 0,
    meat: 0,
    wheat: 3,
    stone: 4,
    food: 3,
  })
})

test('player resource totals include the hero bag and starting town center stock', () => {
  const { getPlayerResourceTotals } = loadResourceTotals()
  const player = { label: 'p1', buildings: [], units: [] }
  const hero = { owner: player, type: 'Hero', inventory: { resources: { wood: 4, stone: 1 } } }
  player.units = [hero]
  player.buildings = [
    { owner: player, type: 'Chest', inventory: { resources: { wood: 7 } } },
    { owner: player, type: 'TownCenter', inventory: { resources: { wheat: 8 } } },
    { owner: player, type: 'StoragePit', inventory: { resources: { stone: 2 } } },
  ]

  assert.deepEqual(getPlayerResourceTotals(player), { wood: 11, berry: 0, meat: 0, wheat: 8, stone: 3, food: 8 })
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
    { i: 8, j: 9, owner: player, type: 'Chest', inventory: { resources: { wood: 99, wheat: 99 } } },
    { i: 8, j: 9, owner: player, type: 'TownCenter', inventory: { resources: { wheat: 8 } } },
  ]

  assert.deepEqual(getPlayerResourceTotals(player, { visibleOnly: true }), {
    wood: 11,
    berry: 0,
    meat: 0,
    wheat: 0,
    stone: 1,
    food: 0,
  })
})

test('missing chest resources compares costs against stored chest totals', () => {
  const { getMissingPlayerResources } = loadResourceTotals()
  const player = {
    label: 'p1',
    buildings: [{ owner: { label: 'p1' }, type: 'Chest', inventory: { resources: { wood: 7, wheat: 1 } } }],
  }

  assert.deepEqual(getMissingPlayerResources(player, { wood: 5, food: 3, stone: 2 }, { includeHero: false }), {
    food: 2,
    stone: 2,
  })
})

test('a non-chief player spends only the active hero bag while village upkeep keeps its stores', () => {
  const { getPlayerResourceTotals, getMissingPlayerResources, withdrawChestResources } = loadResourceTotals()
  const player = { label: 'human', isPlayed: true, buildings: [], units: [] }
  const hero = { type: 'Hero', isChief: false, owner: player, inventory: { resources: { wood: 3, berry: 2 } } }
  const chest = { type: 'Chest', owner: player, inventory: { resources: { wood: 100, berry: 50 } } }
  player.units.push(hero)
  player.buildings.push(chest)
  assert.equal(getPlayerResourceTotals(player).wood, 3)
  assert.deepEqual(getMissingPlayerResources(player, { wood: 5 }, { hero }), { wood: 2 })
  assert.equal(withdrawChestResources(player, { wood: 5 }, { hero }), false)
  assert.equal(chest.inventory.resources.wood, 100)
  assert.equal(hero.inventory.resources.wood, 3)
  assert.equal(withdrawChestResources(player, { wood: 2, food: 1 }, { hero }), true)
  assert.equal(hero.inventory.resources.wood, 1)
  assert.equal(hero.inventory.resources.berry, 1)
  assert.equal(chest.inventory.resources.berry, 50)
  assert.equal(getPlayerResourceTotals(player, { includeHero: false }).wood, 100)
  assert.equal(withdrawChestResources(player, { berry: 2 }, { includeHero: false }), true)
  assert.equal(chest.inventory.resources.berry, 48)
  hero.isChief = true
  assert.equal(getPlayerResourceTotals(player).wood, 101)
  assert.equal(withdrawChestResources(player, { wood: 5 }), true)
  assert.equal(chest.inventory.resources.wood, 95)
})

test('blocking automatic deliveries does not reserve chest resources against construction spending', () => {
  const { depositChestResources, withdrawChestResources } = loadResourceTotals()
  const player = { label: 'p', buildings: [] }
  const chest = { type: 'Chest', owner: player, isBuilt: true, villagerDeliveriesBlocked: true, inventory: { resources: { wood: 20 } } }
  player.buildings.push(chest)
  assert.equal(depositChestResources(player, { wood: 10 }, { automaticDelivery: true }), false)
  assert.equal(chest.inventory.resources.wood, 20)
  assert.equal(depositChestResources(player, { wood: 10 }), true)
  assert.equal(withdrawChestResources(player, { wood: 10 }, { includeHero: false }), true)
  assert.equal(chest.inventory.resources.wood, 20)
})
