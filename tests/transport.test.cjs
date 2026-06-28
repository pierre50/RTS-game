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

const constants = {
  ACTION_TYPES: {
    loadTransport: 'loadTransport',
  },
  FAMILY_TYPES: {
    unit: 'unit',
  },
  SHEET_TYPES: {
    standing: 'standingSheet',
    walking: 'walkingSheet',
  },
  UNIT_TYPES: {
    fishingBoat: 'FishingBoat',
  },
}

test('unloading a transported unit leaves it standing instead of walking', () => {
  const unloadedCell = {
    i: 3,
    j: 4,
    x: 30,
    y: 40,
    z: 2,
    category: 'Grass',
    solid: false,
    border: false,
    inclined: false,
    place(unit) {
      this.has = unit
    },
  }
  const unit = {
    isDead: false,
    isDestroyed: false,
    currentSheet: constants.SHEET_TYPES.walking,
    setTextures(sheet) {
      this.currentSheet = sheet
    },
  }
  const added = []
  const bucketed = []
  const transport = {
    i: 2,
    j: 2,
    context: {
      map: {
        grid: [],
        addChild: child => added.push(child),
        addToInstanceBucket: child => bucketed.push(child),
      },
    },
    transportedUnits: [unit],
  }
  const { unloadTransport } = loadModule('app/lib/transport.js', {
    '../constants': constants,
    './grid/cells': {
      getCellsAroundPoint: () => [unloadedCell],
    },
    './grid/movement': {
      getInstancePath: () => [],
    },
    './grid/visibility': {
      updateInstanceVisibility: () => {},
    },
    './maths': {
      getInstanceZIndex: () => 7,
      instancesDistance: () => 1,
    },
  })

  assert.equal(unloadTransport(transport), 1)
  assert.equal(unit.currentSheet, constants.SHEET_TYPES.standing)
  assert.equal(unit.loadedInTransport, null)
  assert.equal(unit.currentCell, unloadedCell)
  assert.equal(unloadedCell.has, unit)
  assert.deepEqual(transport.transportedUnits, [])
  assert.deepEqual(added, [unit])
  assert.deepEqual(bucketed, [unit])
})
