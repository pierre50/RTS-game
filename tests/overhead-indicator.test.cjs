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

class MockText {
  constructor(options) {
    this.text = options.text
    this.style = options.style
    this.anchor = { set: () => {} }
    this.width = options.text.length * 6
    this.height = options.style.fontSize
  }

  destroy() {
    this.destroyed = true
  }
}

class MockContainer {
  constructor() {
    this.children = []
    this.alpha = 1
    this.destroyed = false
    this.parent = null
  }

  addChild(...children) {
    children.forEach(child => {
      child.parent = this
    })
    this.children.push(...children)
  }

  removeChild(child) {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    child.parent = null
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
  destroy() {
    this.destroyed = true
  }
}

function createUnit(extra = {}) {
  const children = []
  return {
    children,
    sprite: { height: 32 },
    addChild: child => {
      child.parent = {
        removeChild: target => {
          const index = children.indexOf(target)
          if (index >= 0) children.splice(index, 1)
          target.parent = null
        },
      }
      children.push(child)
    },
    getChildByLabel: label => children.find(child => child.label === label),
    removeChild: child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
      child.parent = null
    },
    ...extra,
  }
}

function createScheduler() {
  const tasks = new Map()
  let nextId = 1
  return {
    elapsedMs: 0,
    add(callback, _interval, name) {
      const id = nextId++
      tasks.set(id, { callback, name })
      return id
    },
    remove(id) {
      tasks.delete(id)
    },
    run(id = 1) {
      tasks.get(id)?.callback()
    },
    runByName(name) {
      ;[...tasks.values()].find(task => task.name === name)?.callback()
    },
    has(id) {
      return tasks.has(id)
    },
  }
}

test('overhead indicators use styled text for alert and sleep states', () => {
  const createdBubbles = []
  const { setUnitOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
      LABEL_TYPES: { overheadIndicator: 'overheadIndicator' },
    },
    '../maths': { getReliefOffset: unit => unit.reliefLift ?? 0 },
    './statusBubble': {
      createStatusBubble: options => {
        createdBubbles.push(options)
        const bubble = new MockContainer()
        bubble.addChild(
          new MockGraphics(),
          new MockGraphics(),
          new MockText({ ...options, style: { fontSize: options.fontSize } })
        )
        return bubble
      },
    },
  })
  const unit = createUnit()

  setUnitOverheadIndicator(unit, 'sleep')

  assert.equal(unit.children.length, 1)
  assert.equal(unit.children[0].label, 'overheadIndicator')
  assert.deepEqual(createdBubbles[0], { text: 'zzz', fontSize: 13 })

  setUnitOverheadIndicator(unit, 'exclamation')

  assert.equal(unit.children.length, 1)
  assert.equal(unit.children[0].label, 'overheadIndicator')
  assert.deepEqual(createdBubbles[1], { text: '!', fontSize: 14 })
})

test('overhead indicators track visual relief lift', () => {
  const { setUnitOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
      LABEL_TYPES: { overheadIndicator: 'overheadIndicator' },
    },
    '../maths': { getReliefOffset: unit => unit.reliefLift ?? 0 },
    './statusBubble': {
      createStatusBubble: () => new MockContainer(),
    },
  })
  const unit = createUnit()
  unit.family = 'unit'
  unit.reliefLift = -24

  setUnitOverheadIndicator(unit, 'sleep')

  assert.equal(unit.children[0].y, -72)
})

test('overhead indicators support entity-specific offsets', () => {
  const { setEntityOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', building: 'building', unit: 'unit' },
      LABEL_TYPES: { overheadIndicator: 'overheadIndicator' },
    },
    '../maths': { getReliefOffset: entity => entity.reliefLift ?? 0 },
    './statusBubble': {
      createStatusBubble: () => new MockContainer(),
    },
  })
  const trap = createUnit({
    family: 'building',
    overheadIndicatorOffsetX: 3,
    overheadIndicatorOffsetY: 30,
    reliefLift: 0,
    sprite: { anchor: { y: 0.5 }, height: 96, scale: { y: 1 } },
  })

  setEntityOverheadIndicator(trap, 'question')

  assert.equal(trap.children[0].x, 3)
  assert.equal(trap.children[0].y, -24)
})

test('overhead indicators keep tracking relief while visible', () => {
  const { setUnitOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
      LABEL_TYPES: { overheadIndicator: 'overheadIndicator' },
    },
    '../maths': { getReliefOffset: unit => unit.reliefLift ?? 0 },
    './statusBubble': {
      createStatusBubble: () => new MockContainer(),
    },
  })
  const scheduler = createScheduler()
  const unit = createUnit()
  unit.context = { scheduler }
  unit.family = 'unit'
  unit.reliefLift = -8

  setUnitOverheadIndicator(unit, 'sleep')
  const indicator = unit.children[0]
  unit.reliefLift = -24
  scheduler.runByName('entity.overheadIndicatorPosition')

  assert.equal(indicator.y, -72)
})

test('clearing an overhead indicator fades it out before destroying it', () => {
  const { clearUnitOverheadIndicator, setUnitOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': {
      FAMILY_TYPES: { animal: 'animal', unit: 'unit' },
      LABEL_TYPES: { overheadIndicator: 'overheadIndicator' },
    },
    '../maths': { getReliefOffset: () => 0 },
    './statusBubble': {
      createStatusBubble: () => new MockContainer(),
    },
  })
  const scheduler = createScheduler()
  const unit = createUnit()
  unit.context = { scheduler }

  setUnitOverheadIndicator(unit, 'sleep')
  const indicator = unit.children[0]

  clearUnitOverheadIndicator(unit)
  clearUnitOverheadIndicator(unit)
  scheduler.elapsedMs = 70
  scheduler.runByName('entity.overheadIndicatorFade')

  assert.equal(unit.children[0], indicator)
  assert.equal(indicator.alpha, 0.5)
  assert.equal(indicator.destroyed, false)

  scheduler.elapsedMs = 140
  scheduler.runByName('entity.overheadIndicatorFade')

  assert.equal(unit.children.length, 0)
  assert.equal(indicator.destroyed, true)
})
