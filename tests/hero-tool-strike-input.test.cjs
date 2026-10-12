const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const calls = []
  const hero = { stop() {}, actionLocked: false }
  const host = {
    heroUnit: hero,
    equippedItem: 'interact',
    mouseHeld: false,
    controls: { getWorldPointUnderCursor: () => ({ x: 20, y: 10 }) },
    facePoint() {},
  }
  const { HeroActionInputController } = loadTsModule('app/controllers/HeroActionInputController.ts', {
    mocks: {
      '../constants': { SHEET_TYPES: { action: 'actionSheet' } },
      '../lib/hero/heroTools': {
        canHeroDefendWithTool: (tool, unit) => tool === 'interact' && unit === hero,
        beginHeroDefense: unit => {
          assert.equal(unit.actionLocked, false)
          calls.push(['defend'])
          unit.heroDefenseActive = true
          unit.actionLocked = true
          return true
        },
        isHeroCatchingPoleEquipped: () => false,
        isMountedAttackAimBlocked: () => false,
        isHeroPowerChargeActiveForTool: () => false,
        triggerToolAttackAt: (_hero, _tool, point, repeat) => {
          calls.push(['press', repeat])
          hero.heroPendingToolStrike = 'axe_ceramic'
          hero.actionLocked = true
          return true
        },
        releaseHeroToolStrike: (_hero, point) => {
          calls.push(['release', point])
          delete hero.heroPendingToolStrike
          return true
        },
        cancelHeroActiveToolAction: () => {
          calls.push(['cancel'])
          hero.actionLocked = false
          delete hero.heroPendingToolStrike
        },
      },
    },
  })
  return { host, hero, calls, input: new HeroActionInputController(host) }
}

test('pointer release strikes once and clears the held interaction', () => {
  const { host, calls, input } = fixture()
  input.handlePrimaryPointerDown()
  assert.deepEqual(calls, [['press', false]])
  input.attackTowardPoint({ x: 30, y: 10 })
  assert.equal(calls.length, 1)
  input.handlePointerUp(1)
  assert.equal(calls.length, 1)
  input.handlePointerUp()
  input.handlePointerUp()
  assert.deepEqual(calls, [
    ['press', false],
    ['release', { x: 20, y: 10 }],
  ])
  assert.equal(host.mouseHeld, false)
  assert.equal(host.primaryClickPoint, null)
  assert.equal(host.interactInputOwner, null)
})

test('switching away from tools cancels the pending strike on release', () => {
  const { host, calls, input } = fixture()
  input.handlePrimaryPointerDown()
  host.equippedItem = 'sword'
  input.handlePointerUp()
  assert.deepEqual(calls, [['press', false], ['cancel']])
})

test('held work updates are identified as repeats', () => {
  const { host, calls, input } = fixture()
  host.mouseHeld = true
  input.attackTowardPoint({ x: 20, y: 10 })
  assert.deepEqual(calls, [['press', true]])
})

test('right click cancels the charged tool strike before starting guard', () => {
  const { host, hero, calls, input } = fixture()
  input.handlePrimaryPointerDown()
  hero.heroDefenseEnergyExhausted = true
  input.handleSecondaryPointerDown()
  assert.deepEqual(calls, [['press', false], ['cancel'], ['defend']])
  assert.equal(hero.heroDefenseEnergyExhausted, false)
  assert.equal(hero.heroPendingToolStrike, undefined)
  assert.equal(host.defenseHeld, true)
  assert.equal(hero.heroDefenseActive, true)
})
