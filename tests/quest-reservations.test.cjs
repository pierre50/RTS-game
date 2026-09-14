const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { isReservedQuestTarget } = loadTsModule('app/lib/quests/questReservations.ts')
const { validateQuestJournal } = loadTsModule('app/serialization/QuestSave.ts')

test('reserved quest animals stay available only to the assigned hero until the stage ends', () => {
  const quest = { id: 'quest', definitionId: 'hunt', regionId: 'map', status: 'active', stageId: 'wood',
    owner: { entityLabel: 'chief', playerLabel: 'village', name: 'Chief' }, assigneeId: 'player',
    parameters: {}, bindings: {}, facts: {}, markers: {}, usedInteractions: [], unread: false,
    reservation: { stageIds: ['wood', 'hunt'], entityLabels: ['deer'] } }
  const journal = JSON.parse(JSON.stringify({ version: 1, trackedQuestId: null, quests: [quest] }))
  validateQuestJournal(journal)
  const context = { getQuestJournal: () => journal, controls: {} }
  const hero = { context, owner: { label: 'player' } }
  context.controls.heroUnit = hero
  const worker = { context, owner: { label: 'player' } }
  const ai = { context, owner: { label: 'village' } }
  const animal = { label: 'deer' }
  assert.equal(isReservedQuestTarget(hero, animal), false)
  assert.equal(isReservedQuestTarget(worker, animal), true)
  assert.equal(isReservedQuestTarget(ai, animal), true)
  assert.equal(isReservedQuestTarget(ai, { label: 'other' }), false)
  journal.quests[0].stageId = 'alarm'
  assert.equal(isReservedQuestTarget(ai, animal), false)
  journal.quests[0].stageId = 'hunt'
  journal.quests[0].status = 'completed'
  assert.equal(isReservedQuestTarget(ai, animal), false)
  journal.quests[0].reservation.entityLabels = [3]
  assert.throws(() => validateQuestJournal(journal))
})
