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
  bubble.addChild(
    new MockGraphics(),
    new MockGraphics(),
    new MockText({ ...options, style: { fontSize: options.fontSize } })
  )
  return bubble
}

const spriteTransientEffects = loadModule('app/lib/entities/spriteTransientEffects.ts', {})

test('alert signals detection once and preserves the delayed aggression callback', () => {
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

  assert.deepEqual(addedTexts, ['!'])
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

  const { showHealingFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showHealingFeedback(target)

  const display = addedDisplays[0]
  const initialY = display.y
  assert.equal(getAddedFeedbackText(display), '♥')
  assert.equal(scheduled[0].name, 'unit.healingText')

  for (let index = 0; index < 15; index++) scheduled[0].callback()

  assert.equal(display.y, initialY)
  assert.equal(display.destroyed, false)

  for (let index = 0; index < 31; index++) scheduled[0].callback()

  assert.equal(display.y, initialY)
  assert.equal(display.destroyed, true)
})

test('damage feedback no longer adds a white hit flash filter', () => {
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

  const { showDamageFeedback } = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      Text: MockText,
    },
    '../constants': {
      FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' },
    },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/spriteTransientEffects': spriteTransientEffects,
  })

  showDamageFeedback(target, 3)

  assert.deepEqual(sprite.filters, originalFilters)
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

function feedbackFixture() {
  const tasks = new Map()
  const displays = []
  const overlays = []
  let id = 0
  const scheduler = {
    elapsedMs: 1000,
    add(callback, delay, label) {
      const key = id++
      tasks.set(key, { callback, delay, label })
      return key
    },
    addOneShot(callback, delay, label) {
      return this.add(callback, delay, label)
    },
    remove(key) {
      tasks.delete(key)
    },
  }
  const parent = {
    children: [],
    addChild(child) {
      this.children.push(child)
      child.parent = this
    },
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1)
      child.parent = null
    },
  }
  const target = {
    family: 'unit',
    x: 10,
    y: 20,
    context: { scheduler },
    parent,
    sprite: { parent, width: 20, height: 40, x: 0, y: 0, anchor: { x: 0.5, y: 1 } },
    children: [],
    addChild(child) {
      this.children.push(child)
      child.parent = this
    },
  }
  const effects = []
  const api = loadModule('app/lib/combat/combatFeedback.ts', {
    'pixi.js': {
      Text: class extends MockText {
        constructor(options) {
          super(options)
          displays.push(this)
        }
      },
      Graphics: class extends MockGraphics {
        constructor() {
          super()
          overlays.push(this)
        }
        fill(options) {
          this.lastFill = options
        }
      },
    },
    '../constants': { FAMILY_TYPES: { unit: 'unit', animal: 'animal', building: 'building', resource: 'resource' } },
    '../maths': { getReliefOffset: () => 0 },
    '../entities/entityHudPosition': { getEntityHudTopY: () => -40 },
    '../entities/spriteTransientEffects': {
      hasSpriteFilterEffect: sprite => Boolean(sprite.effect),
      clearSpriteFilterEffect: sprite => {
        sprite.effect = false
        effects.push('clear')
      },
      clearAllSpriteFilterEffects: () => effects.push('all'),
      setSpriteFiltersPreservingTransientEffect: (sprite, filters) => {
        sprite.filters = filters
        effects.push('set')
      },
    },
  })
  function task(label) {
    return [...tasks.values()].find(entry => entry.label === label)
  }
  return { api, target, scheduler, tasks, displays, overlays, parent, effects, task }
}

test('combat feedback rejects invalid amounts, unsupported families and unavailable targets', () => {
  const f = feedbackFixture()
  for (const name of ['showDamageFeedback', 'showCriticalDamageFeedback', 'showHitPointGainFeedback']) {
    for (const amount of [NaN, Infinity, -1, 0, 0.1]) f.api[name](f.target, amount)
    for (const state of [{ family: 'other' }, { isDead: true }, { isDestroyed: true }, { context: { defeat: true } }])
      f.api[name]({ ...f.target, ...state }, 5)
  }
  f.api.showParryFeedback({ ...f.target, family: 'other' }, 'parry')
  f.api.showResourceGainFeedback(f.target, 0)
  f.api.showLevelUpFeedback({ ...f.target, context: {} }, 'level')
  assert.equal(f.tasks.size, 0)
  assert.equal(f.displays.length, 0)
})

test('floating combat texts animate, expire, and clean up destroyed targets and displays', () => {
  const f = feedbackFixture()
  f.api.showCriticalDamageFeedback(f.target, 3.6)
  assert.equal(f.displays[0].text, 'CRIT -4')
  const animation = f.task('combat.criticalDamageText').callback
  const originalY = f.displays[0].y
  animation()
  assert.ok(f.displays[0].y < originalY)
  for (let i = 0; i < 13; i++) animation()
  assert.equal(f.displays[0].destroyed, true)
  assert.equal(f.tasks.size, 0)
  f.api.showParryFeedback(f.target, 'PARRY')
  const parry = f.task('combat.parryText').callback
  f.target.isDestroyed = true
  parry()
  assert.equal(f.tasks.size, 0)
  f.target.isDestroyed = false
  f.api.showLevelUpFeedback(f.target, 'Level 2')
  f.displays.at(-1).destroy()
  f.task('experience.levelUpText').callback()
  assert.equal(f.tasks.size, 0)
  f.api.clearDamageFeedback({})
})

