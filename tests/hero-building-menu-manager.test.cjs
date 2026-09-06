const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadHeroBuildingMenuManager({ reachable = true } = {}) {
  const transferPanels = []
  const audibleSoundCues = []
  const campfireSleepCalls = []
  const theftConsequences = []
  const filename = path.join(__dirname, '../app/ui/HeroBuildingMenuManager.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      FAMILY_TYPES: { building: 'building' },
      BUILDING_TYPES: { chest: 'Chest', fireCamp: 'FireCamp', market: 'Market' },
      SOUND_CUES: { building: { chestOpen: 'building/chest-open' }, ui: { menuClick: 'menuClick' } },
    },
    '../lib/avatar': {
      renderBuildingAvatar: () => false,
    },
    '../lib/hero/heroActionRange': {
      isHeroInteractionTargetReachable: () => reachable,
    },
    '../lib/hero/heroCampfireSleep': {
      canHeroSleepAtFireCamp: hero => hero?.canSleepAtCampfire !== false,
      sleepHeroAtFireCamp: (hero, building) => {
        campfireSleepCalls.push({ hero, building })
        return hero?.canSleepAtCampfire !== false
      },
    },
    '../lib/lang': {
      t: key => key,
    },
    '../lib/audio/uiSound': {
      playUiSound: () => {},
    },
    '../lib/audio/sound': {
      playAudibleSoundCue: (instance, cue, options) => audibleSoundCues.push({ cue, instance, options }),
    },
    '../lib/theft/theft': {
      applyTheftConsequences: event => theftConsequences.push(event),
      THEFT_SUBJECT_TYPES: { chest: 'chest' },
    },
    './InspectionPanel': {
      createInspectionModal: () => ({ close() {} }),
    },
    './EntityInfoModalManager': {
      TITLED_ENTITY_INFO_OPTIONS: {},
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
    },
    './hero-building/HeroMarketBody': {
      createHeroMarketBody: (building, _menu, onChange) => {
        const element = global.document.createElement('div')
        element.className = 'hero-market-panel'
        element.dataset.marketBuilding = building.label
        element.onChange = onChange
        return element
      },
    },
    '../lib/inventory/inventoryContainers': {
      createInventoryContainer: (target, options) => {
        target.inventory = target.inventory ?? { equipment: [], resources: {} }
        target.inventory.equipment = target.inventory.equipment ?? []
        target.inventory.resources = target.inventory.resources ?? {}
        return { ...options, inventory: target.inventory }
      },
    },
    './utils/entityDisplayName': {
      getBuildingDisplayName: building => building.type || 'building',
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  module.exports.HeroBuildingMenuManager.__transferPanels = transferPanels
  module.exports.HeroBuildingMenuManager.__audibleSoundCues = audibleSoundCues
  module.exports.HeroBuildingMenuManager.__campfireSleepCalls = campfireSleepCalls
  module.exports.HeroBuildingMenuManager.__theftConsequences = theftConsequences
  return module.exports.HeroBuildingMenuManager
}

function installMockDocument() {
  const previousDocument = global.document
  global.document = {
    createElement(tagName) {
      return {
        tagName,
        children: [],
        className: '',
        dataset: {},
        id: '',
        disabled: false,
        textContent: '',
        childElementCount: 0,
        listeners: new Map(),
        style: { setProperty() {} },
        classList: { add() {}, toggle() {} },
        appendChild(child) {
          this.children.push(child)
          this.childElementCount = this.children.length
          return child
        },
        append(...children) {
          this.children.push(...children)
          this.childElementCount = this.children.length
        },
        addEventListener(type, listener) {
          const listeners = this.listeners.get(type) ?? []
          listeners.push(listener)
          this.listeners.set(type, listeners)
        },
        dispatch(type) {
          for (const listener of this.listeners.get(type) ?? []) listener({ type, currentTarget: this })
        },
        replaceChildren(...children) {
          this.children = children
          this.childElementCount = this.children.length
        },
        querySelectorAll() {
          return []
        },
      }
    },
  }
  return () => {
    global.document = previousDocument
  }
}

function createManager({ reachable = true } = {}) {
  const restoreDocument = installMockDocument()
  const HeroBuildingMenuManager = loadHeroBuildingMenuManager({ reachable })
  const player = { isPlayed: true }
  const manager = new HeroBuildingMenuManager({
    context: {
      app: {},
      controls: { heroUnit: { family: 'unit' } },
      player,
    },
    getActionMenuItems: building => (building.isBuilt ? [{ id: 'train' }] : []),
    menuTooltip: { bind() {}, hide() {} },
  })
  return { manager, player, restoreDocument }
}

test('hero building menu can open own unfinished buildings for inspection', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: player,
      isBuilt: false,
      isDead: false,
      isDestroyed: false,
    }

    assert.equal(manager.canOpenFor(building), true)
  } finally {
    restoreDocument()
  }
})

