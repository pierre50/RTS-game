const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { isValidCondition } = loadTsModule('app/lib/combat/configConditions.ts')

test('all building definitions are eligible from the Stone Age without discoveries', () => {
  const config = require('../public/assets/data/gameplay/buildings.json')
  for (const age of [0, 1, 2]) {
    const player = { age, discoveredEquipment: [], completedObjectives: [] }
    for (const [type, entry] of Object.entries(config)) {
      assert.equal(
        (entry.conditions ?? []).every(condition => isValidCondition(condition, player)),
        true,
        `${type}, age ${age}`
      )
    }
  }
})

test('configuration comparisons preserve numeric boundaries and unordered array equality', () => {
  for (const [op, value, actual, expected] of [
    ['=', 2, 2, true],
    ['!=', 2, 2, false],
    ['!=', 2, 3, true],
    ['<', 3, '2', true],
    ['<', 2, 2, false],
    ['<=', 2, 2, true],
    ['>=', 2, 2, true],
    ['>', 2, 3, true],
    ['>', 2, 2, false],
    ['=', ['a', 'b'], ['b', 'a'], true],
    ['=', ['a'], ['a', 'b'], false],
    ['=', ['a', 'c'], ['a', 'b'], false],
    ['=', ['a'], 'a', false],
    ['includes', 'a', ['a', 'b'], true],
    ['includes', 'c', ['a'], false],
    ['includes', 'a', 'a', false],
    ['notincludes', 'c', ['a'], true],
    ['notincludes', 'a', ['a'], false],
    ['notincludes', 'a', 'b', false],
  ])
    assert.equal(isValidCondition({ op, key: 'test', value }, { test: actual }), expected)
})

test('configuration guards distinguish optional discovery from malformed rules', () => {
  assert.equal(isValidCondition(null, {}), true)
  assert.equal(isValidCondition(undefined, {}), true)
  assert.equal(isValidCondition({ op: 'includes', key: 'discoveredEquipment', value: 'axe' }, {}), false)
  assert.equal(isValidCondition({ op: 'includes', key: 'completedObjectives', value: 'craftBow' }, {}), false)
  assert.throws(() => isValidCondition({ op: '=', key: 'missing', value: 1 }, {}), /Key not found/)
  assert.throws(
    () => isValidCondition({ op: 'invalid', key: 'test', value: 1 }, { test: 1 }),
    /Invalid condition operation/
  )
})
