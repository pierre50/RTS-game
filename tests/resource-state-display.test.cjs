const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const renders = []
const { ResourceInterface } = loadTsModule('app/ui/entity/ResourceInterface.ts', {
  mocks: {
    './EntityDescription': { getEntityDescription: resource => `${resource.type}:${resource.quantity}` },
    './BaseEntityInterface': {
      appendBaseEntityInfo: (...args) => renders.push(args),
      appendQuantityInfo: () => {
        throw new Error('Resources must only display one bar')
      },
    },
    '../utils/entityDisplayName': { getEntityDisplayName: resource => resource.type },
  },
})

function render(resource) {
  const before = renders.length
  new ResourceInterface(resource).setDefaultInterface({}, {}, { hideIdentity: true })
  assert.equal(renders.length, before + 1)
  const [, , , current, total, options] = renders.at(-1)
  assert.equal(options.hideType, true)
  return [current, total]
}

test('one resource bar switches from tree resistance to remaining wood after felling', () => {
  const tree = { type: 'Tree', hitPoints: 10, totalHitPoints: 25, quantity: 150, totalQuantity: 180 }
  assert.deepEqual(render(tree), [10, 25])
  tree.hitPoints = 0
  assert.deepEqual(render(tree), [150, 180])
  tree.quantity = 20
  assert.deepEqual(render(tree), [20, 180])
  tree.hitPoints = 10
  tree.isCutOrFallenTree = () => true
  assert.deepEqual(render(tree), [20, 180])
})

test('one bush bar follows berries, then destruction resistance, then renewed berries', () => {
  const bush = { type: 'Berrybush', hitPoints: 4, totalHitPoints: 4, quantity: 12, totalQuantity: 55 }
  assert.deepEqual(render(bush), [12, 55])
  bush.quantity = 0
  assert.deepEqual(render(bush), [4, 4])
  bush.hitPoints = 2
  assert.deepEqual(render(bush), [2, 4])
  bush.quantity = 3
  assert.deepEqual(render(bush), [3, 55])
})

test('mineral bars display remaining stock even when health is zero', () => {
  for (const type of ['Stone', 'Gold', 'Copper', 'Iron']) {
    assert.deepEqual(render({ type, hitPoints: 0, quantity: 23, totalQuantity: 100 }), [23, 100])
    assert.deepEqual(render({ type, hitPoints: 0, quantity: 0, totalQuantity: 100 }), [0, 100])
  }
})
