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
    dataset: {},
    textContent: '',
    disabled: false,
    hidden: false,
    _listeners: {},
    setAttribute(name, value) {
      this[name] = value
    },
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
  constructor({ title, content, onClose, proximity }) {
    this.title = title
    this.proximity = proximity
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
    player: {
      age: 2,
      name: 'Hero',
      isPlayed: true,
      config: {
        units: {
          Fantassin: { cost: { food: 50, wood: 15 }, trainingDays: 2 },
          Bowman: { cost: { food: 40, wood: 25 }, trainingDays: 1 },
        },
      },
    },
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
    '../lib/audio/settings': { getVolume: () => 1 },
    '../lib/audio/uiSound': { playUiSound: () => {} },
    '../lib/inventory/inventoryContainers': {
      createInventoryContainer: (target, options) => {
        target.inventory = target.inventory ?? { equipment: [], resources: {} }
        target.inventory.equipment = target.inventory.equipment ?? []
        target.inventory.resources = target.inventory.resources ?? {}
        return { ...options, inventory: target.inventory }
      },
    },
    '../lib/training/unitTrainingCost': {
      getUnitTrainingCost: (owner, type) => owner?.config?.units?.[type]?.cost ?? {},
    },
    '../lib/training/unitTrainingDuration': {
      formatUnitTrainingDuration: days => (days === 1 ? '1 day' : `${days} days`),
      getUnitTrainingDurationDays: unitConfig => unitConfig?.trainingDays ?? unitConfig?.trainingTime ?? 1,
    },
    './ActionDetailsFactory': {
      formatActionCost: cost =>
        Object.entries(cost || {})
          .map(([resource, amount]) => `${amount} ${resource}`)
          .join(', '),
    },
    '../constants': {
      SHEET_TYPES: { standing: 'standing' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
      UNIT_TYPES: { villager: 'Villager' },
    },
    '../lib/units/unitExperience': {
      getUnitEquipmentLevel: npc => npc.debugLevel ?? 1,
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
    '../lib/resources/ironMining': {
      canMineIronResource: (unit, target) =>
        target.type !== 'iron' || (unit.owner?.age ?? 0) >= 1 || unit.inventory?.equipment?.includes('pickaxe_bronze'),
    },
    '../lib/lpc': {
      ensureAndRefreshBakedLpcUnitAssets: async npc => {
        calls.push(['ensureAndRefreshBakedLpcUnitAssets', npc.label])
        return true
      },
    },
    '../lib/npc/npcInteraction': {
      noticeNpc: npc => {
        npc.lookingAtHero = true
      },
      sendNpcToStockpile: () => calls.push(['sendNpcToStockpile', `paused=${context.paused}`]),
      keepNpcHere: () => calls.push(['keepNpcHere', `paused=${context.paused}`]),
      startFollowingHero: () => calls.push(['startFollowingHero', `paused=${context.paused}`]),
      releaseIfStillLooking: () => calls.push(['releaseIfStillLooking', `paused=${context.paused}`]),
      playNpcOrderSound: () => {},
    },
    '../lib/units/village/villagerSchedule': {
      isVillagerSleepTime: ctx => {
        const hour = ctx?.dayNight?.state?.hour ?? 12
        return hour >= 18 || hour < 8
      },
      shouldVillagerRestBeforeBed: unit => {
        const hour = unit?.context?.dayNight?.state?.hour ?? 12
        return hour >= 18 && hour < 22
      },
    },
    './NpcGroupSummary': {
      createNpcGroupSummary: (_app, npcs) => {
        const summary = makeFakeElement()
        summary.className = 'npc-group-summary'
        summary.npcs = npcs
        return summary
      },
    },
    './inspection/EntityInfoContent': { createTitledEntityInfoContent: () => makeFakeElement() },
    './inspection/InspectionPanel': {
      createInspectionModal: options => {
        const modal = new FakeModal(options)
        if (options.panelClass) modal._panel.classList.add(options.panelClass)
        if (options.inspection ?? true) modal._panel.classList.add('inspection-panel')
        return modal
      },
      setInspectionMode: (modal, inspection) => {
        modal.inspection = inspection
        modal._panel.classList.toggle('inspection-panel', inspection)
      },
      setModalTitle: (modal, title) => {
        modal.title = title
      },
    },
    '../lib/npc/npcChatter': {
      pickNpcRescueThanksLine: npcs => (npcs.length > 1 ? 'thanks from everyone' : 'thanks for saving me'),
    },
    '../lib/npc/npcRoutineChatter': {
      pickNpcRoutineChatterLine: (unit, _hero, options) => {
        if (options.sleeping) return unit.owner?.isPlayed ? 'sleepy chatter' : 'foreign sleepy chatter'
        if (!unit.owner?.isPlayed) return 'foreign hi'
        return unit.shelterState?.reason === 'sleep' ? 'resting chatter' : 'hi'
      },
    },
    './inventory/UnitInventoryScreen': {
      UnitInventoryScreen: class {
        constructor(menu, unit) {
          this.menu = menu
          this.unit = unit
          this.element = makeFakeElement()
          this.element.appendChild(makeFakeElement())
          transferPanels.push(this)
        }
        render() {}
        open(onClose) {
          return new FakeModal({ title: this.unit.name, content: this.element, onClose })
        }
      },
      __screens: transferPanels,
    },
    './menu/NestedButtonMenu': loadModule('app/ui/menu/NestedButtonMenu.ts', {}),
  }
}

function withFakeDocument(fn) {
  const previousAudio = global.Audio
  const previousTimeout = global.window?.setTimeout
  global.Audio = class {
    play() {
      return Promise.resolve()
    }
    pause() {}
  }
  global.window = global.window || {}
  global.window.setTimeout = callback => {
    callback()
    return 1
  }
  const restore = () => {
    global.Audio = previousAudio
    global.window.setTimeout = previousTimeout
    delete global.document
  }
  global.document = { createElement: () => makeFakeElement(), createTextNode: text => ({ textContent: text }) }
  try {
    const result = fn()
    if (result && typeof result.then === 'function') {
      return result.finally(() => {
        restore()
      })
    }
    restore()
    return result
  } catch (error) {
    restore()
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

test('newly rescued villagers thank the hero once, including group communication', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager({ context })
    const first = { type: 'Villager', label: 'rescued-1', owner: context.player, pendingRescueThanks: true }
    manager.open([first])
    assert.equal(manager.chatterContainer.children[0].textContent, 'thanks for saving me')
    assert.equal(first.pendingRescueThanks, false)
    manager.open([first])
    assert.equal(manager.chatterContainer.children[0].textContent, 'hi')
    const group = [2, 3].map(index => ({ ...first, label: `rescued-${index}`, pendingRescueThanks: true }))
    manager.open([first, ...group])
    assert.equal(manager.chatterContainer.children[0].textContent, 'thanks from everyone')
    assert.ok(group.every(npc => npc.pendingRescueThanks === false))
    manager.open([group[0]])
    assert.equal(manager.chatterContainer.children[0].textContent, 'hi')
  })
})

