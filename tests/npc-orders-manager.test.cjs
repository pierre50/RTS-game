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
    dayNight: { state: { hour: 12 } },
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
  const transferPanels = []
  return {
    '../lib': {
      assignVillagerAutonomy: (npc, job) => calls.push(['assignVillagerAutonomy', job, `paused=${context.paused}`]),
      hasVillagerAutonomyTarget: () => true,
      Modal: FakeModal,
    },
    '../lib/lang': { t: key => key },
    '../lib/audio/uiSound': { playUiSound: () => {} },
    '../lib/inventory/inventoryContainers': {
      createInventoryContainer: (target, options) => {
        target.inventory = target.inventory ?? { equipment: [], resources: {} }
        target.inventory.equipment = target.inventory.equipment ?? []
        target.inventory.resources = target.inventory.resources ?? {}
        return { ...options, inventory: target.inventory }
      },
    },
    '../constants': {
      SHEET_TYPES: { standing: 'standing' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../lib/units/unitExperience': {
      getUnitEquipmentLevel: npc => npc.debugLevel ?? 0,
      setUnitDebugLevel: (npc, level) => {
        npc.debugLevel = level
        calls.push(['setUnitDebugLevel', level, `paused=${context.paused}`])
        return level
      },
      XP_MAX_LEVEL: 20,
    },
    '../lib/equipment/equipmentStats': {
      refreshUnitEquipmentStats: npc => calls.push(['refreshUnitEquipmentStats', npc.label]),
    },
    '../lib/lpc': {
      ensureAndRefreshBakedLpcUnitAssets: async npc => {
        calls.push(['ensureAndRefreshBakedLpcUnitAssets', npc.label])
        return true
      },
    },
    '../lib/npc/npcInteraction': {
      sendNpcToStockpile: () => calls.push(['sendNpcToStockpile', `paused=${context.paused}`]),
      keepNpcHere: () => calls.push(['keepNpcHere', `paused=${context.paused}`]),
      startFollowingHero: () => calls.push(['startFollowingHero', `paused=${context.paused}`]),
      releaseIfStillLooking: () => calls.push(['releaseIfStillLooking', `paused=${context.paused}`]),
      playNpcOrderSound: () => {},
      clearNpcCommunicationFocus: () => {},
    },
    '../lib/units/villagerSchedule': {
      isVillagerSleepTime: ctx => {
        const hour = ctx?.dayNight?.state?.hour ?? 12
        return hour >= 18 || hour < 8
      },
      shouldVillagerRestBeforeBed: unit => {
        const hour = unit?.context?.dayNight?.state?.hour ?? 12
        return hour >= 18 && hour < 22
      },
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
    '../lib/npc/npcChatter': {
      pickForeignNpcChatterLine: () => 'foreign hi',
      pickNpcGreetingLine: () => 'hi',
      pickNpcRestingChatterLine: () => 'resting chatter',
      pickNpcSleepingChatterLine: () => 'sleepy chatter',
      pickForeignNpcSleepingChatterLine: () => 'foreign sleepy chatter',
    },
    './inventory/InventoryTransferPanel': {
      InventoryTransferPanel: class InventoryTransferPanel {
        constructor(options) {
          this.options = options
          this.element = global.document.createElement('div')
          this.element.className = 'inventory-transfer-panel'
          transferPanels.push(this)
        }
      },
      __transferPanels: transferPanels,
    },
    './menu/NestedButtonMenu': loadModule('app/ui/menu/NestedButtonMenu.ts', {}),
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
    assert.equal(manager.buttons.get('food').hidden, true)
    manager.buttons.get('resources').click()
    const foodButton = manager.buttons.get('food')
    assert.equal(foodButton.hidden, false)
    assert.equal(foodButton.disabled, false)

    foodButton.click()

    assert.deepEqual(calls, [['assignVillagerAutonomy', 'food', 'paused=false']])
  })
})

