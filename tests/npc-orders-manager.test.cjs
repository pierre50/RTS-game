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
    player: { name: 'Hero', isPlayed: true },
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
      SHEET_TYPES: { standing: 'standing' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../lib/unitExperience': {
      getUnitEquipmentLevel: npc => npc.debugLevel ?? 0,
      setUnitDebugLevel: (npc, level) => {
        npc.debugLevel = level
        calls.push(['setUnitDebugLevel', level, `paused=${context.paused}`])
        return level
      },
      XP_MAX_LEVEL: 20,
    },
    '../lib/equipmentStats': {
      refreshUnitEquipmentStats: npc => calls.push(['refreshUnitEquipmentStats', npc.label]),
    },
    '../lib/lpc': {
      ensureAndRefreshBakedLpcUnitAssets: async npc => {
        calls.push(['ensureAndRefreshBakedLpcUnitAssets', npc.label])
        return true
      },
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
    './EntityInfoModalManager': { createTitledEntityInfoContent: () => makeFakeElement() },
    './InspectionPanel': {
      createInspectionModal: options => new FakeModal(options),
      setInspectionMode: (modal, inspection) => {
        modal.inspection = inspection
      },
      setModalTitle: (modal, title) => {
        modal.title = title
      },
    },
    '../lib/npcChatter': { pickForeignNpcChatterLine: () => 'foreign hi', pickNpcGreetingLine: () => 'hi' },
  }
}

function withFakeDocument(fn) {
  global.document = { createElement: () => makeFakeElement() }
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        delete global.document
      })
    }
    delete global.document
    return result
  } catch (error) {
    delete global.document
    throw error
  }
}

test('opening the communication panel does not pause the game', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])

    assert.equal(context.paused, false)
    assert.deepEqual(calls, [])
  })
})

test('foreign AI units never expose direct order buttons', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'neutral-villager', owner: { label: 'neutral-ai' } }

    manager.open([npc])

    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(manager.chatterContainer.children[0].textContent, 'foreign hi')
  })
})

test('closing the communication panel without picking an order releases frozen NPCs without touching pause state', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

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
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])
    const foodButton = manager.buttons.get('food')
    assert.equal(foodButton.disabled, false)

    foodButton.click()

    assert.deepEqual(calls, [['assignVillagerAutonomy', 'food', 'paused=false']])
  })
})

test('debug level button cycles a solo unit level without closing communication', async () => {
  await withFakeDocument(async () => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context, updateHeroStatus: npc => calls.push(['updateHeroStatus', npc.label]) }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Fantassin',
      label: 'infantry-1',
      interface: { info: () => {} },
      setTextures: sheet => calls.push(['setTextures', sheet]),
    }

    manager.open([npc])
    manager.debugLevelButton.click()
    await Promise.resolve()

    assert.equal(manager.opened, true)
    assert.equal(npc.debugLevel, 1)
    assert.deepEqual(calls, [
      ['setUnitDebugLevel', 1, 'paused=false'],
      ['refreshUnitEquipmentStats', 'infantry-1'],
      ['ensureAndRefreshBakedLpcUnitAssets', 'infantry-1'],
      ['updateHeroStatus', 'infantry-1'],
    ])
  })
})

test('debug level button stops at the max level instead of resetting', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context, updateHeroStatus: npc => calls.push(['updateHeroStatus', npc.label]) }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const npc = {
      type: 'Fantassin',
      label: 'infantry-1',
      debugLevel: 20,
      interface: { info: () => {} },
      setTextures: sheet => calls.push(['setTextures', sheet]),
    }

    const manager = new NpcOrdersManager(menu)
    manager.open([npc])
    manager.debugLevelButton.click()

    assert.equal(manager.debugLevelButton.disabled, true)
    assert.equal(manager.debugLevelButton.textContent, 'Debug niveau max')
    assert.equal(npc.debugLevel, 20)
    assert.deepEqual(calls, [])
  })
})
