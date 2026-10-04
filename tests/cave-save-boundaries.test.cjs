const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validateCaveDefinition, validateCaveOccupantReferences } = loadTsModule('app/serialization/CaveSave.ts')
const cave = () => ({ id: 'cave', tier: 'small', blueprintId: 'cave-small-circle', seed: 0 })
const content = () => ({
  ownerLabel: 'bandits',
  campIndex: 0,
  generated: false,
  inventory: { resources: { wood: 0 }, equipment: ['sword'] },
})
const mineral = () => ({ type: 'Iron', i: 0, j: 31, totalQuantity: 10, quantity: 0 })
test('cave definition rejects malformed identity, blueprint and seed', () => {
  for (const [tier, pattern] of [
    ['small', 'circle'],
    ['medium', 'branches'],
    ['large', 'chamber'],
  ])
    assert.doesNotThrow(() => validateCaveDefinition({ ...cave(), tier, blueprintId: `cave-${tier}-${pattern}` }))
  for (const value of [
    null,
    ...[
      { id: 1 },
      { id: '' },
      { tier: 'giant' },
      { blueprintId: 1 },
      { blueprintId: 'cave-small-loop' },
      { seed: 0.5 },
      { seed: -1 },
    ].map(patch => ({ ...cave(), ...patch })),
  ])
    assert.throws(() => validateCaveDefinition(value), /cave definition/)
})
test('bandit cave contents validate ownership, generation status and inventory', () => {
  for (const inventory of [{}, { resources: null, equipment: null }, content().inventory])
    assert.doesNotThrow(() => validateCaveDefinition({ ...cave(), banditContent: { ...content(), inventory } }))
  for (const banditContent of [
    false,
    ...[
      { ownerLabel: 1 },
      { ownerLabel: '' },
      { campIndex: 0.5 },
      { campIndex: -1 },
      { inventory: false },
      { generated: 'yes' },
      ...[
        { resources: false },
        ...['2', Infinity, -1].map(wood => ({ resources: { wood } })),
        { equipment: false },
        { equipment: [1] },
      ].map(inventory => ({ inventory })),
    ].map(patch => ({ ...content(), ...patch })),
  ])
    assert.throws(() => validateCaveDefinition({ ...cave(), banditContent }), /bandit cave/)
})
test('mineral stocks respect cave dimensions, capacity and unique positions', () => {
  assert.doesNotThrow(() => validateCaveDefinition({ ...cave(), minerals: [mineral()] }))
  assert.doesNotThrow(() =>
    validateCaveDefinition({
      ...cave(),
      tier: 'large',
      blueprintId: 'cave-large-loop',
      minerals: [{ ...mineral(), i: 63, j: 63, quantity: 10 }],
    })
  )
  for (const minerals of [
    false,
    Array(7).fill(mineral()),
    [null],
    ...[
      { type: 'Stone' },
      { i: 32 },
      { j: -1 },
      { i: 0.5 },
      { totalQuantity: 0 },
      { totalQuantity: 11 },
      { totalQuantity: 1.5 },
      { quantity: -1 },
      { quantity: 11 },
      { quantity: 0.5 },
    ].map(patch => [{ ...mineral(), ...patch }]),
    [mineral(), mineral()],
  ])
    assert.throws(() => validateCaveDefinition({ ...cave(), minerals }), /mineral/)
})
test('cave occupants include corpses and require a unique existing cave and valid position', () => {
  assert.doesNotThrow(() =>
    validateCaveOccupantReferences([
      {},
      { buildings: [{}, { cave: cave() }], units: [{}], corpses: [{ cavePosition: { caveId: 'cave', i: 0, j: 31 } }] },
    ])
  )
  assert.throws(
    () => validateCaveOccupantReferences([{ buildings: [{ cave: cave() }, { cave: cave() }] }]),
    /Duplicate cave/
  )
  for (const cavePosition of [
    false,
    { caveId: 1 },
    { caveId: 'missing' },
    ...[
      { i: -1, j: 1 },
      { i: 0, j: 32 },
      { i: 0.5, j: 0 },
    ].map(p => ({ caveId: 'cave', ...p })),
  ])
    assert.throws(
      () => validateCaveOccupantReferences([{ buildings: [{ cave: cave() }], units: [{ cavePosition }] }]),
      /cave/
    )
  assert.doesNotThrow(() =>
    validateCaveOccupantReferences([
      {
        buildings: [{ cave: { ...cave(), tier: 'large' } }],
        units: [{ cavePosition: { caveId: 'cave', i: 63, j: 63 } }],
      },
    ])
  )
})
