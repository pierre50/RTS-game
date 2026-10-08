const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { sendNpcToTownCenter } = loadTsModule('app/lib/npc/npcGoToDispatch.ts', {
  mocks: {
    '../units/unitSuspension': {
      wakeUnitSimulation: npc => {
        npc.woken = true
      },
    },
    '../../services/rest/UnitRestRules': {
      delayUnitRestAfterActivity: npc => {
        npc.restDelayed = true
      },
    },
    '../combat/diplomaticAggression': {},
    './npcTargetResolution': {},
  },
})

test('sending to a town replaces following and pending deliveries with a movement order', () => {
  const owner = { label: 'player' }
  const town = { type: 'TownCenter', isBuilt: true, owner }
  const calls = []
  const npc = {
    owner,
    followingHero: true,
    lookingAtHero: true,
    followAssist: {},
    followAssistIntent: {},
    resourceDeliveryState: { taskId: 7 },
    trainingTargetType: 'Bowman',
    buildQueue: [{}],
    context: { scheduler: { remove: task => calls.push(['remove', task]) } },
    sendToEvt: (...args) => calls.push(['move', ...args]),
  }
  sendNpcToTownCenter(npc, town)
  assert.deepEqual(calls, [
    ['remove', 7],
    ['move', town, null, { allowPassageStop: true }],
  ])
  assert.equal(npc.followingHero, false)
  assert.equal(npc.lookingAtHero, false)
  assert.equal(npc.resourceDeliveryState, null)
  assert.equal(npc.woken, true)
  assert.equal(npc.restDelayed, true)
})

test('town orders reject foreign, destroyed and unfinished destinations without changing current orders', () => {
  const owner = { label: 'player' }
  const npc = { owner, followingHero: true, sendToEvt: () => assert.fail('Unexpected movement') }
  for (const patch of [
    { isBuilt: false },
    { isDead: true },
    { isDestroyed: true },
    { type: 'House' },
    { owner: { label: 'enemy' } },
  ]) {
    sendNpcToTownCenter(npc, { type: 'TownCenter', isBuilt: true, owner, ...patch })
    assert.equal(npc.followingHero, true)
    assert.equal(npc.woken, undefined)
  }
})
