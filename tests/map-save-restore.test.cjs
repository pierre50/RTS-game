const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadMapSaveRestore() {
  const filename = path.join(__dirname, '../app/classes/map/MapSaveRestore.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === '../../constants') {
      return {
        FAMILY_TYPES: { building: 'building', unit: 'unit' },
        PLAYER_TYPES: { ai: 'AI' },
      }
    }
    return require(id)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
  return module.exports
}

const { restorePlayerEntitiesFromSave } = loadMapSaveRestore()

test('restoring player entities preserves saved unit types instead of applying new-game hero promotion', () => {
  const createUnitCalls = []
  const player = {
    createBuilding(options) {
      return options
    },
    createUnit(options, creationOptions) {
      createUnitCalls.push({ options, creationOptions })
      return { ...options }
    },
  }

  restorePlayerEntitiesFromSave(player, {
    buildings: [{ i: 1, j: 2, type: 'House' }],
    units: [{ i: 3, j: 4, type: 'Villager' }],
    corpses: [{ i: 5, j: 6, type: 'Fantassin', currentSheet: 'corpse' }],
  })

  assert.deepEqual(player.buildings, [{ i: 1, j: 2, type: 'House', skipBuiltEffects: true }])
  assert.equal(player.units[0].type, 'Villager')
  assert.equal(player.corpses[0].type, 'Fantassin')
  assert.equal(createUnitCalls[0].options.suppressCreateSound, true)
  assert.equal(createUnitCalls[1].options.suppressCreateSound, true)
  assert.deepEqual(createUnitCalls.map(call => call.creationOptions), [{ preserveType: true }, { preserveType: true }])
})
