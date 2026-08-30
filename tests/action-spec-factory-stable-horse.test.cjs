const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadActionSpecFactory() {
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
      canAfford: () => true,
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
    '../lib/buildings/buildingTraining': { getMissingResourceNames: () => [], isTraineeTrainingType: () => false },
    '../lib/chief': {
      hasLivingChief: () => true,
      heroCanCommand: () => true,
      playerNeedsChiefForCommand: () => false,
    },
    '../lib/lang': { t: key => key },
    '../lib/audio/uiSound': { playUiSound: () => {} },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.ActionSpecFactory
}

function createFactory({ hero, messages }) {
  const ActionSpecFactory = loadActionSpecFactory()
  const player = {
    config: { buildings: {}, units: {} },
    techs: {},
    technologies: [],
  }
  const menu = {
    context: {
      controls: { heroUnit: hero },
      player,
    },
    showMessage: (...args) => messages.push(args),
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
  assert.deepEqual(stable.stableHorses, [
    { horseColor: 'dark' },
    { horseColor: 'dark', tamingStatus: 'tamed' },
  ])
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
