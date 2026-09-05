const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadInventoryContainers() {
  return loadTsModule('app/lib/inventory/inventoryContainers.ts', {
    mocks: {
      '../../constants': {
        RESOURCE_STORAGE_NAMES: ['wood', 'berry', 'meat', 'wheat', 'stone', 'gold', 'copper', 'iron'],
      },
    },
  })
}

test('inventory containers move equipment between reusable inventories', () => {
  const { createInventoryContainer, moveInventoryEquipment } = loadInventoryContainers()
  const hero = { inventory: { equipment: ['trap', 'chest'] } }
  const chest = {}
  const heroContainer = createInventoryContainer(hero, { id: 'hero', labelKey: 'inventoryBag' })
  const chestContainer = createInventoryContainer(chest, { id: 'chest', labelKey: 'inventoryChest' })

  assert.equal(moveInventoryEquipment(heroContainer, chestContainer, 'trap'), true)

  assert.deepEqual(hero.inventory.equipment, ['chest'])
  assert.deepEqual(chest.inventory.equipment, ['trap'])
})

test('inventory containers move resources between reusable inventories', () => {
  const { createInventoryContainer, moveInventoryResource } = loadInventoryContainers()
  const hero = { inventory: { resources: { wood: 12 } } }
  const chest = { inventory: { resources: { wheat: 3 } } }
  const heroContainer = createInventoryContainer(hero, { id: 'hero', labelKey: 'inventoryBag' })
  const chestContainer = createInventoryContainer(chest, { id: 'chest', labelKey: 'inventoryChest' })

  assert.equal(moveInventoryResource(heroContainer, chestContainer, 'wood', 5), 5)

  assert.deepEqual(hero.inventory.resources, { wood: 7 })
  assert.deepEqual(chest.inventory.resources, { wheat: 3, wood: 5 })
})

test('inventory containers respect destination acceptance rules', () => {
  const { createInventoryContainer, moveInventoryEquipment, moveInventoryResource } = loadInventoryContainers()
  const hero = { inventory: { equipment: ['trap'], resources: { wood: 12 } } }
  const locked = {}
  const heroContainer = createInventoryContainer(hero, { id: 'hero', labelKey: 'inventoryBag' })
  const lockedContainer = createInventoryContainer(locked, {
    id: 'locked',
    labelKey: 'inventoryChest',
    canAcceptEquipment: () => false,
    canAcceptResource: () => false,
  })

  assert.equal(moveInventoryEquipment(heroContainer, lockedContainer, 'trap'), false)
  assert.equal(moveInventoryResource(heroContainer, lockedContainer, 'wood'), 0)

  assert.deepEqual(hero.inventory.equipment, ['trap'])
  assert.deepEqual(hero.inventory.resources, { wood: 12 })
  assert.deepEqual(locked.inventory.equipment, [])
  assert.deepEqual(locked.inventory.resources, {})
})

test('inventory containers default resource moves still move the whole stack', () => {
  const { createInventoryContainer, moveInventoryResource } = loadInventoryContainers()
  const hero = { inventory: { resources: { wood: 12 } } }
  const chest = {}
  const heroContainer = createInventoryContainer(hero, { id: 'hero', labelKey: 'inventoryBag' })
  const chestContainer = createInventoryContainer(chest, { id: 'chest', labelKey: 'inventoryChest' })

  assert.equal(moveInventoryResource(heroContainer, chestContainer, 'wood'), 12)

  assert.deepEqual(hero.inventory.resources, {})
  assert.deepEqual(chest.inventory.resources, { wood: 12 })
})
