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
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }]],
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
  const { getAnimationFrames } = loadModule('app/lib/extra.js', {
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
  const { createPlayerData } = loadModule('app/config/playerConfig.js', {
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
  const { createPlayerData } = loadModule('app/config/playerConfig.js', {
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

  assert.equal(config.units.FishingShip.assets.dyingSheet, '263')
  assert.equal(config.units.ScoutShip.assets.dyingSheet, '263')
  assert.equal(config.units.WarGalley.assets.dyingSheet, '264')
  assert.equal(config.units.Trireme.assets.dyingSheet, '264')
  assert.deepEqual(config.units.FishingShip.sounds.die, [5113, 5177, 5181])
  assert.deepEqual(config.units.ScoutShip.sounds.die, [5113, 5177, 5181])
  assert.deepEqual(config.units.WarGalley.sounds.die, [5113, 5177, 5181])
  assert.deepEqual(config.units.Trireme.sounds.die, [5113, 5177, 5181])
  assert.equal(config.units.FishingShip.sheetDirectionCounts.dyingSheet, 1)
  assert.equal(config.units.Trireme.sheetDirectionCounts.corpseSheet, 1)
})

test('Asset manifest preloads the sinking sheets used by boats', () => {
  const { ASSET_BUNDLES } = loadModule('app/config/assetManifest.js', {})
  assert.equal(ASSET_BUNDLES.graphics[262], 'assets/graphics/262/texture.json')
  assert.equal(ASSET_BUNDLES.graphics[263], 'assets/graphics/263/texture.json')
  assert.equal(ASSET_BUNDLES.graphics[264], 'assets/graphics/264/texture.json')
  assert.equal(ASSET_BUNDLES.graphics[697], 'assets/graphics/697/texture.json')
  assert.equal(ASSET_BUNDLES.graphics[700], 'assets/graphics/700/texture.json')
})
