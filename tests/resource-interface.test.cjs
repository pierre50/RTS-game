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
    return requireFromTsFile(request, filename, mocks)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function makeFakeClassList() {
  return {
    _set: new Set(),
    add(...names) {
      names.forEach(name => this._set.add(name))
    },
    remove(...names) {
      names.forEach(name => this._set.delete(name))
    },
    toggle(name, force) {
      if (force === undefined) {
        if (this._set.has(name)) this._set.delete(name)
        else this._set.add(name)
      } else if (force) {
        this._set.add(name)
      } else {
        this._set.delete(name)
      }
    },
    contains(name) {
      return this._set.has(name)
    },
  }
}

function makeFakeElement() {
  const el = {
    classList: makeFakeClassList(),
    children: [],
    textContent: '',
    type: '',
    title: '',
    style: {
      values: {},
      setProperty(name, value) {
        this.values[name] = value
      },
    },
    _listeners: {},
    _attributes: {},
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...children) {
      this.children = [...children]
      this.textContent = ''
    },
    addEventListener(type, handler) {
      this._listeners[type] = this._listeners[type] || []
      this._listeners[type].push(handler)
    },
    setAttribute(name, value) {
      this._attributes[name] = value
    },
    querySelectorAll(selector) {
      return this.children.filter(child => child.classList?.contains(selector.replace(/^\./, '')))
    },
    querySelector(selector) {
      if (selector !== '.modal-title') return null
      return this.children.find(child => child.classList?.contains('modal-title')) || null
    },
    click() {
      ;(this._listeners.click || []).forEach(handler => handler())
    },
  }
  Object.defineProperty(el, 'className', {
    get() {
      return [...this.classList._set].join(' ')
    },
    set(value) {
      this.classList._set = new Set(String(value).split(/\s+/).filter(Boolean))
    },
  })
  return el
}

function withFakeDocument(fn) {
  const previousDocument = global.document
  global.document = { createElement: () => makeFakeElement() }
  try {
    fn()
  } finally {
    global.document = previousDocument
  }
}

test('resource info modal title uses translated resource type instead of technical resource name', () => {
  withFakeDocument(() => {
    let capturedTitle = null
    const { EntityInfoModalManager } = loadModule('app/ui/EntityInfoModalManager.ts', {
      './inventory/UnitInventoryScreen': {},
      '../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' } },
      '../lib': { changeSpriteColor: () => {} },
      '../lib/avatar': {
        renderAnimalAvatar: () => false,
        renderResourceAvatar: () => false,
        renderUnitHeadAvatar: () => false,
      },
      '../lib/lang': { t: key => (key === 'Gold' ? 'Or' : key) },
      './utils/entityDisplayName': {
        getEntityDisplayName: entity => (entity.type === 'Gold' ? 'Or' : entity.type),
      },
      './InspectionPanel': {
        createInspectionModal: options => {
          capturedTitle = options.title
          return { close() {} }
        },
      },
    })
    const player = { unselectAll() {} }
    const menu = {
      context: {
        app: {},
        controls: {},
        player,
      },
    }
    const gold = {
      family: 'resource',
      type: 'Gold',
      name: '4f3b-resource-id',
      interface: { info: () => {} },
      select() {},
    }

    const opened = new EntityInfoModalManager(menu).open(gold)

    assert.equal(opened, true)
    assert.equal(capturedTitle, 'Or')
  })
})

test('entity info modal syncs live resource health without reopening', () => {
  withFakeDocument(() => {
    const { EntityInfoModalManager } = loadModule('app/ui/EntityInfoModalManager.ts', {
      './inventory/UnitInventoryScreen': {},
      '../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' } },
      '../lib': { changeSpriteColor: () => {} },
      '../lib/avatar': {
        renderAnimalAvatar: () => false,
        renderResourceAvatar: () => false,
        renderUnitHeadAvatar: () => false,
      },
      '../lib/lang': { t: key => key },
      './utils/entityDisplayName': {
        getEntityDisplayName: entity => entity.type,
      },
      './InspectionPanel': {
        createInspectionModal: () => ({ close() {} }),
      },
    })
    const player = { unselectAll() {} }
    const menu = {
      context: {
        app: {},
        controls: {},
        player,
      },
    }
    const resource = {
      family: 'resource',
      type: 'Tree',
      hitPoints: 5,
      totalHitPoints: 10,
      interface: {
        info: element => {
          const hp = makeFakeElement()
          hp.className = 'hit-points'
          hp.textContent = `${resource.hitPoints}/${resource.totalHitPoints}`
          element.appendChild(hp)
        },
      },
      select() {},
    }
    const manager = new EntityInfoModalManager(menu)

    assert.equal(manager.open(resource), true)
    assert.equal(manager.infoPanel.children[0].textContent, '5/10')

    resource.hitPoints = 3
    manager.syncLiveState()

    assert.equal(manager.infoPanel.children[0].textContent, '3/10')
  })
})
