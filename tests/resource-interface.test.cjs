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
  const localRequire = request => {
    if (Object.hasOwn(mocks, request)) return mocks[request]
    throw new Error(`Unexpected require: ${request}`)
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
      if (selector !== '.portal-color-option') return []
      return this.children.filter(child => child.classList?.contains('portal-color-option'))
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

test('portal modal renders its description and color actions outside the info block', () => {
  withFakeDocument(() => {
    const recolorCalls = []
    const clickCalls = []
    let capturedContent = null
    const { EntityInfoModalManager } = loadModule('app/ui/EntityInfoModalManager.ts', {
      '../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' } },
      '../lib': {
        changeSpriteColor: (sprite, color) => {
          recolorCalls.push([sprite, color])
          sprite.color = color
        },
      },
      '../lib/avatar': {
        renderAnimalAvatar: () => false,
        renderResourceAvatar: () => false,
        renderUnitHeadAvatar: () => false,
      },
      '../lib/lang': { t: key => key },
      './utils/entityDisplayName': { getEntityDisplayName: entity => entity.type },
      './InspectionPanel': {
        createInspectionModal: options => {
          capturedContent = options.content
          return { close() {} }
        },
      },
    })
    const sprite = {}
    const player = { unselectAll() {} }
    const menu = {
      context: {
        app: {},
        controls: {},
        player,
      },
      playUiClick: () => clickCalls.push('click'),
    }
    const portal = {
      family: 'resource',
      type: 'Portal',
      sprite,
      interface: {
        info: element => {
          const info = makeFakeElement()
          info.className = 'base-info'
          element.appendChild(info)
        },
      },
      select() {},
    }

    new EntityInfoModalManager(menu).open(portal)

    assert.equal(capturedContent.classList.contains('portal-info-modal-content'), true)
    const infoBlock = capturedContent.children[0]
    const colorGroup = capturedContent.children[1]
    const description = infoBlock.children[1]
    assert.equal(infoBlock.classList.contains('selection-info'), true)
    assert.equal(infoBlock.querySelectorAll('.portal-color-option').length, 0)
    assert.equal(description.textContent, 'portalDescriptionMysterious')
    assert.equal(colorGroup.classList.contains('npc-orders-options'), true)
    assert.equal(colorGroup.children.length, 3)
    assert.deepEqual(
      colorGroup.children.map(button => button.textContent),
      ['portalColorBlue', 'portalColorYellow', 'portalColorRed']
    )
    assert.equal(
      colorGroup.children.every(button => button.classList.contains('ui-btn')),
      true
    )

    colorGroup.children[2].click()

    assert.equal(portal.color, 'red')
    assert.deepEqual(recolorCalls, [[sprite, 'red']])
    assert.deepEqual(clickCalls, ['click'])
    assert.equal(colorGroup.children[2].classList.contains('is-selected'), true)
    assert.equal(colorGroup.children[0].classList.contains('is-selected'), false)
  })
})

test('resource info modal title uses translated resource type instead of technical resource name', () => {
  withFakeDocument(() => {
    let capturedTitle = null
    const { EntityInfoModalManager } = loadModule('app/ui/EntityInfoModalManager.ts', {
      '../constants': { FAMILY_TYPES: { building: 'building', unit: 'unit', animal: 'animal', resource: 'resource' } },
      '../lib': { changeSpriteColor: () => {} },
      '../lib/avatar': {
        renderAnimalAvatar: () => false,
        renderResourceAvatar: () => false,
        renderUnitHeadAvatar: () => false,
      },
      '../lib/lang': { t: key => (key === 'Portal' ? 'Portail' : key) },
      './utils/entityDisplayName': {
        getEntityDisplayName: entity => (entity.type === 'Portal' ? 'Portail' : entity.type),
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
    const portal = {
      family: 'resource',
      type: 'Portal',
      name: '4f3b-resource-id',
      interface: { info: () => {} },
      select() {},
    }

    const opened = new EntityInfoModalManager(menu).open(portal)

    assert.equal(opened, true)
    assert.equal(capturedTitle, 'Portail')
  })
})

test('entity info modal syncs live resource health without reopening', () => {
  withFakeDocument(() => {
    const { EntityInfoModalManager } = loadModule('app/ui/EntityInfoModalManager.ts', {
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