test('rescue thanks are localized and use the saved appearance gender', () => {
  for (const [language, expected] of [
    ['fr', "Merci de m'avoir sauvée ! Je suis avec vous, maintenant."],
    ['en', 'Thank you for saving me! I am with you now.'],
  ]) {
    const { pickNpcRescueThanksLine } = loadModule('app/lib/npc/npcChatter.ts', {
      '../lang': { getLang: () => language },
      '../random': { pickRandomItem: values => values[0] },
    })
    assert.equal(pickNpcRescueThanksLine([{ appearanceVariants: { gender: 'female' } }]), expected)
  }
})

test('foreign AI units never expose direct order buttons', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { owner: context.player }
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npc = { type: 'Villager', label: 'neutral-villager', owner: { label: 'neutral-ai' } }

    manager.open([npc])

    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(npc.lookingAtHero, true)
    assert.equal(manager.chatterContainer.children[0].textContent, 'foreign hi')
  })
})

test('charged group conversations widen their proximity range until a direct reopen', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager({ context })
    const npcs = [
      { type: 'Villager', label: 'villager-1', owner: context.player },
      { type: 'Villager', label: 'villager-2', owner: context.player },
    ]

    manager.open(npcs, { commRadius: 5 })
    assert.equal(manager.modal.proximity.openingRadius(), 5)
    manager.open([npcs[0]])
    assert.equal(manager.modal.proximity.openingRadius(), undefined)
    manager.open(npcs, { commRadius: 5 })
    manager.close()
    manager.open([npcs[0]])
    assert.equal(manager.modal.proximity.openingRadius(), undefined)
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

    const screen = mocks['./inventory/UnitInventoryScreen'].__screens.at(-1)
    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(manager.bagScreen, screen)
    assert.equal(screen.unit, npc)
    assert.equal(screen.menu, menu)
    assert.equal(manager.bagModal.content, screen.element)
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
    assert.equal(manager.infoContainer.children[0].className, 'npc-group-summary')
    assert.deepEqual(manager.infoContainer.children[0].npcs, [npcA, npcB])
    manager.open([npcA])
    assert.equal(manager.infoContainer.children.length, 0)
  })
})

