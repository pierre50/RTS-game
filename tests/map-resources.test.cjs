const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMapResources() {
  const filename = path.join(__dirname, '../app/classes/map/MapResources.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../Resource': { Resource: class {} },
    '../../constants': {
      RESOURCE_TYPES: {
        berrybush: 'Berrybush',
        stone: 'Stone',
        copper: 'Copper',
        iron: 'Iron',
        gold: 'Gold',
        tree: 'Tree',
      },
      SPACED_RESOURCE_TYPES: ['Stone', 'Copper', 'Iron', 'Gold', 'Tree'],
      BIOME_TREE_CHANCE: {},
      BIOME_TREE_PLAYER_SAFE_DIST: 10,
      getEnvironmentTerrainParams: environment => ({
        forestDensity:
          {
            Temperate: 0.2,
            BlackForest: 0.3,
            Jungle: 0.3,
            Desert: 0.1,
          }[environment] ?? 0.2,
      }),
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : require(request))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { getNeutralResourceGroupCount } = loadMapResources()

test('neutral resource groups lean by environment without changing starting resources', () => {
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'berrybush', 120), 4)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'stone', 120), 9)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'gold', 120), 3)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Temperate', 'tree', 120), 1)

  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'berrybush', 120), 2)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'stone', 120), 11)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'copper', 120), 8)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'gold', 120), 4)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'tree', 120), 0)

  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'berrybush', 120), 5)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'stone', 120), 8)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'tree', 120), 3)

  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'berrybush', 120), 3)
  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'gold', 120), 3)
  assert.equal(getNeutralResourceGroupCount('moderate', 'BlackForest', 'tree', 120), 3)
})

test('neutral resource group counts still scale with map area', () => {
  assert.equal(getNeutralResourceGroupCount('moderate', 'Desert', 'stone', 240), 44)
  assert.equal(getNeutralResourceGroupCount('moderate', 'Jungle', 'berrybush', 240), 20)
})
