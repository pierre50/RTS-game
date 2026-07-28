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
