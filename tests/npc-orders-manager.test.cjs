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

function makeFakeElement() {
  const el = {
    classList: {
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
    },
    children: [],
    textContent: '',
    disabled: false,
    hidden: false,
    _listeners: {},
    appendChild(child) {
      this.children.push(child)
      return child
    },
    replaceChildren(...nodes) {
      this.children = nodes
    },
    addEventListener(type, handler) {
      this._listeners[type] = this._listeners[type] || []
      this._listeners[type].push(handler)
    },
    querySelector() {
      return makeFakeElement()
    },
    click() {
      ;(this._listeners.click || []).forEach(handler => handler())
    },
  }
  return el
}

class FakeModal {
  constructor({ title, content, onClose }) {
    this.title = title
    this.content = content
    this.onClose = onClose
    this._panel = makeFakeElement()
  }
  close() {}
}

function makeContext(calls) {
  const context = {
    paused: false,
    app: {},
    player: { name: 'Hero' },
    controls: { beginNpcGoTo: () => {} },
    pause() {
      calls.push(['pause'])
      context.paused = true
    },
    resume() {
      calls.push(['resume'])
      context.paused = false
    },
  }
  return context
}

function buildMocks(calls, context) {
  return {
    '../lib': {
      assignVillagerAutonomy: (npc, job) => calls.push(['assignVillagerAutonomy', job, `paused=${context.paused}`]),
      hasVillagerAutonomyTarget: () => true,
      Modal: FakeModal,
    },
    '../lib/lang': { t: key => key },
    '../lib/uiSound': { playUiSound: () => {} },
    '../constants': {
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../lib/npcInteraction': {
      sendNpcToStockpile: () => calls.push(['sendNpcToStockpile', `paused=${context.paused}`]),
      keepNpcHere: () => calls.push(['keepNpcHere', `paused=${context.paused}`]),
      canKeepNpcHere: () => false,
      startFollowingHero: () => calls.push(['startFollowingHero', `paused=${context.paused}`]),
      releaseIfStillLooking: () => calls.push(['releaseIfStillLooking', `paused=${context.paused}`]),
      playNpcOrderSound: () => {},
      clearNpcCommunicationFocus: () => {},
    },
    './EntityInfoModalManager': { createEntityInfoContent: () => makeFakeElement() },
    '../lib/npcChatter': { pickNpcGreetingLine: () => 'hi' },
  }
}

function withFakeDocument(fn) {
  global.document = { createElement: () => makeFakeElement() }
  try {
    fn()
  } finally {
    delete global.document
  }
}

test('opening the communication panel does not pause the game', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1' }

    manager.open([npc])

    assert.equal(context.paused, false)
    assert.deepEqual(calls, [])
  })
})

test('closing the communication panel without picking an order releases frozen NPCs without touching pause state', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1' }

    manager.open([npc])
    manager.close()

    // The world (units, AI, resources) never stopped ticking, so releaseIfStillLooking() runs
    // with paused=false the whole time — no setTextures() no-op, no stuck sprite.
    assert.deepEqual(calls, [['releaseIfStillLooking', 'paused=false']])
  })
})

test('picking a villager-job order assigns it without pausing or resuming the game', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1' }

    manager.open([npc])
    const foodButton = manager.buttons.get('food')
    assert.equal(foodButton.disabled, false)

    foodButton.click()

    assert.deepEqual(calls, [['assignVillagerAutonomy', 'food', 'paused=false']])
  })
})
