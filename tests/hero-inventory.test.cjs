const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const discoveries = []
const { getHeroInventory, addHeroInventoryItem, removeHeroInventoryItem } = loadTsModule(
  'app/lib/equipment/heroInventory.ts',
  {
    mocks: { './equipmentDiscoveries': { discoverHeroEquipment: (hero, item) => discoveries.push([hero, item]) } },
  }
)
test('inventory initialization fills missing containers and preserves existing references', () => {
  const hero = { inventory: { equipment: ['arrow'], equipped: { helmet: 'iron' } } }
  const original = hero.inventory
  const bag = original.equipment
  const initialized = getHeroInventory(hero)
  assert.equal(initialized, original)
  assert.equal(initialized.equipment, bag)
  assert.deepEqual(initialized.equipped, { helmet: 'iron' })
  assert.deepEqual(initialized.resources, {})
  assert.deepEqual(initialized.equippedCounts, {})
  assert.deepEqual(initialized.activeWeapons, {})
  assert.equal(getHeroInventory(hero), initialized)
  assert.deepEqual(getHeroInventory({}).equipment, [])
})
test('inventory removals are atomic and additions report equipment discovery', () => {
  const hero = { inventory: { equipment: ['arrow', 'sword', 'arrow'] } }
  assert.equal(removeHeroInventoryItem(hero, 'arrow', 3), false)
  assert.deepEqual(hero.inventory.equipment, ['arrow', 'sword', 'arrow'])
  assert.equal(removeHeroInventoryItem(hero, 'arrow', 2), true)
  assert.deepEqual(hero.inventory.equipment, ['sword'])
  assert.equal(addHeroInventoryItem(hero, 'bow', 2.9), true)
  assert.deepEqual(hero.inventory.equipment, ['sword', 'bow', 'bow'])
  assert.deepEqual(discoveries.at(-1), [hero, 'bow'])
  assert.equal(removeHeroInventoryItem(hero, 'bow'), true)
  assert.equal(addHeroInventoryItem(hero, 'arrow'), true)
})
test('nonfinite counts and missing inputs never mutate an inventory or claim success', () => {
  const hero = { inventory: { equipment: ['arrow'] } }
  for (const operation of [addHeroInventoryItem, removeHeroInventoryItem]) {
    for (const count of [NaN, Infinity, -Infinity]) assert.equal(operation(hero, 'arrow', count), false)
    assert.equal(operation(null, 'arrow'), false)
    assert.equal(operation(hero, ''), false)
  }
  assert.deepEqual(hero.inventory.equipment, ['arrow'])
})
