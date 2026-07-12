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

test('resource rally commands keep the spawned unit context', () => {
  const spawnCell = { i: 1, j: 1, category: 'Land', solid: false }
  const tree = { family: 'resource', category: 'Tree', type: 'Tree', isDestroyed: false }
  const rallyCell = { i: 2, j: 2, category: 'Land', solid: false, has: tree }
  const calls = []
  const unit = {
    sendToTree(target) {
      calls.push([this, target])
    },
    sendTo() {
      throw new Error('expected the resource-specific command')
    },
  }
  const building = {
    i: 0,
    j: 0,
    size: 1,
    rallyPoint: { i: 2, j: 2, direction: 0 },
    context: {
      map: {
        grid: [
          [null, null, null],
          [null, spawnCell, null],
          [null, null, rallyCell],
        ],
        randomItem: items => items[0],
      },
      menu: {},
    },
    owner: {
      population: 0,
      populationMax: 10,
      config: {
        units: {
          Villager: {},
        },
      },
      createUnit(options) {
        calls.push(['created', options])
        return unit
      },
      isPlayed: false,
    },
  }
  const { BuildingProduction } = loadModule('app/classes/building/BuildingProduction.ts', {
    'pixi.js': { Assets: {} },
    '../../constants': {
      ACTION_TYPES: {},
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        resource: 'resource',
        unit: 'unit',
      },
      LABEL_TYPES: {},
      MENU_INFO_IDS: { populationText: 'populationText' },
      PLAYER_TYPES: {},
      POPULATION_MAX: 200,
    },
    '../../lib': {
      canAfford: () => true,
      changeSpriteColorDirectly: () => {},
      getActionCondition: () => false,
      getBuildingAsset: () => null,
      getFreeCellAroundPoint: () => spawnCell,
      getTexture: () => null,
      payCost: () => {},
      refundCost: () => {},
    },
    '../../lib/lang': {
      t: key => key,
    },
  })

  assert.equal(new BuildingProduction(building).placeUnit('Villager'), true)

  assert.equal(calls[0][0], 'created')
  assert.deepEqual(calls[0][1], { i: 1, j: 1, type: 'Villager' })
  assert.deepEqual(calls[1], [unit, tree])
})
