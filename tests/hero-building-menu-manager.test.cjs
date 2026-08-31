const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadHeroBuildingMenuManager({ reachable = true } = {}) {
  const transferPanels = []
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
      BUILDING_TYPES: { chest: 'Chest' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
    },
    '../lib/avatar': {
      renderBuildingAvatar: () => false,
    },
    '../lib/hero/heroActionRange': {
      isHeroInteractionTargetReachable: () => reachable,
    },
    '../lib/lang': {
      t: key => key,
    },
    '../lib/audio/uiSound': {
      playUiSound: () => {},
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
        textContent: '',
        childElementCount: 0,
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
        addEventListener() {},
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
    menuTooltip: { hide() {} },
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
    assert.equal(panel.options.source.inventory, hero.inventory)
    assert.equal(manager.body.children.at(-1).className, 'inventory-transfer-panel')
  } finally {
    restoreDocument()
  }
})
