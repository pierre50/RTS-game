const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validateAnimalState } = loadTsModule('app/serialization/SaveAnimalState.ts')

test('animal information keeps corpse health at zero and loot out of the health bar', () => {
  const calls = []
  const { AnimalInterface } = loadTsModule('app/ui/entity/AnimalInterface.ts', {
    mocks: {
      './BaseEntityInterface': {
        appendBaseEntityInfo: (...args) => calls.push(args),
        appendQuantityInfo: () => {
          throw new Error('Unexpected second quantity display')
        },
      },
      './EntityDescription': { getEntityDescription: animal => (animal.isDead ? 'Corpse' : 'Alive') },
      '../utils/entityDisplayName': { getEntityDisplayName: () => 'Deer' },
    },
  })
  const animal = { hitPoints: 5, totalHitPoints: 10, quantity: 15, totalQuantity: 23 }
  const ui = new AnimalInterface(animal)
  ui.setDefaultInterface({}, {})
  assert.deepEqual(calls.at(-1).slice(3, 5), [5, 10])
  animal.isDead = true
  ui.setDefaultInterface({}, {})
  assert.deepEqual(calls.at(-1).slice(3, 5), [0, 10])
  animal.quantity = 0
  animal.inventory = { resources: { leather: 2 } }
  ui.setDefaultInterface({}, {})
  assert.deepEqual(calls.at(-1).slice(3, 5), [0, 10])
  assert.equal(calls.length, 3)
})

test('animal saves validate remaining meat against their saved capacity', () => {
  const definition = { totalQuantity: 20, totalHitPoints: 10 }
  const validate = state => validateAnimalState(state, definition, 10, 'animal')
  assert.doesNotThrow(() => validate({ quantity: 23, totalQuantity: 30 }))
  assert.doesNotThrow(() => validate({ quantity: 15, totalQuantity: 23, isDead: true, hitPoints: 0 }))
  assert.throws(() => validate({ quantity: 24, totalQuantity: 23 }), /quantity/)
  assert.throws(() => validate({ quantity: 21 }), /quantity/)
  for (const totalQuantity of [-1, NaN, Infinity]) assert.throws(() => validate({ totalQuantity }), /totalQuantity/)
})
