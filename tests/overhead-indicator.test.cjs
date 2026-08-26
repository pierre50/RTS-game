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
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
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
  destroy() {
    this.destroyed = true
  }
}

function createUnit() {
  const children = []
  return {
    children,
    sprite: { height: 32 },
    addChild: child => children.push(child),
    getChildByLabel: label => children.find(child => child.label === label),
    removeChild: child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  }
}

test('overhead indicators use styled text for alert and sleep states', () => {
  const createdBubbles = []
  const { setUnitOverheadIndicator } = loadModule('app/lib/entities/overheadIndicator.ts', {
    '../constants': { FAMILY_TYPES: { animal: 'animal', unit: 'unit' }, LABEL_TYPES: { overheadIndicator: 'overheadIndicator' } },
    './statusBubble': {
      createStatusBubble: options => {
        createdBubbles.push(options)
        const bubble = new MockContainer()
        bubble.addChild(new MockGraphics(), new MockGraphics(), new MockText({ ...options, style: { fontSize: options.fontSize } }))
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
