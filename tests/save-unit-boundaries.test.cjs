const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validatePlayerUnits, validatePlayerCorpses } = loadTsModule(
  'app/serialization/validation/SaveUnitValidators.ts'
)
const config = { units: { Villager: {} } }
const unit = () => ({ i: 1, j: 1, label: 'worker', type: 'Villager' })
const validate = changes => validatePlayerUnits([{ ...unit(), ...changes }], 0, 32, config)
const schedule = () => ({ wakeMinute: 300, workStartMinute: 360, workEndMinute: 1080, bedMinute: 1200 })
const expedition = () => ({
  raidId: 'raid',
  factionId: 'clan',
  regionId: 'region',
  playerLabel: 'owner',
  phase: 'approaching',
  original: unit(),
  tribute: { wood: 2 },
})

for (const field of ['homeHouseLabel', 'homeBedLabel', 'partnerLabel']) {
  test(`household reference ${field} rejects empty or non-string identities`, () => {
    for (const value of ['', 3, {}, false]) assert.throws(() => validate({ [field]: value }), /household reference/)
    for (const value of [undefined, null, 'home']) assert.doesNotThrow(() => validate({ [field]: value }))
  })
}
for (const [field, valid, invalid] of [
  [
    'collectiveHome',
    { i: 0, j: 8193 },
    [
      false,
      { i: 0.5, j: 1 },
      { i: 1, j: 0.5 },
      { i: -1, j: 1 },
      { i: 1, j: -1 },
      { i: 8194, j: 1 },
      { i: 1, j: 8194 },
      { i: 1, j: 1, spaceId: '' },
      { i: 1, j: 1, spaceId: 4 },
    ],
  ],
  [
    'villageHome',
    { id: 'village', spaceId: 'outside', i: 0, j: 32 },
    [
      false,
      { id: 1 },
      { id: '' },
      { id: 'village', spaceId: 'inside' },
      ...[
        { i: 0.5, j: 1 },
        { i: 1, j: 0.5 },
        { i: -1, j: 1 },
        { i: 1, j: -1 },
        { i: 33, j: 1 },
        { i: 1, j: 33 },
      ].map(position => ({ id: 'village', spaceId: 'outside', ...position })),
    ],
  ],
  [
    'campBehavior',
    { phase: 'return', homeSpaceId: 'outside', caveId: 'cave', chaseRange: 1, tetherRange: 2 },
    [
      false,
      { phase: 'unknown' },
      { phase: 'guard', homeSpaceId: 2 },
      { phase: 'guard', caveId: 2 },
      ...['chaseRange', 'tetherRange'].flatMap(key =>
        ['2', Infinity, 0, -1].map(value => ({ phase: 'pursue', [key]: value }))
      ),
    ],
  ],
  [
    'offlineWork',
    { target: 'tree', milliseconds: 0 },
    [
      false,
      { target: 1 },
      { target: 'tree', milliseconds: '2' },
      { target: 'tree', milliseconds: Infinity },
      { target: 'tree', milliseconds: -1 },
    ],
  ],
]) {
  test(`${field} accepts boundaries and rejects malformed saved state`, () => {
    assert.doesNotThrow(() => validate({ [field]: valid }))
    for (const value of invalid) assert.throws(() => validate({ [field]: value }), /Invalid/)
  })
}
test('saved delivery and cave orders validate references and resource quantities', () => {
  const task = {
    dest: [2, 3, 'tree'],
    action: 'chopwood',
    work: 'woodcutter',
    autonomousJob: 'wood',
    collectiveTask: 'gather',
  }
  assert.doesNotThrow(() =>
    validate({
      cavePosition: { i: 1, j: 1 },
      caveOrders: { ...task, previousDest: 'tree', path: [{ i: 1, j: 2 }], realDest: { i: 1, j: 2 } },
      resourceDelivery: { building: 'depot', pickup: { wood: 0, stone: 2 }, returnTask: task },
    })
  )
  assert.doesNotThrow(() =>
    validate({ resourceDelivery: { building: null, pickup: null, returnTask: { dest: null } } })
  )
  for (const caveOrders of [false, { dest: null }]) assert.throws(() => validate({ caveOrders }), /caveOrders/)
  for (const resourceDelivery of [
    false,
    { pickup: false },
    ...['2', Infinity, -1].map(wood => ({ pickup: { wood } })),
    { returnTask: false },
  ])
    assert.throws(() => validate({ resourceDelivery }), /resourceDelivery/)
  for (const key of ['action', 'work', 'autonomousJob', 'collectiveTask'])
    assert.throws(() => validate({ resourceDelivery: { returnTask: { ...task, [key]: 42 } } }), new RegExp(key))
})
test('daily schedule rejects invalid minutes, ordering and lunch boundaries', () => {
  assert.doesNotThrow(() => validate({ dailySchedule: schedule(), lastMealAt: 0 }))
  assert.doesNotThrow(() =>
    validate({ dailySchedule: { ...schedule(), nightWatch: 'late', lunchStartMinute: 360, lunchEndMinute: 1080 } })
  )
  for (const lastMealAt of ['0', Infinity, -1]) assert.throws(() => validate({ lastMealAt }), /lastMealAt/)
  for (const dailySchedule of [
    false,
    { ...schedule(), nightWatch: 'day' },
    ...['300', 1.5, -1, 1440].map(wakeMinute => ({ ...schedule(), wakeMinute })),
    { ...schedule(), workStartMinute: 300 },
    ...[
      { lunchEndMinute: 800 },
      { lunchStartMinute: 700 },
      { lunchStartMinute: 700.5, lunchEndMinute: 800 },
      { lunchStartMinute: 700, lunchEndMinute: 800.5 },
      { lunchStartMinute: 359, lunchEndMinute: 800 },
      { lunchStartMinute: 700, lunchEndMinute: 1081 },
      { lunchStartMinute: 800, lunchEndMinute: 800 },
    ].map(lunch => ({ ...schedule(), ...lunch })),
  ])
    assert.throws(() => validate({ dailySchedule }), /dailySchedule|night watch/)
})
test('faction expedition preserves a valid original unit and finite tribute', () => {
  for (const phase of ['approaching', 'parley', 'hostile', 'leaving'])
    assert.doesNotThrow(() => validate({ factionExpedition: { ...expedition(), phase } }))
  const bad = [
    false,
    ...['raidId', 'factionId', 'regionId', 'playerLabel'].flatMap(key =>
      ['', 1].map(value => ({ ...expedition(), [key]: value }))
    ),
    { ...expedition(), phase: 'invalid' },
    { ...expedition(), original: false },
    ...[{ factionExpedition: {} }, { label: 'other' }, { type: 'Hero' }].map(original => ({
      ...expedition(),
      original: { ...unit(), ...original },
    })),
    { ...expedition(), tribute: false },
    ...['1', Infinity, -1].map(wood => ({ ...expedition(), tribute: { wood } })),
  ]
  for (const factionExpedition of bad) assert.throws(() => validate({ factionExpedition }), /faction expedition/)
})
test('unit and corpse types accept runtime bandits but reject unknown types and training targets', () => {
  for (const type of ['Villager', 'BanditChief', 'BanditSword', 'BanditArcher']) {
    assert.doesNotThrow(() => validate({ type, trainingTargetType: type }))
    assert.doesNotThrow(() => validatePlayerCorpses([{ ...unit(), type }], 0, 32, config))
  }
  for (const type of [3, 'Unknown']) {
    assert.throws(() => validate({ type }), /unsupported type/)
    assert.throws(() => validate({ trainingTargetType: type }), /training target/)
    assert.throws(() => validatePlayerCorpses([{ ...unit(), type }], 0, 32, config), /unsupported type/)
  }
})

test('equipment durability accepts old saves and valid NPC wear, rejecting corrupt condition', () => {
  assert.doesNotThrow(() => validate({ equipmentDurability: { sword_iron: 0, bow: 100 } }))
  assert.doesNotThrow(() => validate({}))
  for (const equipmentDurability of [false, [], { bow: -1 }, { bow: 101 }, { bow: NaN }, { bow: '30' }]) {
    assert.throws(() => validate({ equipmentDurability }), /durability/)
  }
})
