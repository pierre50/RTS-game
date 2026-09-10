const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const prepared = loadTsModule('app/classes/map/generation/PreparedMapContent.ts')
const { changeSpriteColorDirectly } = loadTsModule('app/lib/graphics/colors.ts', {
  mocks: { 'pixi.js': {}, 'pixi-filters': {} },
})
class NeutralPlayer {
  constructor(options) {
    Object.assign(this, options)
    this.buildings = []
  }
  createBuilding(options) {
    const texture = {},
      sprite = { texture }
    changeSpriteColorDirectly(sprite, this.color ?? '')
    assert.equal(sprite.texture, texture)
    this.buildings.push(options)
  }
}
const { placeCave } = loadTsModule('app/classes/map/generation/CaveGeneration.ts', {
  mocks: { '../../players': { Player: NeutralPlayer }, './PreparedMapContent': prepared },
})
test('runtime instantiates the offline choice exactly once without randomness', () => {
  const map = {
    mapType: 'world-region',
    random() {
      assert.fail('no runtime generation')
    },
  }
  const context = { players: [] }
  const placement = { i: 25, j: 32, id: 'world:cave-1', blueprintId: 'cave-large-loop', tier: 'large', seed: 42 }
  prepared.registerPreparedMapContent(map, { caves: [placement] })
  placeCave(map, context)
  placeCave(map, context)
  const { i, j, ...cave } = placement
  assert.equal(context.players.length, 1)
  assert.equal(context.players[0].diplomacy, 'neutral')
  assert.deepEqual(context.players[0].buildings, [{ i, j, cave, type: 'Cave', isBuilt: true }])
})
test('maps without a prepared cave and interiors do not generate caves', () => {
  const map = { mapType: 'world-region' },
    context = { players: [] }
  placeCave(map, context)
  map.mapType = 'interior'
  prepared.registerPreparedMapContent(map, { caves: [{ i: 1, j: 1 }] })
  placeCave(map, context)
  assert.equal(context.players.length, 0)
})
