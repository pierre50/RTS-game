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

test('player chest resource totals sum only owned living depots', () => {
  const { getPlayerResourceTotals } = loadResourceTotals()
  const player = { label: 'p1', buildings: [] }
  const other = { label: 'p2' }
  player.buildings = [
    {
      owner: player,
      i: 0,
      j: 0,
      type: 'StoragePit',
      inventory: { resources: { wood: 5.8, wheat: 3 } },
    },
    {
      owner: { label: 'p1' },
      i: 0,
      j: 0,
      type: 'StoragePit',
      inventory: { resources: { wood: 2, stone: 4 } },
    },
    {
      owner: other,
      i: 0,
      j: 0,
      type: 'StoragePit',
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
      i: 0,
      j: 0,
      type: 'StoragePit',
      inventory: { resources: { wheat: 99 } },
    },
  ]

  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
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
  const hero = { owner: player, i: 0, j: 0, type: 'Hero', inventory: { resources: { wood: 4, stone: 1 } } }
  player.units = [hero]
  player.buildings = [
    { owner: player, i: 0, j: 0, type: 'StoragePit', inventory: { resources: { wood: 7 } } },
    { owner: player, i: 0, j: 0, type: 'TownCenter', inventory: { resources: { wheat: 8 } } },
    { owner: player, i: 0, j: 0, type: 'StoragePit', inventory: { resources: { stone: 2 } } },
  ]

  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
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
  const hero = { owner: player, i: 0, j: 0, type: 'Hero', inventory: { resources: { wood: 4, stone: 1 } } }
  player.units = [hero]
  player.buildings = [
    { i: 2, j: 3, owner: player, type: 'StoragePit', inventory: { resources: { wood: 7 } } },
    { i: 8, j: 9, owner: player, type: 'StoragePit', inventory: { resources: { wood: 99, wheat: 99 } } },
    { i: 8, j: 9, owner: player, type: 'TownCenter', inventory: { resources: { wheat: 8 } } },
  ]

  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
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
    buildings: [
      { owner: { label: 'p1' }, i: 0, j: 0, type: 'StoragePit', inventory: { resources: { wood: 7, wheat: 1 } } },
    ],
  }

  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
  assert.deepEqual(getMissingPlayerResources(player, { wood: 5, food: 3, stone: 2 }, { includeHero: false }), {
    food: 2,
    stone: 2,
  })
})

test('a non-chief player spends only the active hero bag while village upkeep keeps its stores', () => {
  const { getPlayerResourceTotals, getMissingPlayerResources, withdrawChestResources } = loadResourceTotals()
  const player = { label: 'human', isPlayed: true, buildings: [], units: [] }
  const hero = {
    i: 0,
    j: 0,
    type: 'Hero',
    isChief: false,
    owner: player,
    inventory: { resources: { wood: 3, berry: 2 } },
  }
  const chest = { i: 0, j: 0, type: 'StoragePit', owner: player, inventory: { resources: { wood: 100, berry: 50 } } }
  player.units.push(hero)
  player.buildings.push(chest)
  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
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

test('obsolete delivery flags do not block dedicated depots', () => {
  const { depositChestResources, withdrawChestResources } = loadResourceTotals()
  const player = { label: 'p', buildings: [] }
  const chest = {
    i: 0,
    j: 0,
    type: 'StoragePit',
    owner: player,
    isBuilt: true,
    villagerDeliveriesBlocked: true,
    inventory: { resources: { wood: 20 } },
  }
  player.buildings.push(chest)
  player.buildings.push({ type: 'TownCenter', i: 0, j: 0, owner: player })
  assert.equal(depositChestResources(player, { wood: 10 }, { automaticDelivery: true }), true)
  assert.equal(chest.inventory.resources.wood, 30)
  assert.equal(depositChestResources(player, { wood: 10 }), true)
  assert.equal(withdrawChestResources(player, { wood: 10 }, { includeHero: false }), true)
  assert.equal(chest.inventory.resources.wood, 30)
})

test('mixed deposits reserve shared capacity atomically and can span several depots', () => {
  const { depositChestResources } = loadTsModule('app/lib/resources/playerResourceTotals.ts')
  const player = {
    label: 'p',
    buildings: [
      { type: 'TownCenter', i: 0, j: 0, inventory: { resources: { wood: 300 } } },
      { type: 'StoragePit', i: 2, j: 2, inventory: { resources: { wood: 290 } } },
    ],
  }
  const before = structuredClone(player)
  assert.equal(depositChestResources(player, { wood: 15, stone: 10 }), false)
  assert.deepEqual(player, before)
  player.buildings.push({ type: 'StoragePit', i: 3, j: 3, inventory: { resources: {} } })
  assert.equal(depositChestResources(player, { wood: 15, stone: 10 }), true)
  assert.equal(player.wood, 605)
  assert.equal(player.stone, 10)
  assert.ok(player.buildings.every(b => Object.values(b.inventory.resources).reduce((a, b) => a + b, 0) <= 300))
})