test('single commandable NPC exposes a bag transfer panel', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { label: 'hero', inventory: { equipment: ['trap'], resources: { food: 2 } } }
    const mocks = buildMocks(calls, context)
    const menu = { context, updateHeroStatus: () => calls.push(['updateHeroStatus']) }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', mocks)
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Villager',
      label: 'villager-1',
      name: 'Ada',
      owner: context.player,
      inventory: { equipment: ['chest'], resources: { wood: 3 } },
    }

    manager.open([npc])
    const bagButton = manager.buttons.get('bag')
    assert.equal(bagButton.hidden, false)

    bagButton.click()

    const panel = mocks['./inventory/InventoryTransferPanel'].__transferPanels.at(-1)
    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(manager.bagContainer.hidden, false)
    assert.equal(panel.options.destination.id, 'villager-1')
    assert.equal(panel.options.destination.label, 'inventoryNpcBag')
    assert.equal(panel.options.destination.inventory, npc.inventory)
    assert.equal(panel.options.source.id, 'hero')
    assert.equal(panel.options.source.labelKey, 'inventoryYourBag')
    assert.equal(panel.options.source.inventory, context.controls.heroUnit.inventory)
  })
})

test('multi-selection NPC conversations hide the bag button', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { label: 'hero', inventory: { equipment: [], resources: {} } }
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npcA = { type: 'Villager', label: 'villager-1', owner: context.player }
    const npcB = { type: 'Villager', label: 'villager-2', owner: context.player }

    manager.open([npcA, npcB])

    assert.equal(manager.buttons.get('bag').hidden, true)
  })
})

test('copper and iron orders assign distinct autonomous mining jobs', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])
    manager.buttons.get('resources').click()
    manager.buttons.get('copper').click()
    manager.open([npc])
    manager.buttons.get('resources').click()
    manager.buttons.get('iron').click()

    assert.deepEqual(calls, [
      ['assignVillagerAutonomy', 'copper', 'paused=false'],
      ['assignVillagerAutonomy', 'iron', 'paused=false'],
    ])
  })
})

test('picking the horse capture order assigns the horseCapture villager job', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])
    const horseCaptureButton = manager.buttons.get('horseCapture')
    assert.equal(horseCaptureButton.disabled, false)

    horseCaptureButton.click()

    assert.deepEqual(calls, [['assignVillagerAutonomy', 'horseCapture', 'paused=false']])
  })
})

test('sleeping villagers keep movement orders visible and disable night work', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.dayNight.state.hour = 23
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Villager',
      label: 'sleepy-villager',
      owner: context.player,
      shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
      sleepVisualState: 'sleeping',
    }

    manager.open([npc])

    assert.equal(manager.chatterContainer.children[0].textContent, 'sleepy chatter')
    assert.equal(manager.buttons.get('goto').hidden, false)
    assert.equal(manager.buttons.get('follow').hidden, false)
    assert.equal(manager.buttons.get('cancel').hidden, false)
    assert.equal(manager.buttons.get('resources').hidden, false)
    assert.equal(manager.buttons.get('resources').disabled, true)
    assert.equal(manager.buttons.get('food').hidden, true)
    manager.buttons.get('resources').click()
    assert.equal(manager.buttons.get('goto').hidden, false)
    assert.equal(manager.buttons.get('back').hidden, true)
    assert.equal(manager.buttons.get('food').hidden, true)
    assert.equal(manager.buttons.get('food').disabled, true)

    assert.equal(manager.buttons.get('stay').hidden, false)
    manager.buttons.get('follow').click()

    assert.deepEqual(calls, [['startFollowingHero', 'paused=false']])
  })
})

test('night communication disables the resources parent and villager job buttons but keeps go-to and follow usable', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.dayNight.state.hour = 23
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])

    assert.equal(manager.buttons.get('goto').disabled, false)
    assert.equal(manager.buttons.get('follow').disabled, false)
    assert.equal(manager.buttons.get('resources').disabled, true)
    manager.buttons.get('resources').click()
    assert.equal(manager.buttons.get('back').hidden, true)
    assert.equal(manager.buttons.get('food').hidden, true)
    assert.equal(manager.buttons.get('food').disabled, true)
    assert.equal(manager.buttons.get('wood').disabled, true)
    assert.equal(manager.buttons.get('stone').disabled, true)
    assert.equal(manager.buttons.get('gold').disabled, true)
    assert.equal(manager.buttons.get('copper').disabled, true)
    assert.equal(manager.buttons.get('iron').disabled, true)
    assert.equal(manager.buttons.get('construction').disabled, true)
    assert.equal(manager.buttons.get('horseCapture').disabled, true)
  })
})

