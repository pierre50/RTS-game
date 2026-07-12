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
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

test('boat death plays the wreck corpse animation directly with boat timing', () => {
  const { UnitLifecycle } = loadModule('app/classes/unit/UnitLifecycle.ts', {
    '../../constants': {
      BOAT_CORPSE_TIME: 12,
      CORPSE_TIME: 120,
      MENU_INFO_IDS: {},
      POPULATION_MAX: 200,
      SHEET_TYPES: {
        corpse: 'corpseSheet',
        dying: 'dyingSheet',
      },
    },
    '../../lib': {
      canUpdateMinimap: () => false,
      isPlayerEliminated: () => false,
      playAudibleSoundCue: () => null,
      updateInstanceVisibility: () => {},
    },
  })

  const cell = {
    has: null,
    corpses: new Set(),
    solid: true,
  }
  const unit = {
    category: 'Boat',
    i: 0,
    j: 0,
    owner: {
      corpses: [],
    },
    context: {
      map: {
        grid: [[cell]],
      },
    },
    sprite: {
      textures: [1, 2, 3, 4],
      loop: true,
      animationSpeed: 0,
    },
    setTextures(sheet) {
      this.currentSheet = sheet
    },
    clear() {
      this.cleared = true
    },
  }
  cell.has = unit

  new UnitLifecycle(unit).death()

  assert.equal(unit.currentSheet, 'corpseSheet')
  assert.equal(unit.owner.corpses.includes(unit), true)
  assert.equal(cell.has, null)
  assert.equal(cell.solid, false)
  assert.equal(cell.corpses.has(unit), true)
  assert.equal(unit.sprite.loop, false)
  assert.equal(unit.sprite.animationSpeed, 4 / (12 * 60))

  unit.sprite.onComplete()
  assert.equal(unit.cleared, true)
})

test('fishing boats gather silently', () => {
  const playedSounds = []
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
      playSoundCue: sound => playedSounds.push(sound),
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

  const fish = {
    quantity: 10,
    selected: false,
  }
  const unit = {
    category: 'Boat',
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
    sounds: {
      work: {
        fishing: ['fish', 'fish-2', 'fish-3'],
      },
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
    affectNewDest: () => {},
    sendToDelivery: () => {},
  }

  new UnitActions(unit).getAction('fishing')

  assert.equal(unit.loading, 1)
  assert.equal(fish.quantity, 9)
  assert.deepEqual(playedSounds, [])
})

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
    category: 'Boat',
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
