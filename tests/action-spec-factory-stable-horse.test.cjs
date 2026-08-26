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
      assignStableHorseToHero: (building, hero) => {
        if (!hero || hero.mountedOnHorse || hero.companionHorseColor) return null
        const horse = building.stableHorses?.shift?.() ?? null
        if (!horse) return null
        building.horseAmount = building.stableHorses.length
        hero.companionHorseColor = horse.horseColor ?? 'brown'
        hero.horseColor = hero.companionHorseColor
        return horse
      },
      canAfford: () => true,
      getBuildingAsset: () => ({}),
      getIconPath: id => id,
      getStableHorseAmount: building => building.stableHorses?.length ?? 0,
      heroHasLinkedHorse: hero => Boolean(hero?.mountedOnHorse || hero?.companionHorseColor),
      isBuildingLimitReached: () => false,
      isValidCondition: () => true,
    },
    '../lib/avatar': { renderUnitTypeAvatar: () => false },
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
  const menu = {
    context: {
      controls: { heroUnit: hero },
      player: {
        config: { buildings: {}, units: {} },
        techs: {},
        technologies: [],
      },
    },
    showMessage: (...args) => messages.push(args),
  }
  return new ActionSpecFactory(menu)
}

test('stable bind button consumes a stored horse and links it to the hero', () => {
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
  const factory = createFactory({ hero, messages })

  const button = factory.getActionMenuItems(stable).find(item => item.id === 'stableBindHeroHorse')
  assert.ok(button)
  assert.equal(button.disabled(), false)

  button.onClick(stable)

  assert.equal(hero.companionHorseColor, 'dark')
  assert.equal(hero.horseColor, 'dark')
  assert.deepEqual(stable.stableHorses, [])
  assert.deepEqual(messages, [['heroHorseLinked', 'success']])
  assert.equal(button.disabled(), true)
})

test('stable bind button is disabled when empty or hero already has a horse', () => {
  const messages = []
  const factory = createFactory({ hero: { companionHorseColor: 'light' }, messages })
  const stable = {
    family: 'building',
    type: 'Stable',
    isBuilt: true,
    interface: { menu: [] },
    stableHorses: [{ horseColor: 'dark' }],
  }

  const linkedButton = factory.getActionMenuItems(stable).find(item => item.id === 'stableBindHeroHorse')
  assert.equal(linkedButton.disabled(), true)

  const emptyFactory = createFactory({ hero: {}, messages })
  const emptyStable = { ...stable, stableHorses: [] }
  const emptyButton = emptyFactory.getActionMenuItems(emptyStable).find(item => item.id === 'stableBindHeroHorse')
  assert.equal(emptyButton.disabled(), true)
})