test('multi-selection NPC conversations use the same inspection panel placement as direct conversations', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const npcA = { type: 'Villager', label: 'villager-1', owner: context.player }
    const npcB = { type: 'Villager', label: 'villager-2', owner: context.player }

    manager.open([npcA, npcB])

    assert.equal(manager.modal._panel.classList.contains('npc-orders-panel'), true)
    assert.equal(manager.modal._panel.classList.contains('inspection-panel'), true)
  })
})

test('sleeping villagers keep movement orders visible and hide night work', () => {
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
    assert.equal(manager.exitButton.hidden, false)
    assert.equal(manager.buttons.has('resources'), false)
    assert.equal(manager.buttons.has('food'), false)
    assert.equal(manager.buttons.get('goto').hidden, false)
    assert.equal(manager.buttons.get('back').hidden, true)
    assert.equal(manager.buttons.has('food'), false)

    assert.equal(manager.buttons.get('stay').hidden, true)
    manager.buttons.get('follow').click()

    assert.deepEqual(calls, [['startFollowingHero', 'paused=false']])
  })
})

test('night communication hides work buttons but keeps go-to and follow usable', () => {
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
    assert.equal(manager.buttons.has('resources'), false)
    assert.equal(manager.buttons.get('back').hidden, true)
    assert.equal(manager.buttons.has('food'), false)
    assert.equal(manager.buttons.has('wood'), false)
    assert.equal(manager.buttons.has('stone'), false)
    assert.equal(manager.buttons.has('gold'), false)
    assert.equal(manager.buttons.has('copper'), false)
    assert.equal(manager.buttons.has('iron'), false)
    assert.equal(manager.buttons.has('construction'), false)
    assert.equal(manager.buttons.has('horseCapture'), false)
  })
})

test('resting-before-bed villagers use rest chatter and hide the resources parent', () => {
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
    assert.equal(manager.buttons.has('resources'), false)
    assert.equal(manager.buttons.has('food'), false)
  })
})

test('communication no longer exposes training or mounting orders', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager({ context })
    manager.open([{ type: 'Villager', label: 'villager-1', owner: context.player }])
    for (const id of ['training', 'train-Fantassin', 'train-Priest', 'mountHorse'])
      assert.equal(manager.buttons.has(id), false)
    assert.equal(manager.buttons.has('follow'), true)
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

test('solo followers hide the follow order', () => {
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

    assert.equal(followButton.hidden, true)
    followButton.click()
    assert.deepEqual(calls, [])
  })
})

test('solo non-followers hide the stop following order', () => {
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

    assert.equal(stayButton.hidden, true)
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

    assert.equal(manager.buttons.get('follow').hidden, false)
    assert.equal(manager.buttons.get('stay').hidden, false)
  })
})

test('all-follower groups hide follow but keep stop following usable', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    const menu = { context }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const manager = new NpcOrdersManager(menu)
    const first = { type: 'Villager', label: 'follower-1', owner: context.player, followingHero: true }
    const second = { type: 'Villager', label: 'follower-2', owner: context.player, followingHero: true }

    manager.open([first, second])

    assert.equal(manager.buttons.get('follow').hidden, true)
    assert.equal(manager.buttons.get('stay').hidden, false)
  })
})

