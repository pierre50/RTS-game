const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadSelection() {
  const mocks = {
    'pixi.js': {
      Graphics: class {
        constructor() {
          this.alpha = 1
          this.label = ''
          this.position = { y: 0 }
        }
        closePath() {}
        lineTo() {}
        moveTo() {}
        stroke() {}
      },
    },
    '../../constants': {
      COLOR_GREEN: 0x00ff00,
      LABEL_TYPES: { selection: 'selection' },
    },
    '../grid/cells': {
      getBuildingFootprintCells: () => [],
    },
  }
  return loadTsModule('app/lib/graphics/selection.ts', { mocks })
}

test('blinking selection marker tracks visual relief lift', () => {
  const { drawInstanceBlinkingSelection } = loadSelection()
  const children = []
  const instance = {
    reliefLift: -24,
    selectionFactor: 0.5,
    addChildAt(child, index) {
      children.splice(index, 0, child)
    },
    removeChild(child) {
      const index = children.indexOf(child)
      if (index >= 0) children.splice(index, 1)
    },
  }

  drawInstanceBlinkingSelection(instance)

  assert.equal(children[0].position.y, -24)
})
