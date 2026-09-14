const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { migrateTutorialVillageOwner } = loadTsModule('app/services/tutorial/TutorialVillageMigration.ts')

test('legacy tutorial village migrates once while preserving interiors and quest ownership', () => {
  const hero = { type: 'Hero', label: 'hero' }
  const chief = { type: 'Chief', label: 'chief' }
  const house = { type: 'House', label: 'house', interiorPortalId: 'old:house' }
  const state = { players: [{ type: 'Human', isPlayed: true, label: 'old', units: [hero, chief], buildings: [house] }] }
  const quest = { owner: { playerLabel: 'old', entityLabel: 'chief' }, assigneeId: 'old' }
  const campaign = { currentWorldId: 'start', tutorial: { worldId: 'start', chiefLabel: 'chief' }, quests: { quests: [quest] } }
  migrateTutorialVillageOwner(campaign, state)
  const guest = state.players.find(p => p.isPlayed)
  const host = state.players.find(p => p.type === 'AI')
  assert.deepEqual(guest.units, [hero])
  assert.deepEqual(guest.buildings, [])
  assert.deepEqual(host.units, [chief])
  assert.deepEqual(host.buildings, [house])
  assert.equal(host.label, 'old')
  assert.equal(quest.owner.playerLabel, host.label)
  assert.equal(quest.assigneeId, guest.label)
  migrateTutorialVillageOwner(campaign, state)
  assert.equal(state.players.length, 2)
})

test('normal campaigns are not migrated', () => {
  const state = { players: [{ type: 'Human', isPlayed: true, units: [{ label: 'chief' }] }] }
  const before = structuredClone(state)
  migrateTutorialVillageOwner({}, state)
  assert.deepEqual(state, before)
})
