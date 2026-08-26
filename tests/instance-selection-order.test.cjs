const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

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
        commSelection: 'commSelection',
        healthBar: 'healthBar',
        energyBar: 'energyBar',
        powerBar: 'powerBar',
      },
      HEALTH_BAR_BORDER_COLOR: 0x1f0c09,
      HEALTH_BAR_TRACK_GRADIENT_TOP: 0x9c2e1b,
      HEALTH_BAR_TRACK_GRADIENT_BOTTOM: 0x701d12,
      HEALTH_BAR_FILL_GRADIENT_TOP: 0x52c44f,
      HEALTH_BAR_FILL_GRADIENT_BOTTOM: 0x24822b,
      ENERGY_BAR_BORDER_COLOR: 0x0b1620,
      ENERGY_BAR_TRACK_GRADIENT_TOP: 0x1f3b57,
      ENERGY_BAR_TRACK_GRADIENT_BOTTOM: 0x102033,
      ENERGY_BAR_FILL_GRADIENT_TOP: 0x61b5ff,
      ENERGY_BAR_FILL_GRADIENT_BOTTOM: 0x2675cf,
      STEP_TIME: 20,
    },
    '../lib': {
      createIsoSelectionMarker: () => ({ label: 'selection', position: { y: 0 } }),
      getActionCondition: () => false,
      getSelectionMarkerOffset: () => ({ x: 0, y: 0 }),
      setUnitTexture: () => {},
      uuidv4: () => 'instance-1',
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
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

test('selection marker tracks visual relief lift', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const children = []
  instance.selected = false
  instance.size = 1
  instance.reliefLift = -24
  instance.children = children
  instance.addChildAt = (child, index) => {
    children.splice(index, 0, child)
  }
  instance.drawHealthBar = () => {}
  instance.getChildByLabel = label => children.find(child => child.label === label) || null

  Instance.prototype.select.call(instance)

  const selection = instance.getChildByLabel('selection')
  assert.equal(selection.position.y, -24)

  instance.reliefLift = -12
  Instance.prototype.syncSelectionMarkersToRelief.call(instance)

  assert.equal(selection.position.y, -12)
})

test('unselect keeps played unit health bars visible in hero gameplay', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const children = [{ label: 'selection' }, { label: 'healthBar' }]
  instance.label = 'unit-1'
  instance.context = { map: {}, controls: { heroUnit: { label: 'hero-1' } } }
  instance.family = 'unit'
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
})

test('buildings do not keep world health bars visible in hero gameplay', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  const children = [{ label: 'selection' }, { label: 'healthBar' }]
  instance.label = 'building-1'
  instance.context = { map: {}, controls: { heroUnit: { label: 'hero-1' } } }
  instance.family = 'building'
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

test('hero player units keep world health bars visible', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  instance.label = 'hero-player-unit-1'
  instance.context = {
    map: {},
    controls: { heroUnit: { label: 'hero-1', owner: { label: 'player-1' } } },
    player: { label: 'player-1', team: 2 },
  }
  instance.family = 'unit'
  instance.owner = { label: 'player-1', team: 2 }
  instance.isDead = false
  instance.isDestroyed = false

  assert.equal(Instance.prototype.shouldKeepHealthBarVisible.call(instance), true)
})

test('same-team AI units do not keep world health bars visible', () => {
  const { Instance } = loadInstance()
  const instance = Object.create(Instance.prototype)
  instance.label = 'ai-ally-1'
  instance.context = {
    map: {},
    controls: { heroUnit: { label: 'hero-1', owner: { label: 'player-1' } } },
    player: { label: 'player-1', team: 2 },
  }
  instance.family = 'unit'
  instance.owner = { label: 'ai-ally-player', team: 2 }
  instance.isDead = false
  instance.isDestroyed = false

  assert.equal(Instance.prototype.shouldKeepHealthBarVisible.call(instance), false)
})

test('selected hero player units do not draw energy bars', () => {
  const { Instance } = loadInstance()
  const children = []
  const instance = Object.create(Instance.prototype)
  instance.label = 'hero-player-unit-1'
  instance.context = {
    map: {},
    controls: { heroUnit: { label: 'hero-1', owner: { label: 'player-1' } } },
    player: { label: 'player-1' },
  }
  instance.family = 'unit'
  instance.owner = { label: 'player-1', isPlayed: true }
  instance.selected = true
  instance.isDead = false
  instance.isDestroyed = false
  instance.energy = 7
  instance.totalEnergy = 10
  instance.sprite = { height: 40, anchor: { y: 1 } }
  instance.children = children
  instance.getChildByLabel = label => children.find(child => child.label === label) || null
  instance.removeChild = child => {
    const index = children.indexOf(child)
    if (index >= 0) children.splice(index, 1)
  }
  instance.addChild = child => children.push(child)

  Instance.prototype.drawEnergyBar.call(instance)

  assert.equal(children.some(child => child.label === 'energyBar'), false)
})

