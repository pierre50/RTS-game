const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const mocks = {
  '../grid/queries': {
    getClosestInstanceWithPath: (_unit, candidates) => (candidates.length ? { instance: candidates[0] } : null),
  },
  '../units/unitControl': { isHeroControlled: unit => unit.controlMode === 'hero' },
}
const loot = loadTsModule('app/lib/equipment/animalCorpseLoot.ts', { mocks })
function corpse(resources) {
  return {
    type: 'Deer',
    family: 'animal',
    isDead: true,
    quantity: resources?.meat ?? 40,
    ...(resources ? { inventory: { resources: { ...resources } } } : {}),
  }
}
function hunter(types = ['TownCenter']) {
  const owner = { buildings: [] }
  owner.buildings = types.map(type => ({
    type,
    family: 'building',
    owner,
    isBuilt: true,
    i: 0,
    j: 0,
    inventory: { resources: {} },
  }))
  return { type: 'Villager', owner, i: 0, j: 0, inventory: { resources: {} } }
}

test('kill rolls materials once; opening and reload preserve exact remaining loot', () => {
  const animal = corpse()
  let rolls = 0
  loot.initializeAnimalCorpseLoot(animal, () => {
    rolls++
    return 0
  })
  assert.deepEqual(animal.inventory.resources, { meat: 40, leather: 1, sinew: 1 })
  assert.equal(rolls, 4)
  delete animal.inventory.resources.leather
  const saved = JSON.parse(JSON.stringify(animal))
  loot.initializeAnimalCorpseLoot(saved, () => {
    throw Error('reroll')
  })
  assert.deepEqual(saved.inventory.resources, { meat: 40, sinew: 1 })
  const empty = corpse({})
  loot.initializeAnimalCorpseLoot(empty, () => {
    throw Error('reroll')
  })
  assert.equal(empty.quantity, 0)
})

test('old saves migrate remaining meat without retrospective materials', () => {
  const animal = corpse()
  animal.quantity = 7
  loot.initializeAnimalCorpseLoot(animal)
  assert.deepEqual(animal.inventory.resources, { meat: 7 })
})

test('hero can take leather without meat and capacity clamps transfers', () => {
  const animal = corpse({ meat: 40, leather: 3 })
  const hero = { controlMode: 'hero', inventory: { resources: { wood: 49 } } }
  assert.equal(loot.pickupAnimalResource(animal, hero, 'leather'), 1)
  assert.deepEqual(animal.inventory.resources, { meat: 40, leather: 2 })
  assert.equal(loot.pickupAnimalResource(animal, hero, 'meat'), 0)
  assert.equal(animal.quantity, 40)
})

test('hunters take meat first, leave overflow, and share the remainder with the hero', () => {
  const animal = corpse({ meat: 40, leather: 3 })
  const unit = hunter()
  assert.equal(loot.takeAnimalLootForDelivery(animal, unit), 30)
  assert.deepEqual(unit.inventory.resources, { meat: 30 })
  assert.equal(animal.quantity, 10)
  const hero = { controlMode: 'hero' }
  assert.equal(loot.pickupAnimalResource(animal, hero, 'leather'), 3)
  unit.inventory.resources = {}
  assert.equal(loot.takeAnimalLootForDelivery(animal, unit), 10)
  assert.equal(loot.hasAnimalCorpseLoot(animal), false)
  assert.equal(loot.takeAnimalLootForDelivery(animal, hunter()), 0)
})

test('hunters only collect resources with eligible storage, including capacity and blocked deliveries', () => {
  const animal = corpse({ meat: 5, leather: 3 })
  const unit = hunter(['Granary'])
  assert.equal(loot.takeAnimalLootForDelivery(animal, unit), 5)
  assert.deepEqual(animal.inventory.resources, { leather: 3 })
  assert.equal(loot.hasAnimalCorpseLoot(animal), true)
  const collector = hunter(['StoragePit'])
  assert.equal(loot.takeAnimalLootForDelivery(animal, collector), 3)
  const blocked = hunter()
  blocked.owner.buildings[0].villagerDeliveriesBlocked = true
  assert.equal(loot.takeAnimalLootForDelivery(corpse({ meat: 5 }), blocked), 0)
  const nearlyFull = hunter()
  nearlyFull.owner.buildings[0].inventory.resources.wood = 598
  assert.equal(loot.takeAnimalLootForDelivery(corpse({ meat: 5, leather: 3 }), nearlyFull), 2)
})

test('two hunters cannot duplicate the same stock and destroyed corpses cannot be looted', () => {
  const animal = corpse({ meat: 15, leather: 2 })
  assert.equal(loot.takeAnimalLootForDelivery(animal, hunter()), 17)
  assert.equal(loot.takeAnimalLootForDelivery(animal, hunter()), 0)
  animal.isDestroyed = true
  animal.inventory.resources.meat = 20
  assert.equal(loot.pickupAnimalResource(animal, hunter(), 'meat'), 0)
})

const { validateAnimalState } = loadTsModule('app/serialization/SaveAnimalState.ts')
test('animal save validation rejects corrupt or inconsistent loot', () => {
  const animal = corpse({ meat: 3, leather: 2 })
  assert.doesNotThrow(() => validateAnimalState(animal, { totalQuantity: 40 }, 20, 'deer'))
  for (const resources of [{ meat: 4 }, { meat: 3, leather: -1 }, { meat: 3, leather: 0.5 }, { meat: 3, fake: 1 }]) {
    assert.throws(
      () => validateAnimalState({ ...animal, inventory: { resources } }, { totalQuantity: 40 }, 20, 'deer'),
      /Invalid save/
    )
  }
})

test('returning hunters skip loot they cannot deposit', () => {
  const animal = corpse({ leather: 2 })
  assert.equal(loot.canRecoverAnimalLootForDelivery(animal, hunter(['Granary'])), false)
  assert.equal(loot.canRecoverAnimalLootForDelivery(animal, hunter(['StoragePit'])), true)
})