test('resting-before-bed villagers use rest chatter and block the resources parent', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.dayNight.state.hour = 19
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      context,
      type: 'Villager',
      label: 'resting-villager',
      owner: context.player,
      shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
      sleepVisualState: null,
    }

    manager.open([npc])

    assert.equal(manager.chatterContainer.children[0].textContent, 'resting chatter')
    assert.equal(manager.buttons.get('resources').disabled, true)
    manager.buttons.get('resources').click()
    assert.equal(manager.buttons.get('food').hidden, true)
  })
})

test('resource orders live behind a resources submenu without a visible back button', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'villager-1', owner: context.player }

    manager.open([npc])

    assert.equal(manager.buttons.get('goto').hidden, false)
    assert.equal(manager.buttons.get('resources').hidden, false)
    assert.equal(manager.buttons.get('construction').hidden, false)
    assert.equal(manager.buttons.get('food').hidden, true)
    assert.equal(manager.buttons.get('back').hidden, true)

    manager.buttons.get('resources').click()

    assert.equal(manager.buttons.get('goto').hidden, true)
    assert.equal(manager.buttons.get('construction').hidden, true)
    assert.equal(manager.buttons.get('food').hidden, false)
    assert.equal(manager.buttons.get('wood').hidden, false)
    assert.equal(manager.buttons.get('stone').hidden, false)
    assert.equal(manager.buttons.get('gold').hidden, false)
    assert.equal(manager.buttons.get('copper').hidden, false)
    assert.equal(manager.buttons.get('iron').hidden, false)
    assert.equal(manager.buttons.get('back').hidden, true)
  })
})

test('a foreign sleeping npc gets a distinct "stays asleep" chatter line', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Villager',
      label: 'sleepy-neutral-villager',
      owner: { label: 'neutral-ai' },
      shelterState: { status: 'outside', reason: 'sleep', location: 'outside' },
      sleepVisualState: 'sleeping',
    }

    manager.open([npc])

    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(manager.chatterContainer.children[0].textContent, 'foreign sleepy chatter')
  })
})

test('solo followers disable the follow order', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Villager',
      label: 'villager-1',
      owner: context.player,
      followingHero: true,
    }

    manager.open([npc])
    const followButton = manager.buttons.get('follow')

    assert.equal(followButton.disabled, true)
    followButton.click()
    assert.deepEqual(calls, [])
  })
})

test('solo non-followers disable the stop following order', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = {
      type: 'Villager',
      label: 'villager-1',
      owner: context.player,
      followingHero: false,
    }

    manager.open([npc])
    const stayButton = manager.buttons.get('stay')

    assert.equal(stayButton.disabled, true)
    stayButton.click()
    assert.deepEqual(calls, [])
  })
})

test('mixed follow groups keep follow and stop following orders usable', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const follower = {
      type: 'Villager',
      label: 'follower',
      owner: context.player,
      followingHero: true,
    }
    const idle = {
      type: 'Villager',
      label: 'idle',
      owner: context.player,
      followingHero: false,
    }

    manager.open([follower, idle])

    assert.equal(manager.buttons.get('follow').disabled, false)
    assert.equal(manager.buttons.get('stay').disabled, false)
  })
})

test('all-follower groups disable follow but keep stop following usable', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const first = { type: 'Villager', label: 'follower-1', owner: context.player, followingHero: true }
    const second = { type: 'Villager', label: 'follower-2', owner: context.player, followingHero: true }

    manager.open([first, second])

    assert.equal(manager.buttons.get('follow').disabled, true)
    assert.equal(manager.buttons.get('stay').disabled, false)
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