test('hero units never draw energy bars', () => {
  const { Instance } = loadInstance()
  const children = []
  const instance = Object.create(Instance.prototype)
  instance.label = 'hero-1'
  instance.context = {
    map: {},
    controls: { heroUnit: { label: 'hero-1', owner: { label: 'player-1' } } },
  }
  instance.family = 'unit'
  instance.owner = { label: 'player-1', isPlayed: true }
  instance.selected = true
  instance.isDead = false
  instance.isDestroyed = false
  instance.energy = 7
  instance.totalEnergy = 10
  instance.sprite = { height: 40, anchor: { y: 1 } }
  instance.children = children
  instance.getChildByLabel = label => children.find(child => child.label === label) || null
  instance.removeChild = child => {
    const index = children.indexOf(child)
    if (index >= 0) children.splice(index, 1)
  }
  instance.addChild = child => children.push(child)

  Instance.prototype.drawEnergyBar.call(instance)

  assert.equal(children.some(child => child.label === 'energyBar'), false)
})

test('world hud bars fade in when they appear', () => {
  const { Instance } = loadInstance()
  const children = []
  const tasks = new Map()
  const instance = Object.create(Instance.prototype)
  Object.assign(instance, {
    label: 'unit-1',
    context: {
      map: {},
      controls: { heroUnit: { label: 'hero-1' } },
      scheduler: {
        add(callback, _interval, name) {
          const id = tasks.size + 1
          tasks.set(id, { callback, name })
          return id
        },
        remove(id) {
          tasks.delete(id)
        },
      },
    },
    family: 'unit',
    owner: { isPlayed: true },
    selected: true,
    isDead: false,
    isDestroyed: false,
    hitPoints: 7,
    totalHitPoints: 10,
    sprite: { height: 40, anchor: { y: 1 } },
    children,
    getChildByLabel: label => children.find(child => child.label === label) || null,
    addChild: child => {
      children.push(child)
    },
    removeChild: child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  })

  Instance.prototype.drawHealthBar.call(instance)

  const bar = instance.getChildByLabel('healthBar')
  assert.equal(bar.alpha, 0)
  assert.equal(tasks.size, 1)

  tasks.get(1).callback()
  assert.ok(bar.alpha > 0 && bar.alpha < 1)

  for (let i = 0; i < 8; i += 1) tasks.get(1)?.callback()

  assert.equal(bar.alpha, 1)
  assert.equal(tasks.size, 0)
})

test('world hud bars keep fading in across redraws', () => {
  const { Instance } = loadInstance()
  const children = []
  const tasks = new Map()
  const instance = Object.create(Instance.prototype)
  Object.assign(instance, {
    label: 'unit-1',
    context: {
      map: {},
      controls: { heroUnit: { label: 'hero-1' } },
      scheduler: {
        add(callback, _interval, name) {
          const id = tasks.size + 1
          tasks.set(id, { callback, name })
          return id
        },
        remove(id) {
          tasks.delete(id)
        },
      },
    },
    family: 'unit',
    owner: { isPlayed: true },
    selected: true,
    isDead: false,
    isDestroyed: false,
    hitPoints: 7,
    totalHitPoints: 10,
    sprite: { height: 40, anchor: { y: 1 } },
    children,
    getChildByLabel: label => children.find(child => child.label === label) || null,
    addChild: child => {
      children.push(child)
    },
    removeChild: child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  })

  Instance.prototype.drawHealthBar.call(instance)
  const firstBar = instance.getChildByLabel('healthBar')

  Instance.prototype.drawHealthBar.call(instance)
  const redrawnBar = instance.getChildByLabel('healthBar')

  assert.notEqual(redrawnBar, firstBar)
  assert.equal(children.includes(firstBar), false)
  assert.equal(redrawnBar.alpha, 0)
  assert.equal(tasks.size, 1)

  tasks.get(1).callback()

  assert.ok(redrawnBar.alpha > 0 && redrawnBar.alpha < 1)
})

test('world hud bars fade out before removal', () => {
  const { Instance } = loadInstance()
  const children = [{ label: 'healthBar', alpha: 1 }]
  const tasks = new Map()
  const instance = Object.create(Instance.prototype)
  Object.assign(instance, {
    context: {
      scheduler: {
        add(callback, _interval, name) {
          const id = tasks.size + 1
          tasks.set(id, { callback, name })
          return id
        },
        remove(id) {
          tasks.delete(id)
        },
      },
    },
    children,
    getChildByLabel: label => children.find(child => child.label === label) || null,
    removeChild: child => {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  })

  Instance.prototype.removeHealthBar.call(instance)

  const bar = children[0]
  assert.equal(children.includes(bar), true)
  assert.equal(tasks.size, 1)

  tasks.get(1).callback()
  assert.ok(bar.alpha > 0 && bar.alpha < 1)

  for (let i = 0; i < 8; i += 1) tasks.get(1)?.callback()

  assert.equal(children.includes(bar), false)
  assert.equal(tasks.size, 0)
})

test('pause and resume ignore static sprites but control animated sprites', () => {
  const { Instance } = loadInstance()
  const staticInstance = Object.create(Instance.prototype)
  staticInstance.sprite = { texture: {} }

  assert.doesNotThrow(() => Instance.prototype.pause.call(staticInstance))
  assert.doesNotThrow(() => Instance.prototype.resume.call(staticInstance))

  const calls = []
  const animatedInstance = Object.create(Instance.prototype)
  animatedInstance.sprite = {
    stop: () => calls.push('stop'),
    play: () => calls.push('play'),
  }

  Instance.prototype.pause.call(animatedInstance)
  Instance.prototype.resume.call(animatedInstance)

  assert.deepEqual(calls, ['stop', 'play'])
})
