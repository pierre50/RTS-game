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
    getPercentage: (quantity, totalQuantity) => (quantity / totalQuantity) * 100,
    playAudibleSoundCue: () => {},
    updateInstanceVisibility: () => {},
  },
  '../../lib/combatFeedback': {
    clearDamageFeedback: () => {},
  },
  '../../lib/deathFlash': {
    startDeathFlash: () => () => {},
    runAfterDeathFlash: (_sprite, onComplete) => onComplete,
  },
  '../../lib/entityFade': {
    fadeOutThenClear: () => {},
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