test('debug level button cycles a solo unit level without closing communication', async () => {
  await withFakeDocument(async () => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { isChief: true }
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
    await new Promise(resolve => setImmediate(resolve))

    assert.equal(manager.opened, true)
    assert.equal(npc.debugLevel, 2)
    assert.deepEqual(calls, [
      ['setUnitDebugLevel', 2, 'paused=false'],
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
    context.controls.heroUnit = { isChief: true }
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

test('neutral chief quest choices remain visible when the hero cannot issue orders', () => {
  withFakeDocument(() => {
    const context = makeContext([])
    const closed = []
    context.neutralQuests = {
      system: { definitions: new Map() },
      dialogueClosed: npc => closed.push(npc),
      dialogue: () => ({
        id: 'quest',
        status: 'available',
        parameters: { resource: 'wood', quantity: 10 },
        owner: { name: 'Chief' },
      }),
    }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks([], context))
    const manager = new NpcOrdersManager({ context })
    const npc = { type: 'Chief', label: 'chief', owner: { label: 'neutral-ai' } }
    manager.open([npc], { ordersEnabled: false, chatterLine: 'ordinary greeting' })
    assert.equal(manager.buttonsContainer.hidden, true)
    assert.equal(manager.questPanel.root.hidden, false)
    assert.equal(manager.questPanel.root.children.length, 1)
    assert.equal(manager.chatterContainer.children[0].textContent, 'npcTopicsPrompt')
    manager.close()
    assert.equal(manager.questPanel.root.hidden, true)
    assert.deepEqual(closed, [npc])
    manager.close()
    assert.equal(closed.length, 1)
  })
})

test('every conversation keeps a working exit outside conditional menus', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { label: 'hero', inventory: { equipment: [], resources: {} } }
    const mocks = buildMocks(calls, context)
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', mocks)
    const manager = new NpcOrdersManager({ context })
    const own = { type: 'Villager', label: 'own', owner: context.player }
    const foreign = { ...own, label: 'foreign', owner: {} }
    const scenarios = [
      { npcs: [own] },
      { npcs: [own, { ...own, label: 'second' }] },
      { npcs: [foreign] },
      { npcs: [own], options: { ordersEnabled: false } },
      { npcs: [{ ...foreign, shelterState: { reason: 'sleep' }, sleepVisualState: 'sleeping' }] },
      { npcs: [own], submenu: 'bag' },
    ]
    for (const scenario of scenarios) {
      manager.open(scenario.npcs, scenario.options)
      if (scenario.submenu) manager.buttons.get(scenario.submenu).click()
      assert.equal(manager.choicesContainer.children.at(-1), manager.exitButton)
      assert.equal(manager.exitButton.hidden, false)
      assert.equal(manager.exitButton.disabled, false)
      const before = calls.length
      manager.exitButton.click()
      assert.equal(manager.isOpen(), false)
      assert.equal(manager.modal, undefined)
      assert.deepEqual(calls.slice(before), [['releaseIfStillLooking', 'paused=false']])
    }
  })
})

test('scripted introduction requires its reply and cannot be replaced or dismissed by normal controls', () => {
  withFakeDocument(() => {
    const context = makeContext([])
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks([], context))
    const manager = new NpcOrdersManager({ context })
    const npc = { type: 'Villager', label: 'companion', owner: context.player }
    let answered = 0
    manager.open([npc], {
      ordersEnabled: false,
      chatterLine: 'Welcome',
      scriptedReply: {
        label: 'Ready',
        onSelect() {
          answered++
          manager.close()
        },
      },
    })
    assert.equal(manager.modal._panel.classList.contains('npc-orders-panel'), true)
    assert.equal(manager.modal._panel.classList.contains('inspection-panel'), true)
    manager.close()
    assert.equal(manager.opened, true)
    manager.open([npc], { chatterLine: 'Other' })
    assert.equal(manager.chatterContainer.children[0].textContent, 'Welcome')
    manager.scriptedReplyPanel.children[0].click()
    assert.equal(answered, 1)
    assert.equal(manager.opened, false)
  })
})

