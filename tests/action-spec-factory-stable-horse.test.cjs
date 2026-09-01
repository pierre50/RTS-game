const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadActionSpecFactory(options = {}) {
  const filename = path.join(__dirname, '../app/ui/ActionSpecFactory.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    'pixi.js': { Assets: {} },
    '../constants': {
      AGE_TECHNOLOGIES: new Set(),
      AGE_UP_ENABLED: true,
      BUILDING_TYPES: { stable: 'Stable' },
      FAMILY_TYPES: { building: 'building' },
      SOUND_CUES: { ui: { menuClick: 'menuClick' } },
    },
    '../lib': {
      canAfford: options.canAfford ?? (() => true),
      getBuildingAsset: () => ({}),
      getIconPath: id => id,
      getStableHorseAmount: building => building.stableHorses?.length ?? 0,
      isBuildingLimitReached: () => false,
      isValidCondition: () => true,
      STABLE_HORSE_CAPACITY: 5,
      storeStableHorse: (building, horse) => {
        if ((building.stableHorses?.length ?? 0) >= 5) return false
        building.stableHorses = building.stableHorses ?? []
        building.stableHorses.push({ horseColor: horse.horseColor, tamingStatus: 'tamed' })
        building.horseAmount = building.stableHorses.length
        return true
      },
    },
    '../lib/avatar': { renderUnitTypeAvatar: () => false },
    '../lib/horses/horseColors': {
      HORSE_COLOR_PALETTES: {
        brown: [],
        dark: [],
        light: [],
      },
    },
    '../lib/buildings/buildingTraining': {
      getMissingResourceNames: () => [],
      hasBuildingTrainingCapacity: () => true,
      isTraineeTrainingType: () => false,
    },
    '../lib/chief': {
      hasLivingChief: () => true,
      heroCanCommand: () => true,
      playerNeedsChiefForCommand: () => false,
    },
    '../lib/lang': { t: key => key },
    '../lib/audio/uiSound': { playUiSound: () => {} },
    '../lib/units/unitTrainingOrders': {
      canShowMountHorseAction: () => false,
      canShowVillagerTrainingMenu: () => false,
      findBestTrainingBuildingForUnit: () => null,
      sendUnitToTraining: () => false,
      VILLAGER_TRAINING_UNIT_TYPES: ['Fantassin', 'Bowman'],
    },
  }
  const localRequire = request =>
    Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks)
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.ActionSpecFactory
}

function createFactory({ canAfford, hero, messages }) {
  const ActionSpecFactory = loadActionSpecFactory({ canAfford })
  const player = {
    config: { buildings: {}, units: {} },
    isBuildingEligible: () => true,
    population: 0,
    populationMax: 10,
    techs: {},
    technologies: [],
  }
  const menu = {
    context: {
      controls: {
        heroUnit: hero,
        removeMouseBuilding: () => {},
        setMouseBuilding: building => {
          menu.mouseBuilding = building
        },
      },
      player,
    },
    playUiClick: () => {},
    showMessage: (...args) => messages.push(args),
    toggleQueuedActionCancel: () => {},
  }
  return { factory: new ActionSpecFactory(menu), player }
}

test('stable debug horse button adds a stored horse without linking it to the hero', () => {
  const hero = {}
  const messages = []
  const stable = {
    family: 'building',
    type: 'Stable',
    isBuilt: true,
    interface: { menu: [{ id: 'train' }] },
    stableHorses: [{ horseColor: 'dark' }],
    horseAmount: 1,
  }
  const { factory, player } = createFactory({ hero, messages })
  stable.owner = player

  const button = factory.getActionMenuItems(stable).find(item => item.id === 'stableDebugAddHorse')
  assert.ok(button)
  assert.equal(button.disabled(), false)

  button.onClick(stable)

  assert.equal(hero.companionHorseColor, undefined)
  assert.equal(hero.horseColor, undefined)
  assert.deepEqual(stable.stableHorses, [{ horseColor: 'dark' }, { horseColor: 'dark', tamingStatus: 'tamed' }])
  assert.deepEqual(messages, [['stableDebugHorseAdded', 'success']])
  assert.equal(button.disabled(), false)
})

