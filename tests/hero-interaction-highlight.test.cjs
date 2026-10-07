const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

test('the interaction contour follows the target and is removed when interaction ends', () => {
  const graphics = []
  class Graphics {
    constructor() {
      graphics.push(this)
    }
    clear() {
      return this
    }
    fill() {
      return this
    }
    stroke() {
      return this
    }
    destroy() {
      this.destroyed = true
    }
  }
  const { HeroInteractionHighlight } = loadTsModule('app/services/HeroInteractionHighlight.ts', {
    mocks: {
      'pixi.js': { Graphics },
      '../lib/contact/contactGeometry': { getContactTargetShape: target => [target] },
      '../lib/graphics/isoFootprint': {
        drawRoundedIsoShape: (graphic, points) => {
          graphic.points = points
        },
      },
    },
  })
  const parent = {
    addChild(graphic) {
      graphic.parent = this
    },
  }
  const first = { parent, x: 0, y: 0, zIndex: 10 }
  const second = { parent, x: 40, y: 0, zIndex: 20 }
  const highlight = new HeroInteractionHighlight()
  highlight.update(first)
  highlight.update(second)
  assert.equal(graphics.length, 1)
  assert.deepEqual(graphics[0].points, [second])
  assert.equal(graphics[0].eventMode, 'none')
  highlight.update(null)
  assert.equal(graphics[0].destroyed, true)
  highlight.update(first)
  first.visible = false
  highlight.update(first)
  assert.equal(graphics[1].destroyed, true)
})