test('all introduction steps hide and block unrelated NPC actions until the final reply', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { label: 'hero' }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
    const { createCampIntroductionDialogue } = loadModule('app/services/introduction/CampIntroductionDialogue.ts', {
      '../../lib/lang': { t: key => key },
    })
    const manager = new NpcOrdersManager({ context })
    const npc = { type: 'Villager', label: 'companion', owner: context.player }
    let completed = 0
    manager.open([npc], {
      dialogue: createCampIntroductionDialogue({
        onNodeChanged() {},
        onComplete() {
          completed++
          manager.close()
        },
      }),
    })
    for (let step = 0; step < 7; step++) {
      manager.syncQuest()
      assert.equal(manager.buttonsContainer.hidden, true)
      assert.equal(manager.questPanel.root.hidden, true)
      assert.equal(manager.debugContainer.hidden, true)
      assert.equal(manager.exitButton.hidden, true)
      assert.equal(manager.scriptedReplyPanel.hidden, false)
      assert.equal(manager.scriptedReplyPanel.children.length, 1)
      assert.equal(manager.scriptedReplyPanel.children[0].dataset.windowLabel, 'windowReply')
      const before = calls.length
      for (const id of ['follow', 'stay', 'goto', 'bag']) manager.buttons.get(id).click()
      assert.equal(calls.length, before)
      assert.equal(manager.bagModal, undefined)
      assert.equal(manager.opened, true)
      manager.scriptedReplyPanel.children[0].click()
    }
    assert.equal(completed, 1)
    assert.equal(manager.opened, false)
    manager.open([npc])
    assert.equal(manager.buttonsContainer.hidden, false)
    assert.equal(manager.scriptedReplyPanel.hidden, true)
    assert.equal(manager.exitButton.hidden, false)
  })
})

test('closing the bag ends communication and releases the NPC exactly once', () => {
  withFakeDocument(() => {
    for (const closeWithKeyboard of [false, true]) {
      const calls = []
      const context = makeContext(calls)
      context.controls.heroUnit = { label: 'hero', inventory: { equipment: [], resources: {} } }
      const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
      const manager = new NpcOrdersManager({ context })
      const npc = { type: 'Villager', label: 'villager', owner: context.player }
      manager.open([npc])
      manager.modal._backdrop = { hidden: false }
      manager.buttons.get('bag').click()
      const bag = manager.bagModal
      assert.equal(manager.modal._backdrop.hidden, true)
      assert.equal(bag.content.children.length, 1)
      if (closeWithKeyboard) manager.close()
      else bag.onClose()
      assert.equal(manager.bagModal, undefined)
      assert.equal(manager.modal, undefined)
      assert.equal(manager.isOpen(), false)
      assert.deepEqual(manager.getTarget(), [])
      manager.close()
      assert.deepEqual(calls, [['releaseIfStillLooking', 'paused=false']])
    }
  })
})

for (const [hour, status, mealBreak] of [
  [6, 'outside', false],
  [6, 'inside', false],
  [6, 'wakingUp', false],
  [12, 'outside', true],
  [19, 'outside', false],
]) {
  test(`an awake resting villager shows quest choices at ${hour}:00 (${status})`, () => {
    withFakeDocument(() => {
      const context = makeContext([])
      context.dayNight = { state: { hour, minute: 0 } }
      const npc = {
        type: 'Villager',
        label: 'villager',
        owner: { label: 'neutral-ai' },
        context,
        dailySchedule: { wakeMinute: 350, workStartMinute: 410, bedMinute: 1320, workEndMinute: 1080 },
        shelterState: { reason: 'sleep', status, mealBreak },
        sleepVisualState: null,
      }
      const quest = { id: 'quest', status: 'available', parameters: {}, owner: { name: 'Villager' } }
      context.neutralQuests = { getQuest: () => quest, system: { definitions: new Map() }, dialogue: () => quest }
      const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks([], context))
      const manager = new NpcOrdersManager({ context })
      manager.open([npc], { ordersEnabled: false, chatterLine: 'rest greeting' })
      assert.equal(manager.questPanel.root.hidden, false)
      assert.equal(manager.chatterContainer.children[0].textContent, 'npcTopicsPrompt')
      manager.close()
    })
  })
}

test('AI chief refuses night conversations and ends an audience at bedtime', () => {
  withFakeDocument(() => {
    const context = makeContext([])
    context.dayNight = { state: { hour: 22, minute: 0 } }
    const npc = { context, type: 'Chief', isChief: true, label: 'chief', owner: { type: 'AI', label: 'neutral-ai' },
      dailySchedule: { wakeMinute: 360, workStartMinute: 420, bedMinute: 1320, workEndMinute: 1080, lunchStartMinute: 720, lunchEndMinute: 780 } }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks([], context))
    const manager = new NpcOrdersManager({ context })
    manager.open([npc], { ordersEnabled: false })
    assert.equal(manager.opened, false)
    context.dayNight.state.hour = 7
    npc.sleepVisualState = 'waking'
    manager.open([npc], { ordersEnabled: false })
    assert.equal(manager.opened, false)
    npc.sleepVisualState = null
    manager.open([npc], { ordersEnabled: false })
    assert.equal(manager.opened, true)
    context.dayNight.state.hour = 22
    manager.syncQuest()
    assert.equal(manager.opened, false)
    assert.deepEqual(manager.npcs, [])
  })
})

