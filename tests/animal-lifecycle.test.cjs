const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
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
    getInstanceZIndex: instance => instance.i + instance.j,
    getPercentage: (quantity, totalQuantity) => (quantity / totalQuantity) * 100,
    isometricToCartesian: (x, y) => [Math.round(x / 10), Math.round(y / 10)],
    playAudibleSoundCue: () => {},
    updateInstanceVisibility: () => {},
  },
  '../../lib/terrain/reliefSurface': {
    syncEntityRelief: (_map, entity, cell) => entity.applyReliefLift(cell.z ?? 0),
  },
  '../../lib/entities/deathFlash': {
    startDeathFlash: () => () => {},
    runAfterDeathFlash: (sprite, onComplete) => {
      sprite.onFrameChange = () => {}
      return onComplete
    },
  },
  '../../lib/entities/entityVisualFeedback': {
    clearEntityVisualFeedback: () => {},
  },
  '../../lib/entities/entityFade': {
    fadeOutThenClear: animal => {
      animal.fading = true
    },
  },
  '../../lib/combat/combatAttackLoop': {
    clearCombatAttackRecovery: animal => {
      animal.recoveryCleared = [animal.attackRecoveryTaskId, animal.attackRecoveryAnimationTaskId]
      animal.attackRecoveryTaskId = null
      animal.attackRecoveryAnimationTaskId = null
      if (animal.sprite) animal.sprite.onLoop = undefined
    },
  },
  '../../lib/entities/spriteAnimation': {
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

  assert.deepEqual(calls, [['setTextures', 'dyingSheet'], ['syncShadow'], ['gotoAndPlay', 0]])
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
    applyReliefLift: level => calls.push(['applyReliefLift', level]),
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
    ['applyReliefLift', 2],
    ['setTextures', 'dyingSheet'],
    ['syncShadow'],
  ])
  assert.equal(animal.isDead, true)
  assert.deepEqual(animal.path, [])
  assert.equal(animal.action, null)
})

test('animal die clears pending combat recovery before playing dying animation', () => {
  const calls = []
  const cell = {
    has: null,
    i: 0,
    j: 0,
    place(entity) {
      this.has = entity
    },
    solid: true,
    z: 0,
  }
  const sprite = {
    loop: true,
    onComplete: undefined,
    onLoop: () => calls.push(['staleLoop']),
    currentFrame: 2,
    textures: ['frame-0', 'frame-1', 'frame-2'],
    gotoAndPlay(frame) {
      calls.push(['gotoAndPlay', frame])
      this.currentFrame = frame
    },
  }
  const animal = {
    action: 'attack',
    altitude: 0,
    animalBehavior: { stop: () => calls.push(['behavior.stop']) },
    attackRecoveryAnimationTaskId: 24,
    attackRecoveryTaskId: 23,
    companionOwner: null,
    context: {
      controls: { instanceIsAudible: () => false },
      map: {
        grid: [[cell]],
        updateInstanceBucket: (instance, oldI, oldJ) => calls.push(['bucket', oldI, oldJ, instance.i, instance.j]),
      },
    },
    currentCell: cell,
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
    x: 0,
    y: 0,
    zIndex: 4,
    applyReliefLift: level => calls.push(['applyReliefLift', level]),
  }
  cell.has = animal
  const lifecycle = new AnimalLifecycle(animal)
  animal.death = () => lifecycle.death()

  lifecycle.die()

  assert.equal(animal.isDead, true)
  assert.deepEqual(animal.recoveryCleared, [23, 24])
  assert.equal(animal.attackRecoveryTaskId, null)
  assert.equal(animal.attackRecoveryAnimationTaskId, null)
  assert.equal(sprite.onLoop, undefined)
  assert.ok(calls.findIndex(call => call[0] === 'setTextures') > calls.findIndex(call => call[0] === 'behavior.stop'))
  assert.deepEqual(calls.slice(0, 5), [
    ['stopInterval'],
    ['stopTimeout'],
    ['behavior.stop'],
    ['bucket', 0, 0, 0, 0],
    ['applyReliefLift', 0],
  ])
  assert.ok(calls.some(call => call[0] === 'setTextures' && call[1] === 'dyingSheet'))
  assert.ok(calls.some(call => call[0] === 'gotoAndPlay' && call[1] === 0))
})

test('a meatless carcass keeps its materials accessible without scheduling empty-corpse cleanup', () => {
  const { animal } = createAnimal({ quantity: 0 })
  animal.isDead = true
  animal.inventory = { resources: { leather: 2 } }
  let stopped = 0
  let cleared = 0
  animal.stopInterval = () => stopped++
  animal.context.scheduler.addOneShot = () => {
    cleared++
    return 1
  }
  new AnimalLifecycle(animal).updateTexture()
  assert.equal(stopped, 0)
  assert.equal(cleared, 0)
  assert.deepEqual(animal.inventory.resources, { leather: 2 })
  assert.equal(animal.context.map.grid[0][0].corpses.has(animal), true)
})

test('corpse lifetime preserves all loot and resumes the saved countdown until expiration', () => {
  const { animal } = createAnimal({ quantity: 1 })
  animal.isDead = true
  animal.inventory = { resources: { meat: 1, leather: 2 } }
  animal.setTextures = () => {}
  let tick
  animal.startInterval = (callback, delay) => {
    tick = callback
    assert.equal(delay, 1000)
  }
  const lifecycle = new AnimalLifecycle(animal)
  animal.updateTexture = () => lifecycle.updateTexture()
  lifecycle.decompose()
  for (let n = 0; n < 10; n++) tick()
  assert.equal(animal.quantity, 1)
  assert.deepEqual(animal.inventory.resources, { meat: 1, leather: 2 })
  assert.equal(animal.corpseMaterialDecayRemainingMs, 50000)
  assert.equal(animal.fading, undefined)
  animal.corpseMaterialDecayRemainingMs = 2000
  lifecycle.decompose()
  tick()
  assert.equal(animal.corpseMaterialDecayRemainingMs, 1000)
  assert.equal(animal.fading, undefined)
  tick()
  assert.equal(animal.fading, true)
  assert.deepEqual(animal.inventory.resources, { meat: 1, leather: 2 })
})

test('looting never changes the corpse frame or restarts its expiration timer', () => {
  const { animal, sprite } = createAnimal({ quantity: 40 })
  animal.isDead = true
  sprite.textures = ['corpse', 'old-decomposition-1', 'old-decomposition-2', 'old-decomposition-3']
  animal.corpseMaterialDecayRemainingMs = 17000
  const lifecycle = new AnimalLifecycle(animal)
  for (const quantity of [40, 10, 0]) {
    animal.quantity = quantity
    lifecycle.updateTexture()
    assert.equal(sprite.currentFrame, 0)
    assert.equal(animal.corpseMaterialDecayRemainingMs, 17000)
  }
})

test('animal death callback ignores destroyed animals and newer corpse animations', () => {
  let decompositions = 0
  const animal = {
    altitude: 0, zIndex: 1, sprite: { gotoAndPlay() {} },
    setTextures(sheet) { this.currentSheet = sheet }, syncShadow() {},
    decompose() { decompositions++; this.currentSheet = 'corpseSheet' },
  }
  const lifecycle = new AnimalLifecycle(animal)
  lifecycle.death()
  const finish = animal.sprite.onComplete
  finish()
  finish()
  assert.equal(decompositions, 1)
  lifecycle.death()
  animal.isDestroyed = true
  animal.sprite.onComplete()
  assert.equal(decompositions, 1)
})
