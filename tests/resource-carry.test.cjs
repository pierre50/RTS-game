const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadResourceCarry() {
  const filename = path.join(__dirname, '../app/lib/resourceCarry.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mockRequire = id => {
    if (id === '../constants') {
      return {
        BUILDING_TYPES: { townCenter: 'TownCenter' },
        FAMILY_TYPES: { building: 'building' },
        LOADING_FOOD_TYPES: ['meat', 'wheat', 'berry'],
        RESOURCE_STOCKPILE_TYPES: {
          tree: 'wood',
          berrybush: 'food',
          wheat: 'food',
          stone: 'stone',
          gold: 'gold',
          copper: 'copper',
          iron: 'iron',
        },
      }
    }
    if (id === './unitControl') return { isHeroControlled: unit => unit.controlMode === 'hero' }
    return require(id)
  }
  new Function('module', 'exports', 'require', code)(module, module.exports, mockRequire)
  return module.exports
}

const { addCarriedResource, getDisplayedCarriedResourceEntries } = loadResourceCarry()

test('hero display keeps food and iron as separate carried resources', () => {
  const hero = {
    controlMode: 'hero',
    loading: 10,
    loadingType: 'wheat',
  }

  addCarriedResource(hero, 'iron', 1)

  assert.deepEqual(hero.resourceLoads, { wheat: 10, iron: 1 })
  assert.equal(hero.loading, 11)
  assert.equal(hero.loadingType, 'iron')
  assert.deepEqual(getDisplayedCarriedResourceEntries(hero), [
    ['food', 10],
    ['iron', 1],
  ])
})
