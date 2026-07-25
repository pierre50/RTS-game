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
      FillGradient: class {},
      Graphics: class {
        constructor() {
          this.rects = []
          this.fills = []
          this.position = { y: 0 }
        }
        rect(x, y, width, height) {
          this.rects.push({ x, y, width, height })
          return this
        }
        fill(value) {
          this.fills.push(value)
          return this
        }
        poly() {}
        stroke() {}
      },
    },
    '../constants': {
      COLOR_WHITE: 0xffffff,
      COLOR_GREEN: 0x00ff00,
      COLOR_RED: 0xff0000,
      COLOR_GOLD: 0xffcc33,
      FAMILY_TYPES: { building: 'building', unit: 'unit' },
      LABEL_TYPES: {
        shadow: 'shadow',
        selection: 'selection',
        healthBar: 'healthBar',
        powerBar: 'powerBar',
      },
      HEALTH_BAR_BORDER_COLOR: 0x1f0c09,
      HEALTH_BAR_TRACK_GRADIENT_TOP: 0x9c2e1b,
      HEALTH_BAR_TRACK_GRADIENT_BOTTOM: 0x701d12,
      HEALTH_BAR_FILL_GRADIENT_TOP: 0x52c44f,
      HEALTH_BAR_FILL_GRADIENT_BOTTOM: 0x24822b,
      STEP_TIME: 20,
    },
    '../lib': {
      createIsoSelectionMarker: () => ({ label: 'selection' }),
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

test('unselect keeps played unit and building health bars visible in hero gameplay', () => {
  const { Instance } = loadInstance()
  for (const family of ['unit', 'building']) {
    const instance = Object.create(Instance.prototype)
    const children = [{ label: 'selection' }, { label: 'healthBar' }]
    instance.label = `${family}-1`
    instance.context = { map: {}, controls: { heroUnit: { label: 'hero-1' } } }
    instance.family = family
    instance.owner = { isPlayed: true }
    instance.selected = true
    instance.isDead = false
    instance.isDestroyed = false
    instance.hitPoints = 7
    instance.totalHitPoints = 10
    instance.sprite = { height: 40, anchor: { y: 1 } }
    instance.children = children
    instance.getChildByLabel = label => children.find(child => child.label === label) || null
    instance.removeChild = child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    }
    instance.addChild = child => children.push(child)

    Instance.prototype.unselect.call(instance)

    assert.equal(instance.selected, false)
    assert.equal(children.some(child => child.label === 'selection'), false)
    assert.equal(children.some(child => child.label === 'healthBar'), true)
  }
})

test('unselect removes the active hero world health bar in hero gameplay', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const children = [{ label: 'selection' }, { label: 'healthBar' }]
  instance.label = 'hero-1'
  instance.context = { map: {}, controls: { heroUnit: { label: 'hero-1' } } }
  instance.family = 'unit'
  instance.owner = { isPlayed: true }
  instance.selected = true
  instance.isDead = false
  instance.isDestroyed = false
  instance.children = children
  instance.getChildByLabel = label => children.find(child => child.label === label) || null
  instance.removeChild = child => {
    const index = children.indexOf(child)
    if (index >= 0) children.splice(index, 1)
  }

  Instance.prototype.unselect.call(instance)

  assert.equal(instance.selected, false)
  assert.equal(children.some(child => child.label === 'selection'), false)
  assert.equal(children.some(child => child.label === 'healthBar'), false)
})

test('health bar display eases upward and snaps downward', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const children = []
  instance.family = 'unit'
  instance.owner = { isPlayed: true }
  instance.selected = true
  instance.isDead = false
  instance.isDestroyed = false
  instance.hitPoints = 5
  instance.totalHitPoints = 10
  instance.sprite = { height: 40, anchor: { y: 1 } }
  instance.children = children
  instance.getChildByLabel = label => children.find(child => child.label === label) || null
  instance.removeChild = child => {
    const index = children.indexOf(child)
    if (index >= 0) children.splice(index, 1)
  }
  instance.addChild = child => children.push(child)

  Instance.prototype.drawHealthBar.call(instance)
  assert.equal(instance.displayedHealthBarHitPoints, 5)

  instance.hitPoints = 10
  Instance.prototype.updateHealthBarDisplay.call(instance, 18)
  assert.equal(instance.displayedHealthBarHitPoints, 6)
  assert.equal(children.find(child => child.label === 'healthBar').rects.at(-1).width, 12)

  instance.hitPoints = 3
  Instance.prototype.updateHealthBarDisplay.call(instance, 18)
  assert.equal(instance.displayedHealthBarHitPoints, 3)
  assert.equal(children.find(child => child.label === 'healthBar').rects.at(-1).width, 6)
})
