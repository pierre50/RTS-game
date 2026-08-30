const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitVisualTransition() {
  return loadTsModule('app/lib/units/unitVisualTransition.ts')
}

function createSprite() {
  return {
    currentFrame: 3,
    loop: true,
    onComplete: () => {},
    onFrameChange: () => {},
    onLoop: () => {},
    playing: false,
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    },
    play() {
      this.playing = true
    },
    stop() {
      this.playing = false
    },
  }
}

test('setUnitVisualSheet changes the full unit visual stack and invalidates stale animations', () => {
  const { isUnitVisualAnimationCurrent, setUnitVisualSheet } = loadUnitVisualTransition()
  const calls = []
  const unit = {
    sprite: createSprite(),
    visualAnimationToken: 4,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    syncAppearanceLayers: sheet => calls.push(['syncLayers', sheet]),
    syncMountedHorseSprite: () => calls.push(['syncHorse']),
    syncShadow: () => calls.push(['syncShadow']),
  }

  const token = setUnitVisualSheet(unit, 'actionSheet', {
    clearCallbacks: ['onComplete', 'onFrameChange'],
    frame: 0,
    loop: false,
    play: 'play',
    syncMountedHorse: true,
  })

  assert.equal(token, 5)
  assert.equal(unit.visualAnimationToken, 5)
  assert.equal(isUnitVisualAnimationCurrent(unit, 4), false)
  assert.equal(isUnitVisualAnimationCurrent(unit, 5), true)
  assert.equal(unit.sprite.currentFrame, 0)
  assert.equal(unit.sprite.playing, true)
  assert.equal(unit.sprite.loop, false)
  assert.equal(unit.sprite.onComplete, undefined)
  assert.equal(unit.sprite.onFrameChange, undefined)
  assert.equal(typeof unit.sprite.onLoop, 'function')
  assert.deepEqual(calls, [['setTextures', 'actionSheet'], ['syncHorse'], ['syncLayers', 'actionSheet'], ['syncShadow']])
})

test('setUnitVisualSheet can keep the current animation token for internal sheet swaps', () => {
  const { setUnitVisualSheet } = loadUnitVisualTransition()
  const unit = {
    sprite: createSprite(),
    visualAnimationToken: 7,
    setTextures: () => {},
  }

  const token = setUnitVisualSheet(unit, 'standingSheet', {
    clearCallbacks: false,
    invalidateAnimation: false,
    syncLayers: false,
    syncShadow: false,
  })

  assert.equal(token, 7)
  assert.equal(unit.visualAnimationToken, 7)
  assert.equal(typeof unit.sprite.onComplete, 'function')
  assert.equal(typeof unit.sprite.onFrameChange, 'function')
  assert.equal(typeof unit.sprite.onLoop, 'function')
})
