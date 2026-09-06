const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadParryVisual() {
  return loadTsModule('app/lib/combat/parryVisual.ts')
}

function createSprite() {
  return {
    currentFrame: 4,
    loop: true,
    onComplete: () => {},
    onFrameChange: () => {},
    onLoop: () => {},
    playing: true,
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

function createScheduler() {
  const tasks = []
  return {
    addOneShot(callback, ms, label) {
      const id = tasks.length + 1
      tasks.push({ callback, id, label, ms, removed: false })
      return id
    },
    remove(id) {
      const task = tasks.find(task => task.id === id)
      if (task) task.removed = true
    },
    tasks,
  }
}

test('automatic parry visual briefly holds the action frame and restores the previous animation', () => {
  const { showAutomaticParryVisual } = loadParryVisual()
  const calls = []
  const scheduler = createScheduler()
  const sprite = createSprite()
  const originalCallbacks = {
    onComplete: sprite.onComplete,
    onFrameChange: sprite.onFrameChange,
    onLoop: sprite.onLoop,
  }
  const unit = {
    context: { scheduler },
    currentSheet: 'walkingSheet',
    sprite,
    setTextures(sheet) {
      calls.push(['setTextures', sheet])
      this.currentSheet = sheet
    },
    syncAppearanceLayers: sheet => calls.push(['syncLayers', sheet]),
    syncMountedHorseSprite: () => calls.push(['syncHorse']),
    syncShadow: () => calls.push(['syncShadow']),
    visualAnimationToken: 0,
  }

  showAutomaticParryVisual(unit, 700)

  assert.equal(unit.currentSheet, 'actionSheet')
  assert.equal(sprite.currentFrame, 2)
  assert.equal(sprite.playing, false)
  assert.equal(sprite.loop, false)
  assert.equal(unit.automaticParryVisualTaskId, 1)
  assert.equal(scheduler.tasks[0].ms, 700)
  assert.equal(scheduler.tasks[0].label, 'combat.automaticParryVisual')

  scheduler.tasks[0].callback()

  assert.equal(unit.currentSheet, 'walkingSheet')
  assert.equal(sprite.currentFrame, 4)
  assert.equal(sprite.playing, true)
  assert.equal(sprite.loop, true)
  assert.equal(sprite.onComplete, originalCallbacks.onComplete)
  assert.equal(sprite.onFrameChange, originalCallbacks.onFrameChange)
  assert.equal(sprite.onLoop, originalCallbacks.onLoop)
  assert.equal(unit.automaticParryVisualTaskId, null)
  assert.deepEqual(calls, [
    ['setTextures', 'actionSheet'],
    ['syncHorse'],
    ['syncLayers', 'actionSheet'],
    ['syncShadow'],
    ['setTextures', 'walkingSheet'],
    ['syncHorse'],
    ['syncLayers', 'walkingSheet'],
    ['syncShadow'],
  ])
})

test('automatic parry visual extends an existing hold without losing the original state', () => {
  const { showAutomaticParryVisual } = loadParryVisual()
  const scheduler = createScheduler()
  const sprite = createSprite()
  const unit = {
    context: { scheduler },
    currentSheet: 'standingSheet',
    sprite,
    setTextures(sheet) {
      this.currentSheet = sheet
    },
    visualAnimationToken: 0,
  }

  showAutomaticParryVisual(unit, 700)
  sprite.currentFrame = 2
  showAutomaticParryVisual(unit, 700)

  assert.equal(scheduler.tasks[0].removed, true)
  assert.equal(unit.automaticParryVisualTaskId, 2)

  scheduler.tasks[0].callback()
  assert.equal(unit.currentSheet, 'actionSheet')

  scheduler.tasks[1].callback()
  assert.equal(unit.currentSheet, 'standingSheet')
  assert.equal(sprite.currentFrame, 4)
})
