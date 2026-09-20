const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function applyRelief(mapType) {
  const slope = { width: 65, height: 17 }
  class Sprite {
    constructor(texture) {
      this.texture = texture
      this.anchor = { set() {} }
    }
  }
  const { CellTerrain } = loadTsModule('app/classes/cell/CellTerrain.ts', {
    mocks: {
      'pixi.js': { Sprite, Assets: {} },
      '../../lib': { parseTextureRef: () => ({ sheet: 'terrain/dirt' }), getTextureByFrame: () => slope },
    },
  })
  const cell = {
    context: { map: { mapType } },
    sprite: new Sprite({ width: 65, height: 33 }),
    terrainTextureName: 'terrain/dirt:0',
    children: [],
    y: 100,
    _terrainAppearance: {},
    addChild(child) {
      this.children.push(child)
    },
  }
  new CellTerrain(cell).setReliefBorder(13, 8)
  assert.equal(cell.sprite.texture, slope)
  assert.equal(cell.y, 92)
  assert.equal(cell.inclined, true)
  return cell
}

test('interior slopes have no flat tile protruding underneath', () => {
  assert.equal(applyRelief('interior').children.length, 0)
})

test('outdoor slopes keep their fog backfill', () => {
  const cell = applyRelief('world-region')
  assert.equal(cell.children.length, 1)
  assert.equal(cell.children[0].type, 'reliefUnderlay')
  assert.equal(cell.children[0].y, 8)
})
