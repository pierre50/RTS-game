const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadModule(relativePath, mocks) {
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

const { AnimalLifecycle } = loadModule('app/classes/animal/AnimalLifecycle.ts', {
  '../../constants': {
    CORPSE_TIME: 60,
    FADE_DURATION_MS: 2000,
    MENU_INFO_IDS: { quantityText: 'quantityText' },
    SHEET_TYPES: { corpse: 'corpseSheet', dying: 'dyingSheet' },
  },
  '../../lib': {
    cartesianToIsometric: (i, j) => [i * 10, j * 10],
    getGroundReliefLevel: cell => cell.z ?? 0,
    getInstanceZIndex: instance => instance.i + instance.j,
    getPercentage: (quantity, totalQuantity) => (quantity / totalQuantity) * 100,
    isometricToCartesian: (x, y) => [Math.round(x / 10), Math.round(y / 10)],
    playAudibleSoundCue: () => {},
    updateInstanceVisibility: () => {},
  },
  '../../lib/deathFlash': {
    startDeathFlash: () => () => {},
    runAfterDeathFlash: (sprite, onComplete) => {
      sprite.onFrameChange = () => {}
      return onComplete
    },
  },
  '../../lib/entityVisualFeedback': {
    clearEntityVisualFeedback: () => {},
  },
  '../../lib/entityFade': {
    fadeOutThenClear: () => {},
  },
  '../../lib/spriteAnimation': {
    playSpriteAnimationFromStart: (sprite, options = {}) => {
      if (options.clearFrameChange) sprite.onFrameChange = undefined
      if (options.clearLoop !== false) sprite.onLoop = undefined
      sprite.loop = options.loop ?? sprite.loop
      if (options.onComplete !== undefined) sprite.onComplete = options.onComplete
      sprite.gotoAndPlay(0)
    },
  },
})

function createAnimal({ quantity = 50, selected = false } = {}) {
  let currentFrame = 0
  const sprite = {
    textures: ['single-frame-corpse'],
    get currentFrame() {
      return currentFrame
    },
    set currentFrame(value) {
      assert.ok(value >= 0 && value < this.textures.length)
      currentFrame = value
    },
  }
  const cell = { has: null, corpses: new Set(), solid: true }
  const animal = {
    i: 0,
    j: 0,
    quantity,
    totalQuantity: 150,
    selected,
    sprite,
    context: {
      map: { grid: [[cell]] },
      player: {
        selectedOther: null,
        unselectAll: () => {},
      },
      scheduler: {
        addOneShot: () => 1,
      },
    },
    stopInterval: () => {},
    syncShadow: () => {},
    clear: () => {},
  }
  animal.context.player.selectedOther = animal
  cell.has = animal
  return { animal, sprite }
}

test('animal corpse depletion clamps to available sprite frames', () => {
  const { animal, sprite } = createAnimal({ quantity: 50 })

  new AnimalLifecycle(animal).updateTexture()

  assert.equal(sprite.currentFrame, 0)
})

test('fully depleted single-frame animal corpses clear without invalid frame writes', () => {
  const { animal, sprite } = createAnimal({ quantity: 0 })

  new AnimalLifecycle(animal).updateTexture()

  assert.equal(sprite.currentFrame, 0)
  assert.equal(animal.context.map.grid[0][0].has, null)
  assert.equal(animal.context.map.grid[0][0].corpses.has(animal), true)
})

test('animal death always starts the dying animation from the first frame', () => {
  const calls = []
  const sprite = {
    loop: true,
    onComplete: undefined,
    onLoop: () => {},
    currentFrame: 3,
    gotoAndPlay(frame) {
      calls.push(['gotoAndPlay', frame])
      this.currentFrame = frame
    },
  }
  const animal = {
    altitude: 0,
    sprite,
    zIndex: 10,
    setTextures: sheet => calls.push(['setTextures', sheet]),
    syncShadow: () => calls.push(['syncShadow']),
  }

  new AnimalLifecycle(animal).death()

  assert.deepEqual(calls, [
    ['setTextures', 'dyingSheet'],
    ['syncShadow'],
    ['gotoAndPlay', 0],
  ])
  assert.equal(sprite.loop, false)
  assert.equal(sprite.onLoop, undefined)
  assert.equal(typeof sprite.onFrameChange, 'function')
  assert.equal(typeof sprite.onComplete, 'function')
  assert.equal(sprite.currentFrame, 0)
})

test('animal death settles a moving corpse onto its visual cell', () => {
  const oldCell = {
    has: null,
    i: 0,
    j: 0,
    place(entity) {
      this.has = entity
    },
    solid: true,
    z: 0,
  }
  const visualCell = {
    has: null,
    i: 1,
    j: 0,
    place(entity) {
      this.has = entity
    },
    solid: false,
    z: 2,
  }
  const buckets = []
  const calls = []
  const sprite = {
    loop: true,
    onComplete: undefined,
    onLoop: () => {},
    currentFrame: 2,
    gotoAndPlay(frame) {
      calls.push(['gotoAndPlay', frame])
      this.currentFrame = frame
    },
  }
  const animal = {
    action: 'flee',
    altitude: 0,
    animalBehavior: { stop: () => calls.push(['behavior.stop']) },
    companionOwner: null,
    context: {
      controls: { instanceIsAudible: () => false },
      map: {
        grid: [[oldCell], [visualCell]],
        updateInstanceBucket: (instance, oldI, oldJ) => buckets.push([oldI, oldJ, instance.i, instance.j]),
      },
    },
    currentCell: oldCell,
    i: 0,
    isDead: false,
    j: 0,
    owner: { population: 1 },
    path: [{ i: 1, j: 0 }],
    setTextures: sheet => calls.push(['setTextures', sheet]),
    sprite,
    stopInterval: () => calls.push(['stopInterval']),
    stopTimeout: () => calls.push(['stopTimeout']),
    syncShadow: () => calls.push(['syncShadow']),
    x: 9,
    y: 0,
    zIndex: 0,
    applyReliefLift: (level, immediate) => calls.push(['applyReliefLift', level, immediate]),
  }
  oldCell.has = animal
  const lifecycle = new AnimalLifecycle(animal)
  animal.death = () => lifecycle.death()

  lifecycle.die()

  assert.equal(oldCell.has, null)
  assert.equal(oldCell.solid, false)
  assert.equal(visualCell.has, animal)
  assert.equal(visualCell.solid, true)
  assert.equal(animal.currentCell, visualCell)
  assert.equal(animal.i, 1)
  assert.equal(animal.j, 0)
  assert.equal(animal.z, 2)
  assert.deepEqual(buckets, [[0, 0, 1, 0]])
  assert.deepEqual(calls.slice(0, 6), [
    ['stopInterval'],
    ['stopTimeout'],
    ['behavior.stop'],
    ['applyReliefLift', 2, true],
    ['setTextures', 'dyingSheet'],
    ['syncShadow'],
  ])
  assert.equal(animal.isDead, true)
  assert.deepEqual(animal.path, [])
  assert.equal(animal.action, null)
})
