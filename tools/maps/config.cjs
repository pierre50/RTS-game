const path = require('node:path')

const ROOT = path.resolve(__dirname, '../..')

const OUTPUT = path.join(ROOT, 'public', 'maps')

const BLUEPRINT_MAP_SIZE = 144

const BLUEPRINT_MAP_SPAWN_RANGE = [2, 4]

// Index must match MapGeneration#generateTerrain's raw output.
const TERRAIN = ['Grass', 'Desert', 'Water', 'Jungle', 'DarkForest', 'Dirt', '', 'Snow']

const TERRAIN_INDEX = new Map(TERRAIN.map((type, index) => [type, index]))

const MACRO_TERRAIN_CODE_TO_TYPE = {
  W: 'Water',
  T: 'Grass',
  F: 'DarkForest',
  J: 'Jungle',
  D: 'Desert',
  S: 'Grass',
}

const MACRO_TREE_FAMILY_BY_CODE = {
  T: 'Grass',
  F: 'DarkForest',
  J: 'Jungle',
  D: 'Desert',
  S: 'DarkForest',
}

const MACRO_FOREST_PROFILE_BY_CODE = {
  T: { threshold: 0.64, coreChance: 0.22, edgeChance: 0.04, scale: 0.048, seedOffset: 1103 },
  F: {
    threshold: 0.4,
    coreChance: 0.3,
    edgeChance: 0.07,
    scale: 0.052,
    seedOffset: 1201,
    clearingScale: 0.032,
    clearingThreshold: 0.68,
    clearingFeather: 0.11,
  },
  J: { threshold: 0.3, coreChance: 0.42, edgeChance: 0.13, scale: 0.056, seedOffset: 1301 },
  D: { threshold: 0.82, coreChance: 0.09, edgeChance: 0.015, scale: 0.06, seedOffset: 1409 },
  S: { threshold: 0.76, coreChance: 0.16, edgeChance: 0.025, scale: 0.05, seedOffset: 1511 },
}

// app/constants/environments.ts is plain data (no pixi/DOM deps), so it can be loaded
// directly instead of duplicating its thresholds here like the mocks below have to.
function loadPlainTsModule(relativePath) {
  const filename = path.join(ROOT, relativePath)
  const babel = require('@babel/core')
  const { code } = babel.transformFileSync(filename, {
    presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, require)
  return module.exports
}

const { ENVIRONMENT_TERRAIN_PARAMS, DEFAULT_ENVIRONMENT_ID, ENVIRONMENT_IDS } = loadPlainTsModule(
  'app/constants/environments.ts'
)

const { RELIEF_WATER_BUFFER_RADIUS } = loadPlainTsModule('app/constants/terrain.ts')

const { createSeededRandom } = loadPlainTsModule('app/lib/random.ts')

module.exports = {
  BLUEPRINT_MAP_SIZE,
  ENVIRONMENT_IDS,
  DEFAULT_ENVIRONMENT_ID,
  OUTPUT,
  ROOT,
  ENVIRONMENT_TERRAIN_PARAMS,
  MACRO_TERRAIN_CODE_TO_TYPE,
  TERRAIN_INDEX,
  MACRO_TREE_FAMILY_BY_CODE,
  MACRO_FOREST_PROFILE_BY_CODE,
  TERRAIN,
  RELIEF_WATER_BUFFER_RADIUS,
  BLUEPRINT_MAP_SPAWN_RANGE,
  createSeededRandom,
}
