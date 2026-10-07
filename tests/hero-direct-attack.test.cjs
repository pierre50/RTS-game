const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('direct melee bypasses charging and ignores bows, catching poles and locked actions', () => {
  const calls = []
  const { HeroActionInputController } = loadTsModule('app/controllers/HeroActionInputController.ts', {
    mocks: {
      '../lib/hero/heroTools': {
        isHeroToolAvailable: hero => !hero.unavailable,
        isHeroCatchingPoleEquipped: hero => hero.pole,
        isMountedAttackAimBlocked: hero => hero.blockedAim,
        cancelHeroActiveToolAction: hero => {
          hero.actionLocked = false
          calls.push('cancelDefense')
        },
        triggerSwordAttackAt: (_hero, point) => {
          calls.push(point)
          return true
        },
      },
    },
  })
  const point = { x: 50, y: 20 }
  const host = {
    heroUnit: {},
    equippedItem: 'sword',
    controls: { getWorldPointUnderCursor: () => point },
    facePoint() {},
  }
  const input = new HeroActionInputController(host)
  input.handleDirectAttack()
  assert.deepEqual(calls, [point])
  calls.length = 0
  for (const tool of ['bow', 'interact', null]) {
    host.equippedItem = tool
    input.handleDirectAttack()
  }
  host.equippedItem = 'sword'
  for (const state of [{ pole: true }, { unavailable: true }, { actionLocked: true }, { blockedAim: true }]) {
    host.heroUnit = state
    input.handleDirectAttack()
  }
  assert.deepEqual(calls, [])
  host.heroUnit = { actionLocked: true, heroDefenseActive: true }
  input.handleDirectAttack()
  assert.deepEqual(calls, ['cancelDefense', point])
})
