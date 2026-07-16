const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadInstance() {
  const filename = path.join(__dirname, '../app/classes/Instance.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Container: class {
        constructor() {
          this.children = []
        }
        addChildAt(child, index) {
          this.children.splice(index, 0, child)
        }
        getChildByLabel(label) {
          return this.children.find(child => child.label === label) || null
        }
        removeChild(child) {
          const index = this.children.indexOf(child)
          if (index >= 0) this.children.splice(index, 1)
        }
      },
      Graphics: class {
        poly() {}
        stroke() {}
      },
    },
    '../constants': {
      COLOR_WHITE: 0xffffff,
      COLOR_GREEN: 0x00ff00,
      COLOR_RED: 0xff0000,
      FAMILY_TYPES: { building: 'building', unit: 'unit' },
      LABEL_TYPES: {
        shadow: 'shadow',
        selection: 'selection',
        healthBar: 'healthBar',
      },
    },
    '../lib': {
      getActionCondition: () => false,
      setUnitTexture: () => {},
      uuidv4: () => 'instance-1',
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('selection is inserted above building shadows', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const inserted = []
  instance.selected = false
  instance.size = 2
  instance.addChildAt = (child, index) => {
    inserted.push(index)
    child.label = child.label || 'selection'
  }
  instance.drawHealthBar = () => {}
  instance.getChildByLabel = label => (label === 'shadow' ? { label: 'shadow' } : null)

  Instance.prototype.select.call(instance)

  assert.equal(inserted[0], 1)
})
