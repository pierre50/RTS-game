const assert = require('node:assert/strict')
const test = require('node:test')
const { AnimatedSprite, Texture } = require('pixi.js')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const SHEET_TYPES = {
  walking: 'walkingSheet',
  running: 'runningSheet',
  action: 'actionSheet',
  standing: 'standingSheet',
  dying: 'dyingSheet',
  corpse: 'corpseSheet',
}
const { setUnitTexture } = loadTsModule('app/lib/entities/spriteTextures.ts', {
  mocks: {
    '../constants': { SHEET_TYPES },
    '../maths': { degreeToDirection: degree => (degree === 180 ? 'north' : 'south') },
    '../animations/actionFrameSequences': {
      getConfiguredActionFrameSequence: () => null,
      applyActionFrameSequence: frames => frames,
    },
  },
})

function createActor(t) {
  const sprite = new AnimatedSprite({ textures: [Texture.EMPTY], autoUpdate: false })
  const textures = Array.from({ length: 12 }, () => new Texture())
  t.after(() => {
    sprite.destroy()
    textures.forEach(texture => texture.destroy())
  })
  const sheet = {
    textures: Object.fromEntries(textures.map((texture, i) => [`${i}.png`, texture])),
    data: { animationSpeed: 0.2 },
  }
  return {
    sprite,
    context: {},
    degree: 0,
    walkingSheet: sheet,
    runningSheet: sheet,
    actionSheet: sheet,
    sheetDirectionCounts: { walkingSheet: 3, runningSheet: 3, actionSheet: 3 },
  }
}

const { Instance } = loadTsModule('app/classes/Instance.ts', {
  mocks: {
    '../lib': { setUnitTexture, uuidv4: () => 'paused-worker' },
    './InstanceHudBars': {},
  },
})

for (const sheet of ['actionSheet', 'walkingSheet']) {
  test(`tutorial startup resumes ${sheet} prepared before explicit pause`, t => {
    const actor = createActor(t)
    actor.context.paused = true
    setUnitTexture(sheet, actor)
    let impacts = 0
    const onFrameChange = () => impacts++
    actor.sprite.onFrameChange = onFrameChange
    assert.equal(actor.sprite.playing, false)
    // Boot starts paused, then preparation and presentation both request pause again.
    Instance.prototype.pause.call(actor)
    Instance.prototype.pause.call(actor)
    Instance.prototype.resume.call(actor)
    actor.context.paused = false
    assert.equal(actor.sprite.playing, true)
    assert.equal(actor.sprite.onFrameChange, onFrameChange)
    actor.sprite.update({ deltaTime: 10 })
    assert.ok(impacts > 0)
  })
}

test('a new work order during pause replaces the previous idle playback state', t => {
  const actor = createActor(t)
  actor.standingSheet = actor.walkingSheet
  setUnitTexture('standingSheet', actor)
  Instance.prototype.pause.call(actor)
  actor.context.paused = true
  setUnitTexture('actionSheet', actor)
  assert.equal(actor.sprite.playing, false)
  Instance.prototype.resume.call(actor)
  assert.equal(actor.sprite.playing, true)
})

test('an idle order during pause cancels the previous work playback state', t => {
  const actor = createActor(t)
  actor.standingSheet = actor.walkingSheet
  setUnitTexture('actionSheet', actor)
  Instance.prototype.pause.call(actor)
  actor.context.paused = true
  setUnitTexture('standingSheet', actor)
  Instance.prototype.resume.call(actor)
  assert.equal(actor.sprite.playing, false)
})

test('repeated pauses preserve playback and frame without starting an already stopped animation', t => {
  const actor = createActor(t)
  setUnitTexture('actionSheet', actor)
  actor.sprite.update({ deltaTime: 10 })
  const frame = actor.sprite.currentFrame
  for (const playing of [true, false]) {
    if (!playing) actor.sprite.stop()
    Instance.prototype.pause.call(actor)
    Instance.prototype.pause.call(actor)
    Instance.prototype.resume.call(actor)
    assert.equal(actor.sprite.playing, playing)
    assert.equal(actor.sprite.currentFrame, frame)
    assert.equal(actor.playingBeforePause, undefined)
  }
})

