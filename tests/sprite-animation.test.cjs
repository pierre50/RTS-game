const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks = {}) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('playSpriteAnimationFromStart resets transient callbacks and restarts frame zero', () => {
  const { playSpriteAnimationFromStart } = loadModule('app/lib/spriteAnimation.ts')
  const calls = []
  const complete = () => {}
  const sprite = {
    loop: true,
    onComplete: null,
    onFrameChange: () => {},
    onLoop: () => {},
    gotoAndPlay(frame) {
      calls.push(['gotoAndPlay', frame])
      this.currentFrame = frame
    },
  }

  playSpriteAnimationFromStart(sprite, {
    clearFrameChange: true,
    loop: false,
    onComplete: complete,
  })

  assert.equal(sprite.loop, false)
  assert.equal(sprite.onComplete, complete)
  assert.equal(sprite.onFrameChange, undefined)
  assert.equal(sprite.onLoop, undefined)
  assert.equal(sprite.currentFrame, 0)
  assert.deepEqual(calls, [['gotoAndPlay', 0]])
})

test('playSpriteFrameSequence drives Pixi frames through the scheduler', () => {
  const { playSpriteFrameSequence } = loadModule('app/lib/spriteAnimation.ts')
  const calls = []
  const scheduled = new Map()
  const scheduler = {
    add: (callback, time, name) => {
      calls.push(['add', time, name])
      scheduled.set(11, callback)
      return 11
    },
    remove: taskId => calls.push(['remove', taskId]),
  }
  const sprite = {
    currentFrame: 0,
    gotoAndStop(frame) {
      this.currentFrame = frame
      calls.push(['gotoAndStop', frame])
    },
  }
  const completed = []

  const taskId = playSpriteFrameSequence(sprite, scheduler, {
    frameMs: 45,
    frames: [5, 4, 3],
    onComplete: () => completed.push(true),
    onFrame: (frame, index) => calls.push(['onFrame', frame, index]),
    taskName: 'test.sequence',
  })

  assert.equal(taskId, 11)
  scheduled.get(11)()
  scheduled.get(11)()

  assert.deepEqual(calls, [
    ['gotoAndStop', 5],
    ['onFrame', 5, 0],
    ['add', 45, 'test.sequence'],
    ['gotoAndStop', 4],
    ['onFrame', 4, 1],
    ['gotoAndStop', 3],
    ['onFrame', 3, 2],
    ['remove', 11],
  ])
  assert.deepEqual(completed, [true])
})

test('unit death starts the dying animation through the shared helper', () => {
  const calls = []
  const { UnitLifecycle } = loadModule('app/classes/unit/UnitLifecycle.ts', {
    '../../constants': {
      CORPSE_TIME: 60,
      FADE_DURATION_MS: 2000,
      MENU_INFO_IDS: { hitPoints: 'hitPoints', populationText: 'populationText' },
      POPULATION_MAX: 50,
      SHEET_TYPES: { corpse: 'corpseSheet', dying: 'dyingSheet' },
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      playAudibleSoundCue: () => {},
      updateInstanceVisibility: () => calls.push(['updateInstanceVisibility']),
    },
    '../../lib/combatFeedback': { clearDamageFeedback: () => {} },
    '../../lib/deathFlash': { runAfterDeathFlash: (_sprite, onComplete) => onComplete },
    '../../lib/entityFade': { fadeOutThenClear: () => {} },
    '../../lib/entityHealthDisplay': { getEntityHitPointsText: () => '0/10' },
    '../../lib/spriteAnimation': {
      playSpriteAnimationFromStart: (sprite, options = {}) => {
        calls.push(['playSpriteAnimationFromStart', options.clearFrameChange, options.loop])
        if (options.clearFrameChange) sprite.onFrameChange = undefined
        if (options.clearLoop !== false) sprite.onLoop = undefined
        sprite.loop = options.loop ?? sprite.loop
        if (options.onComplete !== undefined) sprite.onComplete = options.onComplete
        sprite.gotoAndPlay(0)
      },
    },
  })
  const sprite = {
    loop: true,
    onFrameChange: () => {},
    onLoop: () => {},
    gotoAndPlay(frame) {
      calls.push(['gotoAndPlay', frame])
      this.currentFrame = frame
    },
  }
  const unit = {
    context: {},
    i: 0,
    j: 0,
    owner: { corpses: [] },
    sprite,
    zIndex: 4,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    syncShadow: () => calls.push(['syncShadow']),
    syncAppearanceLayers: sheet => calls.push(['syncAppearanceLayers', sheet]),
  }

  new UnitLifecycle(unit).death()

  assert.deepEqual(calls, [
    ['setTextures', 'dyingSheet'],
    ['syncShadow'],
    ['playSpriteAnimationFromStart', true, false],
    ['gotoAndPlay', 0],
    ['syncAppearanceLayers', 'dyingSheet'],
  ])
  assert.equal(sprite.loop, false)
  assert.equal(sprite.onFrameChange, undefined)
  assert.equal(sprite.onLoop, undefined)
  assert.equal(typeof sprite.onComplete, 'function')
  assert.equal(sprite.currentFrame, 0)
})
