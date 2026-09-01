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
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === '../entities/statusBubble') return { createStatusBubble: createMockStatusBubble }
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

class MockText {
  constructor(options) {
    this.text = options.text
    this.style = options.style
    this.destroyed = false
    this.anchor = { set: () => {} }
    this.width = options.text.length * 6
    this.height = options.style.fontSize ?? 12
  }

  destroy(_options) {
    this.destroyed = true
  }
}

class MockContainer {
  constructor() {
    this.children = []
    this.destroyed = false
  }

  addChild(...children) {
    this.children.push(...children)
  }

  destroy(options) {
    this.destroyed = true
    if (options?.children) this.children.forEach(child => child.destroy?.(options))
  }
}

class MockGraphics {
  rect() {}
  poly() {}
  fill() {}
  stroke() {}
  clear() {}
  destroy() {
    this.destroyed = true
  }
}

function getAddedFeedbackText(display) {
  return display.text ?? display.children?.find(child => typeof child.text === 'string')?.text
}

function createMockStatusBubble(options) {
  const bubble = new MockContainer()
  bubble.addChild(new MockGraphics(), new MockGraphics(), new MockText({ ...options, style: { fontSize: options.fontSize } }))
  return bubble
}

const spriteTransientEffects = loadModule('app/lib/entities/spriteTransientEffects.ts', {})

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
    addChild: display => addedTexts.push(getAddedFeedbackText(display)),
  }

  const { showAlertThenAggressionFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Container: MockContainer,
      Graphics: MockGraphics,
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
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

  assert.deepEqual(addedTexts, ['!', '!!'])
  assert.equal(aggressionCallbacks, 1)
})

test('status bubble feedback fades in place and lasts longer than damage text', () => {
  const scheduled = []
  const scheduler = {
    elapsedMs: 1000,
    add: (callback, delay, name) => {
      scheduled.push({ callback, delay, name })
      return scheduled.length
    },
    remove: () => {},
    addOneShot: () => 1,
  }
  const addedDisplays = []
  const target = {
    family: 'unit',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite: { anchor: { y: 1 }, height: 40 },
    addChild: display => addedDisplays.push(display),
  }

  const { showFatigueFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showFatigueFeedback(target)

  const display = addedDisplays[0]
  const initialY = display.y
  assert.equal(getAddedFeedbackText(display), '...')
  assert.equal(scheduled[0].name, 'unit.fatigueText')

  for (let index = 0; index < 15; index++) scheduled[0].callback()

  assert.equal(display.y, initialY)
  assert.equal(display.destroyed, false)

  for (let index = 0; index < 31; index++) scheduled[0].callback()

  assert.equal(display.y, initialY)
  assert.equal(display.destroyed, true)
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

  const { clearAllCombatFeedback, showDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
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

  const { setSpriteFiltersPreservingDamageFeedback, showDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showDamageFeedback(target, 3)
  assert.equal(sprite.filters.length, 2)

  setSpriteFiltersPreservingDamageFeedback(sprite, null)

  assert.equal(sprite.filters.length, 1)
  assert.notEqual(sprite.filters[0], originalFilters[0])

  scheduled[0].callback()

  assert.equal(sprite.filters, null)
})

test('animal hit flash survives animation texture resets and then clears', () => {
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
  const sprite = {
    anchor: { y: 1 },
    destroyed: false,
    filters: null,
    height: 40,
  }
  const target = {
    family: 'animal',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite,
    addChild: () => {},
  }

  const { setSpriteFiltersPreservingDamageFeedback, showDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showDamageFeedback(target, 3)
  assert.equal(sprite.filters.length, 1)

  setSpriteFiltersPreservingDamageFeedback(sprite, null)
  assert.equal(sprite.filters.length, 1)

  scheduled[0].callback()

  assert.equal(sprite.filters, null)
})

test('repeated hit flashes cancel stale cleanup tasks for the same sprite', () => {
  const scheduled = []
  const removed = []
  const scheduler = {
    elapsedMs: 0,
    add: () => 1,
    remove: taskId => removed.push(taskId),
    addOneShot: (callback, delay, name) => {
      scheduled.push({ callback, delay, name })
      return scheduled.length
    },
  }
  const sprite = {
    anchor: { y: 1 },
    destroyed: false,
    filters: null,
    height: 40,
  }
  const target = {
    family: 'animal',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite,
    addChild: () => {},
  }

  const { showDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showDamageFeedback(target, 3)
  const firstFlash = sprite.filters[0]
  showDamageFeedback(target, 2)

  assert.deepEqual(removed, [1])
  assert.equal(scheduled.length, 2)
  assert.equal(sprite.filters.length, 1)
  assert.notEqual(sprite.filters[0], firstFlash)

  scheduled[0].callback()
  assert.equal(sprite.filters.length, 1)

  scheduled[1].callback()
  assert.equal(sprite.filters, null)
})

test('clearDamageFeedback leaves unrelated sprite filters alone', () => {
  const scheduler = {
    elapsedMs: 0,
    add: () => 1,
    remove: () => {},
    addOneShot: () => 1,
  }
  const unrelatedFilter = { name: 'weather-or-team-color' }
  const sprite = {
    anchor: { y: 1 },
    destroyed: false,
    filters: [unrelatedFilter],
    height: 40,
  }
  const target = {
    family: 'animal',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite,
    addChild: () => {},
  }

  const { clearDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  clearDamageFeedback(target)

  assert.deepEqual(sprite.filters, [unrelatedFilter])
})

test('building hit point gains show a positive floating value', () => {
  const scheduled = []
  const scheduler = {
    elapsedMs: 0,
    add: (callback, delay, name) => {
      scheduled.push({ callback, delay, name })
      return scheduled.length
    },
    remove: () => {},
    addOneShot: () => 1,
  }
  const addedDisplays = []
  const building = {
    family: 'building',
    context: { scheduler },
    isDead: false,
    isDestroyed: false,
    sprite: { anchor: { y: 1 }, height: 60 },
    addChild: display => addedDisplays.push(display),
  }

  const { showHitPointGainFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      ColorMatrixFilter: class {},
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showHitPointGainFeedback(building, 2.6)

  assert.equal(getAddedFeedbackText(addedDisplays[0]), '+3')
  assert.equal(scheduled[0].name, 'combat.hitPointGainText')

  showHitPointGainFeedback(building, 0.000005)

  assert.equal(addedDisplays.length, 1)
})