for (const sheet of ['walkingSheet', 'runningSheet', 'actionSheet']) {
  test(`${sheet} advances despite repeated visual refreshes every 20 ms`, t => {
    const actor = createActor(t)
    setUnitTexture(sheet, actor)
    for (let i = 0; i < 10; i++) {
      setUnitTexture(sheet, actor)
      actor.sprite.update({ deltaTime: 1.2 })
    }
    assert.equal(actor.sprite.currentFrame, 2)
    actor.sprite.stop()
    setUnitTexture(sheet, actor)
    assert.equal(actor.sprite.playing, true)
    assert.equal(actor.sprite.currentFrame, 2)
    actor.sprite.update({ deltaTime: 3 })
    assert.equal(actor.sprite.currentFrame, 3)
  })
}

test('turning preserves the current frame, while changing animation starts at frame zero', t => {
  const actor = createActor(t)
  setUnitTexture('walkingSheet', actor)
  actor.sprite.update({ deltaTime: 10 })
  assert.equal(actor.sprite.currentFrame, 2)
  const southTexture = actor.sprite.texture
  actor.degree = 180
  setUnitTexture('walkingSheet', actor)
  assert.equal(actor.sprite.currentFrame, 2)
  assert.notEqual(actor.sprite.texture, southTexture)
  for (const sheet of ['actionSheet', 'runningSheet', 'walkingSheet']) {
    setUnitTexture(sheet, actor)
    assert.equal(actor.sprite.currentFrame, 0)
    actor.sprite.update({ deltaTime: 10 })
    assert.equal(actor.sprite.currentFrame, 2)
  }
})

test('animal contact approach moves and animates between attacks', t => {
  const actor = createActor(t)
  const cell = { i: 0, j: 0, z: 0 }
  let tick
  let inRange = false
  let direction = 0
  let refreshes = 0
  const { tryStartAnimalContactApproach } = loadTsModule('app/classes/animal/AnimalContactApproach.ts', {
    mocks: {
      '../../constants': { SHEET_TYPES, ACTION_TYPES: { attack: 'attack' }, STEP_TIME: 20 },
      '../../lib/contact/contactGeometry': {
        canReachContact: () => inRange,
        getContactAimDegree: () => direction,
        sampleContactApproach: () => ({ point: { x: 60, y: 0 }, distance: 60, degree: direction, reachable: inRange }),
        getContactTargetShape: () => [],
      },
      '../../lib/geometry/polygon': { pointIsInsidePolygon: () => false },
      '../../lib/mapSpaces': { sameMapSpace: () => true, getEntitySpaceMapLike: () => ({ grid: [[cell]] }) },
      '../../lib/maths': {
        degreeToDirection: degree => (degree < 90 ? 'south' : 'north'),
        getGroundReliefLevel: () => 0,
        getInstanceZIndex: () => 0,
        isometricToCartesian: () => [0, 0],
      },
      '../../lib/grid/visibility': { updateInstanceVisibility() {} },
      '../../lib/units/unitEnergy': { getEnergyMoveSpeedMultiplier: () => 1, updateUnitEnergy() {} },
    },
  })
  Object.assign(actor, {
    x: 0,
    y: 0,
    i: 0,
    j: 0,
    speed: 1,
    currentCell: cell,
    movementSheet: 'runningSheet',
    context: { map: {} },
    getActionCondition: () => true,
    applyReliefLift() {},
    setDest(target) {
      this.dest = target
    },
    setTextures(sheet) {
      refreshes++
      setUnitTexture(sheet, this)
    },
    startInterval(callback) {
      tick = callback
    },
    stopInterval() {},
    getAction() {
      this.setTextures('actionSheet')
    },
  })
  setUnitTexture('actionSheet', actor)
  assert.equal(tryStartAnimalContactApproach(actor, {}, 'attack'), true)
  for (let i = 0; i < 10; i++) {
    direction = i // Small aim changes within the same facing direction.
    tick()
    actor.sprite.update({ deltaTime: 1.2 })
  }
  assert.ok(actor.x > 0)
  assert.equal(actor.currentSheet, 'runningSheet')
  assert.equal(actor.sprite.currentFrame, 2)
  assert.equal(refreshes, 1)
  direction = 180
  tick()
  assert.equal(refreshes, 2)
  assert.equal(actor.sprite.currentFrame, 2)
  inRange = true
  tick()
  assert.equal(actor.currentSheet, 'actionSheet')
  assert.equal(actor.sprite.currentFrame, 0)
})
