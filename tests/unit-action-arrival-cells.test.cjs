const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')

function loadActionArrivalCells(interiors = {}) {
  const filename = path.join(__dirname, '../app/classes/unit/movement/UnitActionArrivalCells.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })
  const constants = {
    ACTION_TYPES: { delivery: 'delivery', train: 'train' },
    FAMILY_TYPES: { building: 'building' },
  }
  const localRequire = request => {
    request = request.replace(/^\.\.\/\.\.\/\.\.\//, '../../')
    if (request === '../../constants') return constants
    if (request === '../../lib/mapSpaces') return { getEntitySpaceMapLike: unit => unit?.context?.map ?? null }
    if (request === '../../lib/buildings/interiors') {
      return {
        getBuildingEntryCell: interiors.getBuildingEntryCell ?? (() => null),
        getBuildingInteriorEntryCell: interiors.getBuildingInteriorEntryCell ?? (() => null),
        isBuildingInteriorSupported: interiors.isBuildingInteriorSupported ?? (() => false),
      }
    }
    throw new Error(`Unexpected require: ${request}`)
  }
  const module = { exports: {} }
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return { ...module.exports, constants }
}

test('training arrival uses the building entry cell even when the building has no interior', () => {
  const entryCell = { i: 6, j: 7 }
  const interiorCell = { i: 9, j: 9 }
  const { getActionArrivalCell, constants } = loadActionArrivalCells({
    getBuildingEntryCell: () => entryCell,
    getBuildingInteriorEntryCell: () => interiorCell,
    isBuildingInteriorSupported: () => false,
  })
  const unit = { context: { map: { grid: [] } } }
  const building = { family: constants.FAMILY_TYPES.building, i: 5, isBuilt: true, j: 5, type: 'Barracks' }

  assert.equal(getActionArrivalCell(unit, building, constants.ACTION_TYPES.train), entryCell)
  assert.equal(getActionArrivalCell(unit, building, constants.ACTION_TYPES.delivery), interiorCell)
  assert.equal(getActionArrivalCell(unit, building, null), entryCell)
})
