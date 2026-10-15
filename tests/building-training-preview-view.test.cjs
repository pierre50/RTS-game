const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('training preview attaches to the Pixi building container', () => {
  class Container {
    children = []
    parent = null
    addChild(child) {
      this.children.push(child)
      child.parent = this
      return child
    }
    removeChild(child) {
      this.children.splice(this.children.indexOf(child), 1)
      child.parent = null
      return child
    }
    destroy() { this.destroyed = true }
  }
  const { BuildingTrainingPreview } = loadTsModule('app/rendering/pixi/PixiBuildingTrainingPreview.ts', {
    mocks: {
      'pixi.js': { Container, AnimatedSprite: class {}, Assets: {}, ColorMatrixFilter: class {}, Graphics: class {} },
      '../../constants': {
        BUILDING_TYPES: { barracks: 'Barracks', archeryRange: 'ArcheryRange', temple: 'Temple', stable: 'Stable' },
      },
      '../../lib': {},
      '../../lib/lpc': {},
      '../../lib/hero/mountedRider': {},
      '../../lib/horses/horseColors': {},
      '../../classes/building/BuildingTrainingPreviewAssets': {},
    },
  })
  const building = { type: 'Barracks', owner: { isPlayed: false } }
  const host = new Container()
  const preview = new BuildingTrainingPreview(building, host)
  assert.equal(host.children[0], preview.container)
  preview.update()
  assert.equal(preview.container.visible, false)
  preview.destroy()
  assert.equal(host.children.length, 0)
  assert.equal(preview.container.destroyed, true)
})
