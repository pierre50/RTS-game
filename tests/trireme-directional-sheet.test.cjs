const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

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

test('direction count 1 keeps every wreck frame instead of slicing it as a 5-direction sheet', () => {
  const { getAnimationFrames } = loadModule('app/lib/extra.ts', {
    '../constants': { SHEET_TYPES: {}, WORK_TYPES: {} },
    './grid': { instanceIsInPlayerSight: () => false },
    './maths': {},
    './uiSound': {},
    './lang': {},
  })

  const textures = {
    '000.png': { id: 0 },
    '001.png': { id: 1 },
    '002.png': { id: 2 },
    '003.png': { id: 3 },
    '004.png': { id: 4 },
  }

  const frames = getAnimationFrames(textures, 'south', 1)
  assert.equal(frames.length, 5)
  assert.deepEqual(
    frames.map(frame => frame.id),
    [0, 1, 2, 3, 4]
  )
})

test('Trireme declares its 9-direction sheets so it does not animate through headings while idle', () => {
  const { createPlayerData } = loadModule('app/config/playerConfig.ts', {
    './civilizations': { getCivilizationDefinition: () => ({ disabledUnits: [], disabledTechnologies: [] }) },
    '../lib/extra': { EAST_FIRST_EIGHT_DIRECTION_ORDER: [] },
  })
  const { config } = createPlayerData(
    {
      units: {
        Trireme: {},
      },
      buildings: {
        Dock: {},
      },
      projectiles: {},
    },
    {},
    'Greek'
  )

  assert.deepEqual(config.units.Trireme.sheetDirectionCounts, {
    standingSheet: 9,
    walkingSheet: 9,
    actionSheet: 9,
    dyingSheet: 1,
    corpseSheet: 1,
  })
})

test('Boat wreck sheets stay non-directional and use sinking animations', () => {
  const { createPlayerData } = loadModule('app/config/playerConfig.ts', {
    './civilizations': { getCivilizationDefinition: () => ({ disabledUnits: [], disabledTechnologies: [] }) },
    '../lib/extra': { EAST_FIRST_EIGHT_DIRECTION_ORDER: [] },
  })
  const { config } = createPlayerData(
    {
      units: {
        FishingShip: {},
        ScoutShip: {},
        WarGalley: {},
        Trireme: {},
      },
      buildings: {
        Dock: {},
      },
      projectiles: {},
    },
    {},
    'Greek'
  )

  assert.equal(config.units.FishingShip.assets.dyingSheet, 'boats/wreck-small')
  assert.equal(config.units.ScoutShip.assets.dyingSheet, 'boats/wreck-small')
  assert.equal(config.units.WarGalley.assets.dyingSheet, 'boats/wreck-large')
  assert.equal(config.units.Trireme.assets.dyingSheet, 'boats/wreck-large')
  assert.deepEqual(config.units.FishingShip.sounds.die, ['ship-sunk', 'ship-sunk-2', 'ship-sunk-3'])
  assert.deepEqual(config.units.ScoutShip.sounds.die, ['ship-sunk', 'ship-sunk-2', 'ship-sunk-3'])
  assert.deepEqual(config.units.WarGalley.sounds.die, ['ship-sunk', 'ship-sunk-2', 'ship-sunk-3'])
  assert.deepEqual(config.units.Trireme.sounds.die, ['ship-sunk', 'ship-sunk-2', 'ship-sunk-3'])
  assert.equal(config.units.FishingShip.sheetDirectionCounts.dyingSheet, 1)
  assert.equal(config.units.Trireme.sheetDirectionCounts.corpseSheet, 1)
})

test('Chariot uses its own dying and corpse sheets', () => {
  const { createPlayerData } = loadModule('app/config/playerConfig.ts', {
    './civilizations': { getCivilizationDefinition: () => ({ disabledUnits: [], disabledTechnologies: [] }) },
    '../lib/extra': { EAST_FIRST_EIGHT_DIRECTION_ORDER: [] },
  })
  const { config } = createPlayerData(
    {
      units: {
        Chariot: {},
      },
      buildings: {},
      projectiles: {},
    },
    {},
    'Greek'
  )

  assert.equal(config.units.Chariot.assets.dyingSheet, 'units/chariot/dying')
  assert.equal(config.units.Chariot.assets.corpseSheet, 'units/chariot/corpse')
})

test('Asset manifest preloads the sinking sheets used by boats', () => {
  const { ASSET_BUNDLES } = loadModule('app/config/assetManifest.ts', {})
  assert.equal(ASSET_BUNDLES.graphics['boats/fishing-boat/dying'], 'assets/graphics/boats/fishing-boat/dying/texture.json')
  assert.equal(ASSET_BUNDLES.graphics['boats/wreck-small'], 'assets/graphics/boats/wreck-small/texture.json')
  assert.equal(ASSET_BUNDLES.graphics['boats/wreck-large'], 'assets/graphics/boats/wreck-large/texture.json')
  assert.equal(
    ASSET_BUNDLES.graphics['boats/fishing-boat/fishing-overlay'],
    'assets/graphics/boats/fishing-boat/fishing-overlay/texture.json'
  )
  assert.equal(
    ASSET_BUNDLES.graphics['boats/fishing-ship/fishing-overlay'],
    'assets/graphics/boats/fishing-ship/fishing-overlay/texture.json'
  )
})

test('Asset manifest preloads chariot death sheets', () => {
  const { ASSET_BUNDLES } = loadModule('app/config/assetManifest.ts', {})
  assert.equal(ASSET_BUNDLES.graphics['units/chariot/dying'], 'assets/graphics/units/chariot/dying/texture.json')
  assert.equal(ASSET_BUNDLES.graphics['units/chariot/corpse'], 'assets/graphics/units/chariot/corpse/texture.json')
})