test('hero building menu can open reachable foreign buildings for inspection', () => {
  const { manager, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: { isPlayed: false },
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
    }

    assert.equal(manager.canOpenFor(building), true)
  } finally {
    restoreDocument()
  }
})

test('hero building menu keeps actions empty for unfinished buildings', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: player,
      type: 'house',
      isBuilt: false,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }

    assert.equal(manager.open(building), true)
    assert.deepEqual(manager.stack, [[]])
  } finally {
    restoreDocument()
  }
})

test('hero building menu renders one row per concurrent training entry', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    manager.menu.getActionMenuItems = () => [
      {
        id: 'Fantassin',
        tooltip: () => ({ title: 'Fantassin', meta: ['cost'] }),
      },
    ]
    const building = {
      family: 'building',
      owner: player,
      type: 'Barracks',
      label: 'barracks-1',
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      queue: ['Fantassin', 'Fantassin'],
      trainingQueue: [
        { type: 'Fantassin', loading: 20, trainee: { label: 'villager-a' } },
        { type: 'Fantassin', loading: 60, trainee: { label: 'villager-b' } },
      ],
      interface: { info() {} },
    }

    assert.equal(manager.open(building), true)

    const rows = manager.body.children.filter(child => child.className.includes('ui-action-row'))
    assert.equal(rows.length, 2)
    assert.equal(rows[0].dataset.actionId, 'Fantassin')
    assert.equal(rows[0].dataset.trainingIndex, '0')
    assert.equal(rows[0].children[1].textContent, '')
    assert.equal(rows[1].dataset.actionId, 'Fantassin')
    assert.equal(rows[1].dataset.trainingIndex, '1')
    assert.equal(rows[1].children[1].textContent, '')
  } finally {
    restoreDocument()
  }
})

test('hero building menu renders a reusable inventory transfer panel for chests', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: player,
      type: 'Chest',
      label: 'chest-1',
      inventory: { equipment: ['trap'], resources: { wood: 5 } },
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }
    const hero = {
      family: 'unit',
      label: 'hero',
      inventory: { equipment: ['chest'], resources: { food: 3 } },
    }
    manager.menu.context.controls.heroUnit = hero

    assert.equal(manager.open(building), true)

    const panel = manager.constructor.__transferPanels.at(-1)
    assert.equal(panel.options.destination.id, 'chest-1')
    assert.equal(panel.options.destination.inventory, building.inventory)
    assert.equal(panel.options.source.id, 'hero')
    assert.equal(panel.options.source.labelKey, 'inventoryYourBag')
    assert.equal(panel.options.source.inventory, hero.inventory)
    assert.equal(manager.body.children.at(-1).className, 'inventory-transfer-panel')
    assert.deepEqual(manager.constructor.__audibleSoundCues, [
      { cue: 'building/chest-open', instance: building, options: { profile: 'surface' } },
    ])
  } finally {
    restoreDocument()
  }
})

test('hero building menu renders market body for markets', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: player,
      type: 'Market',
      label: 'market-1',
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }
    manager.menu.context.controls.heroUnit = {
      family: 'unit',
      label: 'hero',
      inventory: { equipment: ['bow'], resources: { gold: 12 } },
    }

    assert.equal(manager.open(building), true)

    assert.equal(manager.transferPanel, null)
    assert.equal(manager.body.children.at(-1).className, 'hero-market-panel')
    assert.equal(manager.body.children.at(-1).dataset.marketBuilding, 'market-1')
  } finally {
    restoreDocument()
  }
})

