const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const resources = require('../public/assets/data/gameplay/resources.json')
const gameplayUnits = require('../public/assets/data/gameplay/units.json')

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
    return require(request)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

function matches(condition, player) {
  const actual = player[condition.key]
  switch (condition.op) {
    case '>=':
      return actual >= condition.value
    case 'includes':
      return actual.includes(condition.value)
    case 'notincludes':
      return !actual.includes(condition.value)
    default:
      throw new Error(`Unhandled condition op: ${condition.op}`)
  }
}

function visibleUnits(config, player) {
  return config.buildings.Dock.units.filter(type =>
    (config.units[type].conditions || []).every(condition => matches(condition, player))
  )
}

test('Dock only shows the current boat in each upgrade chain', () => {
  const { createPlayerData } = loadModule('app/config/playerConfig.ts', {
    './civilizations': { getCivilizationDefinition: () => ({ disabledUnits: [], disabledTechnologies: [] }) },
    '../lib/extra': { EAST_FIRST_EIGHT_DIRECTION_ORDER: [] },
  })
  const { config, techs } = createPlayerData(
    {
      units: {
        FishingBoat: gameplayUnits.FishingBoat,
      },
      buildings: {
        Dock: {},
      },
      projectiles: {},
    },
    {},
    'Greek'
  )

  assert.deepEqual(config.buildings.Dock.technologies, [
    'WarGalley',
    'Trireme',
    'CatapultTrireme',
    'Juggernaut',
    'FishingShip',
    'HeavyTransport',
  ])
  assert.equal(techs.FishingShip.icon, '020_50729')
  assert.equal(techs.WarGalley.icon, '024_50729')
  assert.equal(techs.Trireme.icon, '026_50729')
  assert.equal(techs.CatapultTrireme.icon, '027_50729')
  assert.equal(techs.Juggernaut.icon, '083_50729')
  assert.equal(techs.HeavyTransport.icon, '025_50729')
  assert.equal(config.units.Trireme.projectile, 'Arrow')
  assert.equal(config.units.CatapultTrireme.projectile, 'Stone')
  assert.equal(config.units.Juggernaut.projectile, 'Bolt')
  assert.equal(config.units.FishingShip.icon, '020_50730')
  assert.deepEqual(config.units.FishingBoat.silentWorkSounds, ['fishing'])
  assert.deepEqual(config.units.FishingShip.silentWorkSounds, ['fishing'])
  assert.equal(config.units.FishingBoat.assets.actionSheet, 'boats/fishing-boat')
  assert.equal(config.units.FishingBoat.assets.fishingOverlaySheet, 'boats/fishing-boat/fishing-overlay')
  assert.equal(config.units.FishingShip.assets.actionSheet, 'boats/fishing-ship')
  assert.equal(config.units.FishingShip.assets.fishingOverlaySheet, 'boats/fishing-ship/fishing-overlay')
  assert.equal(config.units.CatapultTrireme.icon, '030_50730')
  assert.equal(config.units.Juggernaut.icon, '052_50730')
  assert.equal(config.projectiles.Stone.trajectory.kind, 'arc')

  assert.deepEqual(visibleUnits(config, { age: 1, technologies: [] }), ['FishingBoat', 'LightTransport'])
  assert.deepEqual(visibleUnits(config, { age: 2, technologies: [] }), [
    'FishingBoat',
    'LightTransport',
    'ScoutShip',
  ])
  assert.deepEqual(visibleUnits(config, { age: 2, technologies: ['FishingShip'] }), [
    'FishingShip',
    'LightTransport',
    'ScoutShip',
  ])
  assert.deepEqual(visibleUnits(config, { age: 2, technologies: ['WarGalley'] }), [
    'FishingBoat',
    'LightTransport',
    'WarGalley',
  ])
  assert.deepEqual(visibleUnits(config, { age: 3, technologies: ['WarGalley', 'Trireme'] }), [
    'FishingBoat',
    'LightTransport',
    'Trireme',
  ])
  assert.deepEqual(
    visibleUnits(config, { age: 3, technologies: ['WarGalley', 'Trireme', 'CatapultTrireme'] }),
    ['FishingBoat', 'LightTransport', 'Trireme', 'CatapultTrireme']
  )
  assert.deepEqual(
    visibleUnits(config, { age: 3, technologies: ['WarGalley', 'Trireme', 'CatapultTrireme', 'Juggernaut'] }),
    ['FishingBoat', 'LightTransport', 'Trireme', 'Juggernaut']
  )
  assert.deepEqual(visibleUnits(config, { age: 3, technologies: ['HeavyTransport'] }), [
    'FishingBoat',
    'HeavyTransport',
    'ScoutShip',
  ])
})

test('upgraded fishing ships can still fish every fish resource', () => {
  assert.equal(resources.Salmon.assets, 'resources/fish/salmon')

  for (const [type, resource] of Object.entries(resources)) {
    if (resource.category !== 'Fish') continue
    assert.ok(resource.allowAction.includes('FishingBoat'), `${type} should allow FishingBoat`)
    assert.ok(resource.allowAction.includes('FishingShip'), `${type} should allow FishingShip`)
  }
})
