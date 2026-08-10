const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadHeroBuildingMenuManager({ reachable = true } = {}) {
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
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
    },
    '../lib/avatar': {
      renderBuildingAvatar: () => false,
    },
    '../lib/heroActionRange': {
      isHeroInteractionTargetReachable: () => reachable,
    },
    '../lib/lang': {
      t: key => key,
    },
    '../lib/uiSound': {
      playUiSound: () => {},
    },
    './InspectionPanel': {
      createInspectionModal: () => ({ close() {} }),
    },
    './EntityInfoModalManager': {
      TITLED_ENTITY_INFO_OPTIONS: {},
    },
    './entityDisplayName': {
      getBuildingDisplayName: building => building.type || 'building',
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
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
        style: { setProperty() {} },
        classList: { add() {}, toggle() {} },
        appendChild(child) {
          this.children.push(child)
          return child
        },
        append(...children) {
          this.children.push(...children)
        },
        addEventListener() {},
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
