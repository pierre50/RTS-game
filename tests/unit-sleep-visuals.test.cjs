const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadUnitSleepVisuals(overrides = {}) {
  return loadTsModule('app/services/rest/UnitSleepVisuals.ts', {
    mocks: {
      '../../constants': {
        SHEET_TYPES: { dying: 'dyingSheet', standing: 'standingSheet' },
      },
      '../../lib/entities/entityFade': { cancelFade: unit => unit.calls.push(['cancelFade']) },
      ...overrides,
    },
  })
}

function createScheduler() {
  return {
    nextId: 1,
    tasks: new Map(),
    add(callback, interval, name) {
      const id = this.nextId++
      this.tasks.set(id, { callback, interval, name })
      return id
    },
    remove(id) {
      this.tasks.delete(id)
    },
  }
}

function createSprite() {
  return {
    currentFrame: 0,
    loop: true,
    onComplete: () => {},
    onFrameChange: () => {},
    onLoop: () => {},
    playing: false,
    textures: ['fall-0', 'fall-1', 'fall-2'],
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    },
    stop() {
      this.playing = false
    },
  }
}

function createUnit() {
  const calls = []
  const layer = {
    currentFrame: 0,
    loop: true,
    onComplete: () => {},
    onFrameChange: () => {},
    onLoop: () => {},
    playing: false,
    textures: ['layer-0', 'layer-1', 'layer-2'],
    gotoAndPlay(frame) {
      this.currentFrame = frame
      this.playing = true
    },
    gotoAndStop(frame) {
      this.currentFrame = frame
      this.playing = false
    },
    stop() {
      this.playing = false
    },
  }
  return {
    alpha: 0,
    appearanceLayerSprites: new Map([[0, layer]]),
    calls,
    context: { scheduler: createScheduler() },
    shadow: { visible: false, stop: () => calls.push(['shadowStop']) },
    sprite: createSprite(),
    syncAppearanceLayers: sheet => calls.push(['syncLayers', sheet]),
    syncShadow: () => calls.push(['syncShadow']),
    setTextures: sheet => calls.push(['setTextures', sheet]),
    visible: false,
  }
}

test('sleep wake visual plays the hurt sheet in reverse before returning to standing', () => {
  const { playSleepingWakeVisual } = loadUnitSleepVisuals()
  const unit = createUnit()
  let completed = false

  playSleepingWakeVisual(unit, () => {
    completed = true
  })

  assert.equal(unit.sleepVisualState, 'waking')
  assert.deepEqual(unit.calls.slice(0, 4), [
    ['cancelFade'],
    ['setTextures', 'dyingSheet'],
    ['syncLayers', 'dyingSheet'],
    ['syncShadow'],
  ])
  assert.equal(unit.sprite.currentFrame, 2)
  assert.equal(unit.appearanceLayerSprites.get(0).currentFrame, 2)

  const task = [...unit.context.scheduler.tasks.values()].find(entry => entry.name === 'unit.sleepWake')
  assert.ok(task)
  task.callback()
  task.callback()

  assert.equal(unit.sleepVisualState, null)
  assert.equal(completed, true)
  assert.deepEqual(unit.calls.slice(-3), [['setTextures', 'standingSheet'], ['syncLayers', 'standingSheet'], ['syncShadow']])
})

test('clearing a wake visual cancels the task and stale sprite callbacks', () => {
  const { clearSleepingVisualState, playSleepingWakeVisual } = loadUnitSleepVisuals()
  const unit = createUnit()

  playSleepingWakeVisual(unit)
  assert.equal(unit.context.scheduler.tasks.size, 1)

  clearSleepingVisualState(unit)

  assert.equal(unit.sleepVisualState, null)
  assert.equal(unit.context.scheduler.tasks.size, 0)
  assert.equal(unit.sprite.onComplete, undefined)
  assert.equal(unit.sprite.onFrameChange, undefined)
  assert.equal(unit.sprite.onLoop, undefined)
  const layer = unit.appearanceLayerSprites.get(0)
  assert.equal(layer.onComplete, null)
  assert.equal(layer.onFrameChange, null)
  assert.equal(layer.onLoop, null)
})


test('the opening sleeping pose cancels a pending spawn fade before revealing the hero', () => {
  const fade = loadTsModule('app/lib/entities/entityFade.ts')
  const { setSleepingOutsideFinalVisual, playSleepingWakeVisual } = loadUnitSleepVisuals({
    '../../lib/entities/entityFade': fade,
  })
  const unit = createUnit()
  unit.alpha = 1
  unit.context.paused = true
  fade.fadeIn(unit, 120)
  const pendingFade = [...unit.context.scheduler.tasks.values()][0]
  assert.equal(unit.alpha, 0)

  setSleepingOutsideFinalVisual(unit)

  assert.equal(unit.context.scheduler.tasks.size, 0)
  assert.equal(unit.alpha, 1)
  assert.equal(unit.visible, true)
  assert.equal(unit.sprite.currentFrame, 2)
  assert.equal(unit.sprite.playing, false)
  assert.equal(unit.appearanceLayerSprites.get(0).currentFrame, 2)
  assert.equal(unit.shadow.visible, false)
  unit.context.paused = false
  for (let tick = 0; tick < 10; tick++) pendingFade.callback()
  assert.equal(unit.alpha, 1)
  assert.equal(unit.sprite.currentFrame, 2)

  let awake = false
  playSleepingWakeVisual(unit, () => { awake = true })
  const wakeTask = [...unit.context.scheduler.tasks.values()].find(task => task.name === 'unit.sleepWake')
  wakeTask.callback()
  wakeTask.callback()
  assert.equal(awake, true)
  assert.equal(unit.sleepVisualState, null)
  assert.equal(unit.alpha, 1)
})
