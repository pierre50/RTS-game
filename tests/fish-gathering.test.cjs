const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

const runtimeTypesMock = new Proxy(
  {},
  {
    get: (_target, prop) => (prop === 'unsetRuntimeCoordinate' ? () => null : value => value),
  }
)

const unitExperienceMock = {
  LOADING_XP_CATEGORY: {},
  WORK_XP_CATEGORY: {},
  XP_BUILD_TICK: 2,
  XP_CATEGORIES: {},
  XP_CONVERT_SUCCESS: 30,
  XP_FELL_TREE_TICK: 1,
  XP_KILL_BONUS: 15,
  getBuildRateXpMultiplier: () => 1,
  getCombatXpBonus: () => 0,
  getGatherXpBonus: () => 0,
  getHealingXpBonus: () => 0,
  grantUnitXp: () => {},
}

function loadModule(relativePath, mocks) {
  const filename = path.join(__dirname, '..', relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const localRequire = request => {
    if (request === '../../types/runtime') return runtimeTypesMock
    if (Object.hasOwn(mocks, request)) return mocks[request]
    if (request === '../../lib/unitExperience') return unitExperienceMock
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('depleted fish are cleared immediately after gathering', () => {
  const { UnitActions } = loadModule('app/classes/unit/UnitActions.ts', {
    'pixi.js': {
      Assets: {
        cache: {
          get: () => ({}),
        },
      },
    },
    '../../constants': {
      ACTION_TYPES: {
        fishing: 'fishing',
      },
      BUILDING_TYPES: {},
      FAMILY_TYPES: {},
      LOADING_FOOD_TYPES: ['fish'],
      LOADING_TYPES: {
        fish: 'fish',
      },
      MENU_INFO_IDS: {
        quantityText: 'quantityText',
      },
      SHEET_TYPES: {
        action: 'actionSheet',
      },
      SOUND_CUES: {
        villager: {},
      },
      TYPE_ACTION: {},
      UNIT_TYPES: {},
    },
    '../../lib': {
      degreeToDirection: () => 'south',
      getInstanceDegree: () => 0,
      onSpriteLoopAtFrame: () => {},
      playSoundCue: () => {},
      playerCanSeeInstance: () => false,
    },
    '../Projectile': {
      Projectile: class {},
    },
    '../../lib/buildings/towers': {
      getTowerType: target => target?.type,
      isTower: () => false,
    },
  })

  let fishDied = false
  let affectedNewDest = false
  const fish = {
    quantity: 1,
    selected: false,
    die() {
      fishDied = true
    },
  }
  const unit = {
    category: 'Villager',
    action: 'fishing',
    work: 'fisher',
    loading: 0,
    loadingType: null,
    loadingMax: {
      fish: 10,
    },
    gatheringRate: {
      fisher: 1,
    },
    silentWorkSounds: ['fishing'],
    dest: fish,
    sprite: {},
    context: {
      controls: {
        instanceIsAudible: () => true,
      },
      menu: {
        updateInfo: () => {},
      },
      player: {},
      map: {},
    },
    getActionCondition: () => true,
    setTextures: () => {},
    startInterval(callback) {
      callback()
    },
    updateInterfaceLoading: () => {},
    affectNewDest() {
      affectedNewDest = true
    },
    sendToDelivery: () => {},
  }

  new UnitActions(unit).getAction('fishing')

  assert.equal(fish.quantity, 0)
  assert.equal(fishDied, true)
  assert.equal(affectedNewDest, true)
})