test('resource feedback is detached from harvested targets and missing parents release displays', () => {
  const f = feedbackFixture()
  f.target.family = 'resource'
  delete f.target.sprite
  f.api.showResourceGainFeedback(f.target, 2, 'Wood')
  assert.equal(f.displays[0].text, '+2 Wood')
  assert.equal(f.displays[0].x, 10)
  assert.equal(f.parent.children[0], f.displays[0])
  f.target.isDestroyed = true
  f.task('resource.gainText').callback()
  assert.equal(f.displays[0].destroyed, false)
  f.api.clearDamageFeedback(f.target)
  assert.equal(f.displays[0].destroyed, true)
  f.target.isDestroyed = false
  delete f.target.x
  delete f.target.y
  f.api.showResourceGainFeedback(f.target, 1)
  assert.equal(f.displays.at(-1).x, 0)
  f.api.clearDamageFeedback(f.target)
  for (const parent of [null, { destroyed: true }]) {
    f.target.parent = parent
    f.api.showResourceGainFeedback(f.target, 1)
    assert.equal(f.displays.at(-1).destroyed, true)
  }
  assert.equal(f.tasks.size, 0)
})

test('conversion waves preserve replacement effects and clean up on completion and interruption', () => {
  const f = feedbackFixture()
  for (const [color, expected] of [
    ['red', 0xe30b00],
    ['#123456', 0x123456],
    ['#bad', 0xffffff],
    [undefined, 0xffffff],
  ]) {
    f.api.showConversionFeedback(f.target, color)
    const current = f.task('combat.conversionWave').callback
    current()
    assert.equal(f.overlays.at(-1).lastFill.color, expected)
    for (let i = 0; i < 11; i++) current()
    assert.equal(f.overlays.at(-1).destroyed, true)
    assert.equal(f.tasks.size, 0)
  }
  f.api.showConversionFeedback(f.target, 'blue')
  const stale = f.task('combat.conversionWave').callback
  f.api.showConversionFeedback(f.target, 'green')
  stale()
  assert.equal(f.overlays.at(-1).destroyed, undefined)
  assert.equal(f.tasks.size, 1)
  for (const state of ['destroyed', 'isDestroyed', 'defeat']) {
    if (state === 'destroyed') f.target.sprite.destroyed = true
    else if (state === 'defeat') f.target.context.defeat = true
    else f.target.isDestroyed = true
    f.task('combat.conversionWave').callback()
    assert.equal(f.tasks.size, 0)
    f.target.sprite.destroyed = false
    f.target.context.defeat = false
    f.target.isDestroyed = false
    f.api.showConversionFeedback(f.target)
  }
  f.target.sprite.effect = true
  f.api.clearDamageFeedback(f.target)
  assert.equal(f.target.sprite.effect, false)
  f.api.clearDamageFeedback(f.target)
  assert.equal(f.tasks.size, 0)
  for (const state of [
    { family: 'other' },
    { family: 'building' },
    { context: {} },
    { sprite: null },
    { sprite: {} },
    { isDestroyed: true },
    { context: { defeat: true } },
  ])
    f.api.showConversionFeedback({ ...f.target, ...state })
  assert.equal(f.tasks.size, 0)
  const filters = [{}]
  f.api.setSpriteFiltersPreservingDamageFeedback(f.target.sprite, filters)
  assert.equal(f.target.sprite.filters, filters)
})

test('status feedback cooldowns expire and direct aggression cancels a pending sequence', () => {
  const f = feedbackFixture()
  for (const name of [
    'showHealingFeedback',
    'showAlertFeedback',
  ]) {
    const before = f.target.children.length
    f.api[name](f.target)
    f.api[name](f.target)
    assert.equal(f.target.children.length, before + 1, name)
    f.scheduler.elapsedMs += 1200
    f.api[name](f.target)
    assert.equal(f.target.children.length, before + 2, name)
    f.api[name]({})
  }
  f.scheduler.elapsedMs += 1200
  let aggression = 0
  f.api.showAlertThenAggressionFeedback(f.target, () => aggression++)
  assert.ok(f.task('unit.alertAggressionText'))
  f.api.showAlertThenAggressionFeedback(f.target)
  f.api.cancelPendingAggression(f.target)
  assert.equal(f.task('unit.alertAggressionText'), undefined)
  assert.equal(aggression, 0)
  f.api.clearAllCombatFeedback()
  assert.equal(f.tasks.size, 0)
  assert.ok(f.effects.includes('all'))
})

test('delayed aggression ignores dead or destroyed targets and supports missing schedulers', () => {
  for (const field of ['isDead', 'isDestroyed']) {
    const f = feedbackFixture()
    let called = false
    f.api.showAlertThenAggressionFeedback(f.target, () => {
      called = true
    })
    f.target[field] = true
    f.task('unit.alertAggressionText').callback()
    assert.equal(called, false)
    f.api.clearAllCombatFeedback()
  }
  const f = feedbackFixture()
  let called = false
  f.api.showAlertThenAggressionFeedback({}, () => {
    called = true
  })
  assert.equal(called, true)
  f.api.showAlertThenAggressionFeedback({})
  f.api.showConversionFeedback(f.target)
  f.api.clearAllCombatFeedback()
  assert.equal(f.tasks.size, 0)
})
