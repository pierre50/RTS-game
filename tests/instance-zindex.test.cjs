const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadMaths() {
  const filename = path.join(__dirname, '../app/lib/maths.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const module = { exports: {} }
  const mocks = {
    '../constants': {
      CELL_WIDTH: 64,
      CELL_HEIGHT: 32,
      CELL_DEPTH: 16,
      RELIEF_SPRITE_LIFT_PER_STEP: 16,
      FAMILY_TYPES: {
        animal: 'animal',
        building: 'building',
        unit: 'unit',
      },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports
}

const { cartesianToIsometric, getInstanceZIndex, getTerrainSetZIndex } = loadMaths()

function instanceAt(i, j, family, size = 1, z = 0) {
  const [x, flatY] = cartesianToIsometric(i, j)
  return {
    family,
    size,
    x,
    y: flatY - z * 16,
    z,
  }
}

test('units south of a building anchor render above the building', () => {
  const building = instanceAt(10, 10, 'building', 3)
  const unit = instanceAt(10, 11, 'unit')

  assert.ok(getInstanceZIndex(unit) > getInstanceZIndex(building))
})

test('building footprint size does not push its anchor in front of southern units', () => {
  const smallBuilding = instanceAt(10, 10, 'building', 1)
  const largeBuilding = instanceAt(10, 10, 'building', 3)

  assert.equal(getInstanceZIndex(largeBuilding), getInstanceZIndex(smallBuilding))
})

test('relief keeps the logical isometric draw depth stable', () => {
  const flatUnit = instanceAt(10, 10, 'unit', 1, 0)
  const raisedUnit = instanceAt(10, 10, 'unit', 1, 2)

  assert.equal(getInstanceZIndex(raisedUnit), getInstanceZIndex(flatUnit))
})

test('terrain sets render below units and animals on the same tile', () => {
  const cell = { i: 10, j: 10 }
  const unit = instanceAt(10, 10, 'unit')
  const animal = instanceAt(10, 10, 'animal')

  assert.ok(getTerrainSetZIndex(cell) < getInstanceZIndex(unit))
  assert.ok(getTerrainSetZIndex(cell) < getInstanceZIndex(animal))
})
