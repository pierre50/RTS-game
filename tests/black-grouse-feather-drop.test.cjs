const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { initializeAnimalCorpseLoot } = loadTsModule('app/lib/equipment/animalCorpseLoot.ts')

test('black grouse drops named feathers once, without mammal materials', () => {
  const animal = { type: 'BlackGrouse', isDead: true, quantity: 5 }
  initializeAnimalCorpseLoot(animal, () => 0)
  assert.deepEqual(animal.inventory.resources, { meat: 5, feather: 1 })
  const saved = JSON.parse(JSON.stringify(animal))
  initializeAnimalCorpseLoot(saved, () => assert.fail('loot must not be rolled twice'))
  assert.deepEqual(saved.inventory.resources, animal.inventory.resources)
})

test('mammal materials remain attached to the corpse until taken', () => {
  const animal = { type: 'Deer', isDead: true, quantity: 20 }
  initializeAnimalCorpseLoot(animal, () => 0)
  assert.deepEqual(animal.inventory.resources, { meat: 20, leather: 1, sinew: 1 })
  animal.inventory.resources.meat -= 1
  initializeAnimalCorpseLoot(animal, () => assert.fail('harvesting must not create extra loot'))
  assert.deepEqual(animal.inventory.resources, { meat: 19, leather: 1, sinew: 1 })
})
