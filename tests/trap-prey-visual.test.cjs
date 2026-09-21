const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const cache = new Map()
  const point = () => ({
    copyFrom(other) {
      Object.assign(this, other)
    },
    set(value) {
      this.x = value
      this.y = value
    },
  })
  class Sprite {
    constructor(texture) {
      this.texture = texture
      this.anchor = point()
      this.position = point()
      this.scale = point()
    }
    destroy() {
      this.destroyed = true
      this.parent.children.splice(this.parent.children.indexOf(this), 1)
    }
  }
  const api = loadTsModule('app/lib/buildings/trapPreyVisual.ts', {
    mocks: { 'pixi.js': { Assets: { cache }, Sprite } },
  })
  const sprite = { position: { x: 0, y: -8 }, zIndex: 0 }
  const building = {
    containedAnimalType: 'Fox',
    sprite,
    children: [sprite],
    context: { map: { gaia: { config: { animals: require('../public/assets/data/gameplay/animals.json') } } } },
    addChildAt(child, index) {
      this.children.splice(index, 0, child)
      child.parent = this
    },
    getChildByLabel(label) {
      return this.children.find(child => child.label === label)
    },
  }
  const corpse = { defaultAnchor: { x: 0.5, y: 0.8 } }
  cache.set('animals/fox/dying', { textures: { 0: {}, 1: corpse } })
  return { ...api, building, corpse, cache }
}

test('a restored filled trap displays the corpse below its sprite without spawning an animal', () => {
  const { syncTrapPreyVisual, building, corpse } = fixture()
  syncTrapPreyVisual(building)
  const preview = building.children[0]
  assert.equal(preview.texture, corpse)
  assert.equal(building.children[1], building.sprite)
  assert.equal(preview.eventMode, 'none')
  assert.equal(preview.scale.x, 0.875)
  assert.equal(preview.anchor.y, 0.8)
  assert.equal(preview.position.y, -8)
  assert.ok(preview.zIndex < building.sprite.zIndex)
  syncTrapPreyVisual(building)
  assert.equal(building.children.length, 2)
  building.containedAnimalType = null
  syncTrapPreyVisual(building)
  assert.equal(preview.destroyed, true)
  assert.deepEqual(building.children, [building.sprite])
})

test('unloaded prey artwork is skipped and can be displayed when available', () => {
  const { syncTrapPreyVisual, building, cache, corpse } = fixture()
  cache.clear()
  syncTrapPreyVisual(building)
  assert.equal(building.children.length, 1)
  cache.set('animals/fox/dying', { textures: { 0: corpse } })
  syncTrapPreyVisual(building)
  assert.equal(building.children.length, 2)
  building.isDead = true
  syncTrapPreyVisual(building)
  assert.equal(building.children.length, 1)
})