test('stable debug horse button is disabled when the stable is full', () => {
  const messages = []
  const { factory } = createFactory({ hero: { companionHorseColor: 'light' }, messages })
  const stable = {
    family: 'building',
    type: 'Stable',
    isBuilt: true,
    interface: { menu: [] },
    stableHorses: [{}, {}, {}, {}, {}],
  }

  const button = factory.getActionMenuItems(stable).find(item => item.id === 'stableDebugAddHorse')
  assert.equal(button.disabled(), true)
})

test('foreign buildings expose no production actions except stable debug', () => {
  const messages = []
  const { factory } = createFactory({ hero: {}, messages })
  const foreignOwner = { isPlayed: false }
  const foreignHouse = {
    family: 'building',
    type: 'House',
    owner: foreignOwner,
    isBuilt: true,
    interface: { menu: [{ id: 'spawn' }] },
  }
  const foreignStable = {
    family: 'building',
    type: 'Stable',
    owner: foreignOwner,
    isBuilt: true,
    interface: { menu: [{ id: 'train' }] },
    stableHorses: [],
  }

  assert.deepEqual(factory.getActionMenuItems(foreignHouse), [])
  assert.deepEqual(
    factory.getActionMenuItems(foreignStable).map(item => item.id),
    ['stableDebugAddHorse']
  )
})

test('own building actions survive owner object restore by label', () => {
  const messages = []
  const { factory, player } = createFactory({ hero: {}, messages })
  player.label = 'player-1'
  const restoredOwner = { ...player }
  const stable = {
    family: 'building',
    type: 'Stable',
    owner: restoredOwner,
    isBuilt: true,
    interface: { menu: [{ id: 'train' }] },
    stableHorses: [],
  }

  assert.deepEqual(
    factory.getActionMenuItems(stable).map(item => item.id),
    ['stableDebugAddHorse', 'train']
  )
})

test('cancel training button is a single global building action', () => {
  const messages = []
  const { factory, player } = createFactory({ hero: {}, messages })
  const calls = []
  const building = {
    family: 'building',
    type: 'Barracks',
    owner: player,
    queue: ['Fantassin', 'Bowman'],
    interface: { menu: [] },
    cancelAllUnitTraining: () => {
      calls.push('cancelAll')
      return true
    },
  }

  const button = factory.getCancelUnitTrainingButton(building)
  assert.equal(button.hide(), false)
  button.onClick(building)
  assert.deepEqual(calls, ['cancelAll'])
})

test('cancel training button hides when no unit training exists', () => {
  const messages = []
  const { factory, player } = createFactory({ hero: {}, messages })
  const building = {
    family: 'building',
    type: 'Barracks',
    owner: player,
    queue: [],
    interface: { menu: [] },
  }

  const button = factory.getCancelUnitTrainingButton(building)
  assert.equal(button.hide(), true)
})

test('resource-gated unit button is disabled without showing a missing resource alert', () => {
  const messages = []
  const { factory, player } = createFactory({ canAfford: () => false, hero: {}, messages })
  player.config.units.Villager = { cost: { food: 50 } }
  const building = {
    buyUnit: () => {
      throw new Error('buyUnit should not run')
    },
    family: 'building',
    owner: player,
    queue: [],
    type: 'TownCenter',
  }

  const button = factory.getActionUnitButton('Villager', building)
  assert.equal(button.disabled(), true)
  button.onClick(building)
  assert.deepEqual(messages, [])
})

test('resource-gated building button is disabled without showing a missing resource alert', () => {
  const messages = []
  const { factory, player } = createFactory({ canAfford: () => false, hero: {}, messages })
  player.config.buildings.House = { cost: { wood: 30 }, size: 2 }

  const button = factory.getActionBuildingButton('House')
  assert.equal(button.disabled(), true)
  button.onClick()
  assert.deepEqual(messages, [])
})

test('resource-gated technology button is disabled without showing a missing resource alert', () => {
  const messages = []
  const { factory, player } = createFactory({ canAfford: () => false, hero: {}, messages })
  player.techs.Farming = { cost: { food: 100 }, icon: 'farming' }
  player.buyTechnology = () => {
    throw new Error('buyTechnology should not run')
  }

  const button = factory.getActionTechnologyButton('Farming')
  assert.equal(button.disabled(), true)
  button.onClick()
  assert.deepEqual(messages, [])
})
