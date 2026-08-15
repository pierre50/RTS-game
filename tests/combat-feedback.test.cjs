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

class MockText {
  constructor(options) {
    this.text = options.text
    this.destroyed = false
    this.anchor = { set: () => {} }
  }

  destroy() {
    this.destroyed = true
  }
}

test('alert-then-aggression feedback sequences emotes instead of stacking them', () => {
  const scheduled = []
  const addedTexts = []
  const scheduler = {
    elapsedMs: 1000,
    add: () => 1,
    remove: () => {},
    addOneShot: (callback, delay, name) => {
      scheduled.push({ callback, delay, name })
      return scheduled.length
    },
  }
  const target = {
    family: 'animal',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    addChild: text => addedTexts.push(text.text),
  }

  const { showAlertThenAggressionFeedback } = loadModule('app/lib/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    './maths': { getReliefOffset: () => 0 },
  })
  let aggressionCallbacks = 0

  showAlertThenAggressionFeedback(target, () => {
    aggressionCallbacks += 1
  })

  assert.deepEqual(addedTexts, ['!'])
  assert.equal(aggressionCallbacks, 0)
  assert.equal(scheduled.length, 1)
  assert.equal(scheduled[0].delay, 350)
  assert.equal(scheduled[0].name, 'unit.alertAggressionText')

  showAlertThenAggressionFeedback(target, () => {
    aggressionCallbacks += 1
  })

  assert.deepEqual(addedTexts, ['!'])
  assert.equal(aggressionCallbacks, 0)
  assert.equal(scheduled.length, 1)

  scheduler.elapsedMs += scheduled[0].delay
  scheduled[0].callback()

  assert.deepEqual(addedTexts, ['!', '💢'])
  assert.equal(aggressionCallbacks, 1)
})

test('clearAllCombatFeedback removes active hit flashes without waiting for scheduler callbacks', () => {
  const scheduler = {
    elapsedMs: 0,
    add: () => 1,
    remove: () => {},
    addOneShot: () => 1,
  }
  const originalFilters = [{ name: 'base' }]
  const sprite = {
    anchor: { y: 1 },
    destroyed: false,
    filters: originalFilters,
    height: 40,
  }
  const target = {
    family: 'unit',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite,
    addChild: () => {},
  }

  const { clearAllCombatFeedback, showDamageFeedback } = loadModule('app/lib/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    './maths': { getReliefOffset: () => 0 },
  })

  showDamageFeedback(target, 3)
  assert.equal(sprite.filters.length, 2)

  clearAllCombatFeedback()

  assert.deepEqual(sprite.filters, originalFilters)
})

test('base filter updates preserve an active hit flash until its scheduled cleanup', () => {
  const scheduled = []
  const scheduler = {
    elapsedMs: 0,
    add: () => 1,
    remove: () => {},
    addOneShot: (callback, delay, name) => {
      scheduled.push({ callback, delay, name })
      return scheduled.length
    },
  }
  const originalFilters = [{ name: 'base' }]
  const sprite = {
    anchor: { y: 1 },
    destroyed: false,
    filters: originalFilters,
    height: 40,
  }
  const target = {
    family: 'unit',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite,
    addChild: () => {},
  }

  const { setSpriteFiltersPreservingDamageFeedback, showDamageFeedback } = loadModule('app/lib/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    './maths': { getReliefOffset: () => 0 },
  })

  showDamageFeedback(target, 3)
  assert.equal(sprite.filters.length, 2)

  setSpriteFiltersPreservingDamageFeedback(sprite, null)

  assert.equal(sprite.filters.length, 1)
  assert.notEqual(sprite.filters[0], originalFilters[0])

  scheduled[0].callback()

  assert.equal(sprite.filters, null)
})
