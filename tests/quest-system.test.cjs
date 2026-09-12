const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { QuestSystem, createQuestJournal } = loadTsModule('app/services/quests/QuestSystem.ts')
const { validateQuestJournal } = loadTsModule('app/serialization/QuestSave.ts')

function fixture() {
  let journal = createQuestJournal()
  const definition = {
    id: 'delivery', title: { key: 'title' }, description: { key: 'description' },
    stages: [{ id: 'deliver', objectives: [{ id: 'wood', text: { key: 'wood' }, conditions: [
      { type: 'resource', resource: { parameter: 'resource' }, quantity: { parameter: 'quantity' } },
    ] }], interactions: [
      { id: 'help', actor: 'giver', text: { key: 'help' }, visibleWhen: [], enabledWhen: [{ type: 'resource', resource: 'arrows', quantity: 5, comparison: 'below' }], repeatable: true,
        effects: [{ type: 'top-up-resource', resource: 'arrows', quantity: 15 }] },
      { id: 'give', actor: 'giver', text: { key: 'give' }, visibleWhen: [], enabledWhen: [], requireObjectives: true,
        effects: [{ type: 'take-resource', resource: { parameter: 'resource' }, quantity: { parameter: 'quantity' } }], nextStageId: null },
    ] }],
  }
  const system = new QuestSystem(() => journal, new Map([[definition.id, definition]]))
  const quest = { id: 'q1', definitionId: definition.id, regionId: 'region', owner: { entityLabel: 'chief', playerLabel: 'village', name: 'Chief' },
    assigneeId: null, parameters: { resource: 'wood', quantity: 12 }, bindings: { giver: 'chief' }, status: 'available', stageId: 'deliver',
    facts: {}, usedInteractions: [], markers: { deliver: [{ id: 'area', spaceId: 'outside', position: { i: 2, j: 3 }, radius: 5, label: { key: 'area' } }] }, unread: false }
  const bag = { wood: 12, arrows: 0 }
  const env = {
    regionId: 'region',
    resourceCount: key => bag[key] ?? 0,
    targetMatches: () => false,
    commitResources(effects) {
      const next = { ...bag }
      for (const effect of effects) {
        const quantity = next[effect.resource] ?? 0
        if (effect.type === 'take-resource' && quantity < effect.quantity) return false
        next[effect.resource] = effect.type === 'take-resource' ? quantity - effect.quantity
          : effect.type === 'top-up-resource' ? Math.max(quantity, effect.quantity) : quantity + effect.quantity
      }
      Object.assign(bag, next)
      return true
    },
  }
  system.offer(quest)
  return { system, quest, bag, env, definition, reload: () => { journal = structuredClone(journal) } }
}

test('offers copy random parameters, acceptance is unique, tracking survives state replacement', () => {
  const { system, quest, reload } = fixture()
  quest.parameters.quantity = 99
  assert.equal(system.state.quests[0].parameters.quantity, 12)
  assert.equal(system.offer(quest), false)
  assert.equal(system.track('q1'), false)
  assert.equal(system.accept('q1', 'hero'), true)
  assert.equal(system.accept('q1', 'other'), false)
  reload()
  assert.equal(system.state.trackedQuestId, 'q1')
  validateQuestJournal(system.state)
})

test('delivery rechecks bag, recipient and assignee; success consumes once and clears tracking', () => {
  const { system, bag, env } = fixture()
  system.accept('q1', 'hero')
  bag.wood = 2
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', env), false)
  bag.wood = 12
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', { ...env, regionId: 'elsewhere' }), false)
  assert.equal(system.interact('q1', 'give', 'other', 'chief', env), false)
  assert.equal(system.interact('q1', 'give', 'hero', 'stranger', env), false)
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', env), true)
  assert.equal(bag.wood, 0)
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', env), false)
  assert.equal(system.state.trackedQuestId, null)
  assert.equal(system.state.quests[0].status, 'completed')
})

test('repeatable help tops up instead of stacking and never advances the quest', () => {
  const { system, bag, env } = fixture()
  system.accept('q1', 'hero')
  assert.equal(system.interact('q1', 'help', 'hero', 'chief', env), true)
  assert.equal(system.interact('q1', 'help', 'hero', 'chief', env), false)
  assert.equal(bag.arrows, 15)
  bag.arrows = 2
  assert.equal(system.interact('q1', 'help', 'hero', 'chief', env), true)
  assert.equal(bag.arrows, 15)
  assert.equal(system.state.quests[0].stageId, 'deliver')
  assert.equal(system.state.quests[0].status, 'active')
})

test('failed transaction and invalid transition leave the quest unchanged', () => {
  const { system, env, definition } = fixture()
  system.accept('q1', 'hero')
  const before = structuredClone(system.state)
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', { ...env, commitResources: () => false }), false)
  assert.deepEqual(system.state, before)
  definition.stages[0].interactions[1].nextStageId = 'missing'
  assert.equal(system.interact('q1', 'give', 'hero', 'chief', env), false)
  assert.deepEqual(system.state, before)
})

test('search markers remain within the assigned region and interior space', () => {
  const { system } = fixture()
  system.accept('q1', 'hero')
  assert.equal(system.getTrackedMarkers('outside', 'region').length, 1)
  assert.equal(system.getTrackedMarkers('cave', 'region').length, 0)
  assert.equal(system.getTrackedMarkers('outside', 'elsewhere').length, 0)
})

test('legacy saves are accepted and malformed or duplicate journal entries rejected', () => {
  validateQuestJournal(undefined)
  validateQuestJournal(createQuestJournal())
  const { system } = fixture()
  const valid = structuredClone(system.state)
  for (const mutate of [
    state => { state.quests.push(structuredClone(state.quests[0])) },
    state => { state.trackedQuestId = 'missing' },
    state => { state.quests[0].markers.deliver[0].radius = -1 },
    state => { state.quests[0].parameters.quantity = NaN },
    state => { state.quests[0].status = 'active' },
  ]) {
    const state = structuredClone(valid)
    mutate(state)
    assert.throws(() => validateQuestJournal(state), /quest journal/)
  }
})

test('independent village relations are validated and remain optional for older saves', () => {
  const state = createQuestJournal()
  validateQuestJournal(state)
  state.villageRelations = { village: 10 }
  validateQuestJournal(state)
  for (const score of [101, -101, NaN, '10', 1.5]) {
    state.villageRelations.village = score
    assert.throws(() => validateQuestJournal(state), /quest journal/)
  }
})
