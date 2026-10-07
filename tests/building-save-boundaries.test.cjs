const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validatePlayerRecord } = loadTsModule('app/serialization/validation/PlayerRecordValidation.ts')
const validate = building =>
  validatePlayerRecord(
    { type: 'Human', isPlayed: true, buildings: [building] },
    0,
    16,
    { buildings: { StoragePit: {}, Cave: {} } },
    undefined,
    true
  )
const building = patch => ({ type: 'StoragePit', i: 1, j: 1, label: 'depot', ...patch })
test('home residents and planned beds reject malformed or duplicate identities', () => {
  assert.doesNotThrow(() =>
    validate(building({ heroHomeResident: { label: 'friend', name: 'Friend' }, plannedBedLabels: ['bed'] }))
  )
  for (const heroHomeResident of [false, { label: 1 }, { label: '' }, { label: 'friend', name: 1 }])
    assert.throws(() => validate(building({ heroHomeResident })), /hero home resident/)
  for (const plannedBedLabels of [false, [1], [''], ['bed', 'bed']])
    assert.throws(() => validate(building({ plannedBedLabels })), /bed identities/)
  assert.throws(() => validate(null), /building is invalid/)
})
test('construction ledgers reject invalid quantities and materials beyond the recipe', () => {
  const ledger = { cost: { wood: 3 }, delivered: {}, consumed: { wood: 1 } }
  assert.doesNotThrow(() => validate(building({ constructionMaterials: ledger })))
  for (const constructionWorkRequired of [0, -1, Infinity, '1'])
    assert.throws(() => validate(building({ constructionWorkRequired })), /construction work/)
  for (const constructionMaterials of [
    false,
    ...['cost', 'delivered', 'consumed'].map(key => ({ ...ledger, [key]: false })),
    ...['2', 0.5, -1].map(wood => ({ ...ledger, cost: { wood } })),
    { ...ledger, delivered: { wood: 3 } },
    { ...ledger, delivered: { stone: 1 } },
  ])
    assert.throws(() => validate(building({ constructionMaterials })), /construction material|Construction materials/)
})
test('cave definitions can only belong to cave buildings', () => {
  const cave = { id: 'cave', tier: 'small', seed: 0, blueprintId: 'cave-small-circle' }
  assert.throws(() => validate(building({ cave })), /cave building type/)
  assert.doesNotThrow(() => validate(building({ type: 'Cave', cave })))
})

test('settlement names accept old saves and reject invalid saved values', () => {
  for (const settlementName of [undefined, 'Athènes', 'Uruk 2'])
    assert.doesNotThrow(() => validate(building({ settlementName })))
  for (const settlementName of [false, 42, '', '   ', 'a'.repeat(121)])
    assert.throws(() => validate(building({ settlementName })), /settlement name/)
})
