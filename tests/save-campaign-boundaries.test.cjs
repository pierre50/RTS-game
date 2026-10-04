const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { validateCampaignRecord } = loadTsModule('app/serialization/validation/CampaignRecordValidation.ts', {
  mocks: { '../CampaignSave': { CAMPAIGN_SAVE_FORMAT: 'campaign-v1' } },
})
const { validateQuestJournal } = loadTsModule('app/serialization/QuestSave.ts')
const campaign = () => ({
  version: 1,
  format: 'campaign-v1',
  worlds: { world: { id: 'world' } },
  worldGraph: {},
  currentWorldId: 'world',
  heroParty: { followerLabels: [] },
})
const tutorial = () => ({ stage: 'sleeping', worldId: 'world', houseLabel: 'house', chiefLabel: 'chief' })
const introduction = () => ({
  status: 'prepared',
  worldId: 'world',
  companionLabel: 'companion',
  campfireLabel: 'fire',
})

test('campaign rejects malformed envelope, clock and current-world reference', () => {
  assert.doesNotThrow(() => validateCampaignRecord(campaign(), {}))
  assert.doesNotThrow(() => validateCampaignRecord({ ...campaign(), clock: { savedAt: 0, dayNightElapsedMs: 0 } }, {}))
  for (const patch of [
    { version: 2 },
    { format: 'other' },
    { worlds: [] },
    { worldGraph: [] },
    { clock: 5 },
    { clock: { savedAt: Infinity } },
    { clock: { dayNightElapsedMs: '0' } },
    { heroParty: null },
    { heroParty: { followerLabels: {} } },
    { currentWorldId: 'missing' },
    { worlds: { world: { id: 'other' } } },
  ])
    assert.throws(() => validateCampaignRecord({ ...campaign(), ...patch }, {}), /Invalid save file/)
})
test('tutorial and introduction validate stage, identity, dialogue and arrival', () => {
  for (const stage of ['sleeping', 'dialogue', 'wood-requested'])
    assert.doesNotThrow(() =>
      validateCampaignRecord({ ...campaign(), tutorial: { ...tutorial(), stage, dialogueNodeId: 'node' } }, {})
    )
  for (const phase of [undefined, 'approaching', 'waking', 'dialogue'])
    assert.doesNotThrow(() =>
      validateCampaignRecord(
        { ...campaign(), introduction: { ...introduction(), phase, dialogueNodeId: 'node', arrival: { i: 0, j: 1 } } },
        {}
      )
    )
  for (const value of [
    null,
    { ...tutorial(), stage: 'bad' },
    { ...tutorial(), dialogueNodeId: 1 },
    ...['worldId', 'houseLabel', 'chiefLabel'].flatMap(key => ['', 2].map(value => ({ ...tutorial(), [key]: value }))),
  ])
    assert.throws(() => validateCampaignRecord({ ...campaign(), tutorial: value }, {}), /tutorial/)
  for (const value of [
    null,
    { ...introduction(), status: 'bad' },
    { ...introduction(), dialogueNodeId: 1 },
    { ...introduction(), phase: 'bad' },
    ...['worldId', 'companionLabel', 'campfireLabel'].flatMap(key =>
      ['', 2].map(value => ({ ...introduction(), [key]: value }))
    ),
    ...[null, { i: 0.5, j: 1 }, { i: 0, j: 0.5 }].map(arrival => ({ ...introduction(), arrival })),
  ])
    assert.throws(() => validateCampaignRecord({ ...campaign(), introduction: value }, {}), /introduction/)
})
const quest = () => ({
  id: 'quest',
  definitionId: 'delivery',
  regionId: 'region',
  stageId: 'start',
  owner: { entityLabel: 'chief', playerLabel: 'village', name: 'Chief' },
  status: 'available',
  assigneeId: null,
  bindings: {},
  parameters: {},
  facts: {},
  unread: true,
  usedInteractions: [],
  markers: {},
})
const journal = changes => ({ version: 1, trackedQuestId: null, quests: [{ ...quest(), ...changes }] })
const encounter = () => ({ entityLabels: ['bandit'], position: { i: 0, j: 1 }, parameters: { count: 2, type: 'camp' } })
const marker = () => ({
  id: 'marker',
  spaceId: 'outside',
  position: { i: 0, j: 1 },
  label: { key: 'quest', vars: { count: 2, target: 'chief' } },
  radius: 1,
})
test('quest encounter, reservations and repeat dates reject corrupted state', () => {
  assert.doesNotThrow(() =>
    validateQuestJournal(
      journal({
        encounters: { camp: encounter() },
        reservation: { entityLabels: ['chief'], stageIds: ['start'] },
        repeatable: true,
        completedDay: 1,
        nextOfferDay: 2,
      })
    )
  )
  for (const value of [
    null,
    { camp: null },
    ...[
      { entityLabels: {} },
      { entityLabels: [''] },
      { position: null },
      { position: { i: -1, j: 0 } },
      { position: { i: 0, j: 0.5 } },
      { parameters: null },
      { parameters: { n: Infinity } },
      { parameters: { n: false } },
    ].map(patch => ({ camp: { ...encounter(), ...patch } })),
  ])
    assert.throws(() => validateQuestJournal(journal({ encounters: value })), /quest journal/)
  for (const patch of [
    { reservation: null },
    { reservation: { entityLabels: [], stageIds: {} } },
    { reservation: { entityLabels: [2], stageIds: [] } },
    { repeatable: 'true' },
    ...['completedDay', 'nextOfferDay'].flatMap(key => [0, 1.5, '1', Infinity].map(value => ({ [key]: value }))),
  ])
    assert.throws(() => validateQuestJournal(journal(patch)), /quest journal/)
})
test('quest marker labels and radius preserve valid values and reject invalid values', () => {
  assert.doesNotThrow(() => validateQuestJournal(journal({ markers: { start: [marker()] } })))
  for (const value of [
    null,
    { start: {} },
    { start: [null] },
    ...[
      { id: 1 },
      { spaceId: null },
      { position: null },
      { position: { i: Infinity, j: 0 } },
      { label: null },
      { label: { key: 1 } },
      { label: { key: 'x', vars: null } },
      { label: { key: 'x', vars: { n: false } } },
      ...[0, -1, Infinity, '1'].map(radius => ({ radius })),
    ].map(patch => ({ start: [{ ...marker(), ...patch }] })),
  ])
    assert.throws(() => validateQuestJournal(journal({ markers: value })), /quest journal/)
})