for (const branch of ['polite', 'rebel']) {
  test(`scripted dialogue branches to ${branch} without reopening or accepting stale choices`, () => {
    withFakeDocument(() => {
      const context = makeContext([])
      const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks([], context))
      const manager = new NpcOrdersManager({ context })
      const npc = { type: 'Chief', label: 'chief', owner: context.player }
      const visited = []
      let completed = 0
      manager.open([npc], {
        ordersEnabled: false,
        dialogue: {
          startId: 'wake',
          nodes: [
            {
              id: 'wake',
              line: 'Wake up!',
              choices: [
                { id: 'polite', label: 'Good morning', nextId: 'polite' },
                { id: 'rebel', label: 'Let me sleep', nextId: 'rebel' },
              ],
            },
            { id: 'polite', line: 'Please gather wood.', choices: [{ id: 'accept', label: 'All right' }] },
            { id: 'rebel', line: 'Get to work!', choices: [{ id: 'accept', label: 'Fine' }] },
          ],
          onNodeChanged: id => visited.push(id),
          onComplete() {
            completed++
            manager.close()
          },
        },
      })
      const modal = manager.modal
      manager.questPanel.update = () => assert.fail('Quest refresh must not replace a scripted dialogue')
      manager.syncQuest()
      const oldButtons = [...manager.scriptedReplyPanel.children]
      oldButtons[branch === 'polite' ? 0 : 1].click()
      assert.equal(manager.modal, modal)
      assert.equal(
        manager.chatterContainer.children[0].textContent,
        branch === 'polite' ? 'Please gather wood.' : 'Get to work!'
      )
      assert.deepEqual(visited, [branch])
      assert.equal(completed, 0)
      oldButtons[0].click()
      oldButtons[1].click()
      assert.deepEqual(visited, [branch])
      manager.close()
      assert.equal(manager.opened, true)
      const accept = manager.scriptedReplyPanel.children[0]
      accept.click()
      accept.click()
      assert.equal(completed, 1)
      assert.equal(manager.opened, false)
    })
  })
}

test('the panel selects real morning, evening and job chatter independently of order visibility', () => {
  withFakeDocument(() => {
    const routine = loadModule('app/lib/npc/npcRoutineChatter.ts', {
      '../lang': { getLang: () => 'fr' },
      '../random': { pickRandomItem: lines => lines[0] },
    })
    for (const [hour, chief, own, expected] of [
      [6, false, true, /petit-déjeuner au calme/],
      [6, true, true, /petit-déjeuner, chef/],
      [19, false, false, /journée est terminée/],
      [19, true, false, /visites des chefs/],
      [14, true, true, /cuivre, chef/],
      [14, false, false, /cuivre\. Les artisans/],
    ]) {
      const calls = []
      const context = makeContext(calls)
      context.dayNight.state = { hour, minute: 30 }
      context.controls.heroUnit = { type: 'Hero', isChief: chief, owner: context.player }
      const mocks = buildMocks(calls, context)
      mocks['../lib/npc/npcRoutineChatter'] = routine
      const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', mocks)
      const manager = new NpcOrdersManager({ context })
      const npc = {
        type: 'Villager',
        label: 'routine-speaker',
        i: 0,
        j: 0,
        context,
        owner: own ? context.player : { isPlayed: false },
        autonomousJob: 'copper',
        dailySchedule: { wakeMinute: 360, workStartMinute: 420, workEndMinute: 1080, bedMinute: 1320 },
      }
      manager.open([npc], { ordersEnabled: false })
      assert.match(manager.chatterContainer.children[0].textContent, expected)
      manager.close()
    }
  })
})

