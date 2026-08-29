const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadNpcGoToDispatch(isSleepTime = false) {
  return loadTsModule('app/lib/npc/npcGoToDispatch.ts', {
    mocks: {
      '../constants': {
        ACTION_TYPES: { attack: 'attack' },
        FAMILY_TYPES: { building: 'building', resource: 'resource', unit: 'unit' },
        LABEL_TYPES: { commSelection: 'commSelection' },
        UNIT_TYPES: { villager: 'Villager' },
      },
      '../combat/diplomaticAggression': { applyDiplomaticAggression: () => false },
      '../graphics/selection': { drawInstanceBlinkingSelection: () => {} },
      '../grid/visibility': { findInstancesInSight: () => [] },
      '../buildings/buildingTraining': { getTrainingTargetForUnit: () => null },
      '../buildings/buildingFeedback': { showUnitCannotEnterBuildingMessage: () => {} },
      '../units/villagerSchedule': { isVillagerSleepTime: () => isSleepTime },
    },
  })
}

test('stop following sends a released villager to sleep during sleep time', () => {
  const calls = []
  const { keepNpcHere } = loadNpcGoToDispatch(true)
  const villager = {
    type: 'Villager',
    followingHero: true,
    context: {
      unitRest: {
        sendUnitToSleep: unit => calls.push(['sleep', unit.label]),
      },
    },
    label: 'villager-1',
    stop: () => calls.push(['stop']),
  }

  keepNpcHere(villager)

  assert.equal(villager.followingHero, false)
  assert.deepEqual(calls, [['stop'], ['sleep', 'villager-1']])
})

test('follow me wakes a sleeping villager before enabling follow', () => {
  const calls = []
  const { startFollowingHero } = loadNpcGoToDispatch(false)
  const villager = {
    type: 'Villager',
    context: {
      unitRest: {
        wakeSleepingUnitForOrder: (unit, onComplete) => {
          calls.push(['wake', unit.label, typeof onComplete])
          onComplete?.()
          return true
        },
      },
    },
    label: 'villager-1',
    shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
    stop: () => calls.push(['stop']),
  }

  startFollowingHero(villager)

  assert.equal(villager.followingHero, true)
  assert.deepEqual(calls, [['wake', 'villager-1', 'function']])
})
