const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const babel = require('@babel/core')
const { requireFromTsFile } = require('./helpers/loadTsModule.cjs')

function loadCellFog() {
  const filename = path.join(__dirname, '../app/classes/cell/CellFog.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { code } = babel.transformSync(source, {
    filename,
    presets: [['@babel/preset-env', { targets: { node: 'current' }, modules: 'commonjs' }], '@babel/preset-typescript'],
  })

  const module = { exports: {} }
  const mocks = {
    'pixi.js': {
      Assets: {},
      Sprite: { from: texture => ({ texture, anchor: { set() {} }, label: '', cullable: false }) },
      Texture: { from: canvas => ({ canvas }) },
    },
    '../../lib': {
      getBuildingAsset: () => ({ images: { final: '000_buildings/greek/house/multi-age' } }),
      getBuildingAssetOwner: () => ({}),
      getTexture: texture => texture,
      changeSpriteColorDirectly: (sprite, color) => {
        sprite.color = color
      },
      playerCanSeeInstance: () => false,
      updateInstanceRenderVisibility: instance => {
        instance.visible = false
      },
    },
    '../../constants': {
      COLOR_WHITE: 0xffffff,
      FAMILY_TYPES: { building: 'building' },
      LABEL_TYPES: { buildingFog: 'buildingFog' },
    },
  }
  const localRequire = request => (Object.hasOwn(mocks, request) ? mocks[request] : requireFromTsFile(request, filename, mocks))
  new Function('module', 'exports', 'require', code)(module, module.exports, localRequire)
  return module.exports.CellFog
}

test('fogged enemy buildings remember the last visible construction texture', () => {
  const CellFog = loadCellFog()
  const calls = []
  const cell = {
    context: {
      map: {
        revealTerrain: false,
        revealEverything: false,
        grid: [],
      },
      player: {},
    },
    i: 4,
    j: 5,
    x: 0,
    y: 0,
    visible: true,
    zIndex: 0,
    _hasFog: false,
    has: null,
    corpses: new Set(),
    fogSprites: [],
    addChild: child => child,
    addFogBuilding: (texture, color) => calls.push([texture, color]),
  }
  cell.context.map.grid[4] = []
  cell.context.map.grid[4][5] = cell

  const building = {
    family: 'building',
    type: 'House',
    i: 4,
    j: 5,
    textureName: '001_buildings/construction/size-2',
    owner: { isPlayed: false, color: 'red' },
  }

  new CellFog(cell).setFogChildren(building, false)

  assert.deepEqual(calls, [['001_buildings/construction/size-2', 'red']])
  assert.equal(building.visible, false)
})