test('the panel captures sleeping status before conversation focus wakes the NPC', () => {
  withFakeDocument(() => {
    const calls = []
    const context = makeContext(calls)
    context.controls.heroUnit = { type: 'Hero', isChief: true, owner: context.player }
    const mocks = buildMocks(calls, context)
    mocks['../lib/npc/npcInteraction'].noticeNpc = unit => {
      unit.sleepVisualState = null
      unit.shelterState = null
    }
    let captured
    mocks['../lib/npc/npcRoutineChatter'].pickNpcRoutineChatterLine = (_unit, hero, options) => {
      captured = { hero, ...options }
      return 'waking greeting'
    }
    const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', mocks)
    const manager = new NpcOrdersManager({ context })
    manager.open([
      { type: 'Villager', owner: context.player, shelterState: { reason: 'sleep' }, sleepVisualState: 'sleeping' },
    ])
    assert.equal(captured.sleeping, true)
    assert.equal(captured.hero, context.controls.heroUnit)
    assert.equal(manager.chatterContainer.children[0].textContent, 'waking greeting')
  })
})

test('quest return exposes delivery immediately and shows the next instruction after one click', () => {
  withFakeDocument(() => {
    const context = makeContext([])
    const quest = {
      id: 'quest',
      definitionId: 'tutorial',
      status: 'active',
      stageId: 'wood',
      parameters: { resource: 'wood', quantity: 10 },
      owner: { name: 'Chief' },
    }
    const delivery = { id: 'deliver', text: { key: 'giveWood' }, visibleWhen: [], nextStageId: 'hunt' }
    const arrows = { id: 'arrows', text: { key: 'needArrows' }, visibleWhen: [], repeatable: true }
    const calls = []
    let enoughWood = false
    context.neutralQuests = {
      dialogue: () => quest,
      environment: () => ({}),
      system: {
        definitions: new Map([
          [
            'tutorial',
            {
              stages: [
                {
                  id: 'wood',
                  dialogue: { key: 'woodReminder' },
                  readyDialogue: { key: 'woodReady' },
                  objectives: [{ text: { key: 'woodProgress' } }],
                  interactions: [delivery],
                },
                { id: 'hunt', dialogue: { key: 'huntInstructions' }, objectives: [], interactions: [arrows] },
              ],
            },
          ],
        ]),
        matches: () => true,
        canInteract: (_, interaction) => interaction.id === 'arrows' || enoughWood,
      },
      interact: (_, id) => {
        calls.push(id)
        quest.stageId = 'hunt'
        return true
      },
    }
    const { NpcQuestPanel } = loadModule('app/ui/quests/NpcQuestPanel.ts', buildMocks([], context))
    const lines = []
    const panel = new NpcQuestPanel({ context, playUiClick() {}, updateTopbar() {} }, line => lines.push(line))
    const npc = { type: 'Chief', label: 'chief', owner: { label: 'neutral-ai' } }
    assert.equal(panel.update(npc, true), 'woodReminder')
    assert.equal(panel.root.children.length, 0, 'No unavailable action or progress text')
    enoughWood = true
    assert.equal(panel.update(npc, true), 'woodReady')
    const button = panel.root.children[0]
    assert.equal(button.disabled, false)
    assert.equal(button.children.at(-1).textContent, 'giveWood')
    button.click()
    assert.deepEqual(calls, ['deliver'])
    assert.equal(lines.at(-1), 'huntInstructions')
    assert.equal(panel.root.children[0].children.at(-1).textContent, 'needArrows')
  })
})

test('conversations expose no economic job commands at any hour or storage level', () => {
  withFakeDocument(() => {
    for (const hour of [10, 23]) {
      const calls = []
      const context = makeContext(calls)
      context.dayNight.state.hour = hour
      const { NpcOrdersManager } = loadModule('app/ui/NpcOrdersManager.ts', buildMocks(calls, context))
      const manager = new NpcOrdersManager({ context })
      manager.open([{ type: 'Villager', owner: context.player, storageBlocked: true }])
      for (const key of [
        'resources',
        'food',
        'wood',
        'stone',
        'gold',
        'copper',
        'iron',
        'construction',
        'horseCapture',
      ])
        assert.equal(manager.buttons.has(key), false)
      assert.equal(manager.buttons.has('follow'), true)
      assert.equal(manager.buttons.has('stay'), true)
      assert.deepEqual(calls, [])
    }
  })
})
