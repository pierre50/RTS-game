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
      '../units/villagerSchedule': { isVillagerSleepTime: () => isSleepTime },
      '../../services/rest/UnitRestRules': {
        delayUnitRestAfterActivity: unit => {
          if (!isSleepTime) return false
          const now = unit.context?.scheduler?.elapsedMs ?? 0
          unit.restWakeLockUntilMs = Math.max(unit.restWakeLockUntilMs ?? 0, now + 12000)
          unit.restAlertTargetLabel = null
          return true
        },
        isSleepTime: () => isSleepTime,
      },
      '../grid/movement': { getFreeLandCellAroundInstance: () => null },
      '../mapSpaces': { getMapSpace: () => null },
      '../entities/overheadIndicator': {
        clearUnitOverheadIndicator: () => {},
        setUnitOverheadIndicator: () => {},
      },
    },
  })
}

test('stop following delays sleep for a released villager during sleep time', () => {
  const calls = []
  const { keepNpcHere } = loadNpcGoToDispatch(true)
  const villager = {
    type: 'Villager',
    followingHero: true,
    context: {
      scheduler: { elapsedMs: 1000 },
      unitRest: {
        sendUnitToSleep: unit => calls.push(['sleep', unit.label]),
      },
    },
    label: 'villager-1',
    stop: () => calls.push(['stop']),
  }

  keepNpcHere(villager)

  assert.equal(villager.followingHero, false)
  assert.equal(villager.restWakeLockUntilMs, 13000)
  assert.deepEqual(calls, [['stop']])
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