test('hero building menu adds a sleep button for fire camps', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    manager.menu.getActionMenuItems = () => []
    const hero = { family: 'unit', canSleepAtCampfire: true }
    const building = {
      family: 'building',
      owner: player,
      type: 'FireCamp',
      label: 'campfire-1',
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }
    manager.menu.context.controls.heroUnit = hero

    assert.equal(manager.open(building), true)

    const button = manager.body.children[0]
    assert.equal(button.id, 'hero-heroCampfireSleep')
    assert.equal(button.dataset.actionId, 'heroCampfireSleep')
    assert.equal(button.disabled, false)

    button.dispatch('click')

    assert.deepEqual(manager.constructor.__campfireSleepCalls, [{ hero, building }])
  } finally {
    restoreDocument()
  }
})

test('hero building menu disables campfire sleep while blocked', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    manager.menu.getActionMenuItems = () => []
    manager.menu.context.controls.heroUnit = { family: 'unit', canSleepAtCampfire: false }
    const building = {
      family: 'building',
      owner: player,
      type: 'FireCamp',
      label: 'campfire-1',
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }

    assert.equal(manager.open(building), true)

    const button = manager.body.children[0]
    assert.equal(button.id, 'hero-heroCampfireSleep')
    assert.equal(button.disabled, true)
  } finally {
    restoreDocument()
  }
})

test('hero building menu refreshes an open chest when inventory changes externally', () => {
  const { manager, player, restoreDocument } = createManager()
  try {
    const building = {
      family: 'building',
      owner: player,
      type: 'Chest',
      label: 'chest-1',
      inventory: { equipment: [], resources: { wood: 5 } },
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }
    manager.menu.context.controls.heroUnit = {
      family: 'unit',
      label: 'hero',
      inventory: { equipment: [], resources: {} },
    }

    assert.equal(manager.open(building), true)
    const initialPanels = manager.constructor.__transferPanels.length

    building.inventory.resources.food = 3
    manager.refreshInventory()

    assert.equal(manager.constructor.__transferPanels.length, initialPanels + 1)
    assert.equal(manager.body.children.at(-1).className, 'inventory-transfer-panel')
  } finally {
    restoreDocument()
  }
})

test('hero building menu marks and reports foreign chest theft only when taking from it', () => {
  const { manager, restoreDocument } = createManager()
  try {
    const foreignOwner = { isPlayed: false, label: 'neutral-ai' }
    const building = {
      family: 'building',
      owner: foreignOwner,
      type: 'Chest',
      label: 'chest-1',
      inventory: { equipment: ['trap'], resources: { wood: 5 } },
      isBuilt: true,
      isDead: false,
      isDestroyed: false,
      interface: { info() {} },
    }
    const hero = {
      family: 'unit',
      label: 'hero',
      owner: { isPlayed: true, label: 'player' },
      inventory: { equipment: ['chest'], resources: { food: 3 } },
    }
    manager.menu.context.controls.heroUnit = hero

    assert.equal(manager.open(building), true)

    const panel = manager.constructor.__transferPanels.at(-1)
    assert.equal(panel.options.isTheftTransfer(panel.options.destination, panel.options.source), true)
    assert.equal(panel.options.isTheftTransfer(panel.options.source, panel.options.destination), false)

    panel.options.onTransfer({
      amount: 1,
      destination: panel.options.source,
      item: 'wood',
      kind: 'resource',
      source: panel.options.destination,
    })
    panel.options.onTransfer({
      amount: 1,
      destination: panel.options.destination,
      item: 'food',
      kind: 'resource',
      source: panel.options.source,
    })

    assert.equal(manager.constructor.__theftConsequences.length, 1)
    assert.equal(manager.constructor.__theftConsequences[0].actor, hero)
    assert.equal(manager.constructor.__theftConsequences[0].owner, foreignOwner)
    assert.equal(manager.constructor.__theftConsequences[0].subject, 'chest')
    assert.equal(manager.constructor.__theftConsequences[0].target, building)
  } finally {
    restoreDocument()
  }
})
