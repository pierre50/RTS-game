const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadSaveSerializer() {
  const filename = path.join(__dirname, '../app/serialization/SaveSerializer.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === '../lib') {
      return {
        filterObject(sourceObject, keys) {
          return keys.reduce((result, key) => {
            if (sourceObject[key] !== undefined) result[key] = sourceObject[key]
            return result
          }, {})
        },
        getGaiaAnimals: gaia => gaia?.animals ?? gaia?.units ?? [],
      }
    }
    return require(id)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
  return module.exports
}

function makeContext(mapOverrides = {}) {
  return {
    scheduler: { elapsedMs: 123 },
    controls: { camera: { x: 10, y: 20 } },
    players: [
      {
        label: 'player-1',
        type: 'Human',
        isPlayed: true,
        buildings: [],
        units: [],
        corpses: [],
        views: { toJSON: () => [[{}]] },
      },
    ],
    map: {
      seed: 42,
      size: 144,
      mapType: 'plain',
      positionsCount: 2,
      pregeneratedBlueprintId: null,
      resources: new Set(),
      gaia: { units: [] },
      grid: [[{ type: 'Grass', z: 0, fogSprites: [] }]],
      ...mapOverrides,
    },
  }
}

const { serializeGame } = loadSaveSerializer()

test('seeded saves omit the full map grid', () => {
  const save = serializeGame(makeContext())

  assert.equal(save.version, 2)
  assert.equal(save.world.seed, 42)
  assert.equal(save.world.size, 144)
  assert.equal(save.world.mapType, 'plain')
  assert.equal(Object.hasOwn(save, 'map'), false)
})

test('saves without a seed do not write a legacy map fallback', () => {
  const save = serializeGame(makeContext({ seed: null }))

  assert.equal(save.version, 2)
  assert.equal(Object.hasOwn(save, 'map'), false)
})
