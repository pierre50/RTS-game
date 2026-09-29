const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function loadMarker() {
  const shapes = []
  const module = loadTsModule('app/lib/ui/InteractionCellMarker.ts', {
    mocks: {
      '../../constants': {
        COLOR_GOLD: 0xffd45a,
        COMM_INDICATOR_FILL_ALPHA: 0.15,
        COMM_INDICATOR_STROKE_ALPHA: 0.55,
        COMM_INDICATOR_STROKE_WIDTH: 2,
      },
      '../../lib': {
        cartesianToIsometric: (i, j) => [i * 10, j * 10],
        drawRoundedIsoShape: (_layer, points) => shapes.push(points),
        getRoundedIsoShapePoints: options => options,
      },
    },
  })
  return { ...module, shapes }
}

function makeLayer() {
  return {
    fill: () => {},
    stroke: () => {},
  }
}

test('interaction cell marker follows the rendered cell position on relief', () => {
  const { drawInteractionCellMarker, shapes } = loadMarker()

  drawInteractionCellMarker(makeLayer(), { i: 4, j: 6, x: 100, y: 168 }, 0.5)

  assert.deepEqual(shapes, [{ x: 100, y: 168, factor: 1 }])
})

test('interaction cell marker falls back to isometric coordinates for lightweight cells', () => {
  const { drawInteractionCellMarker, shapes } = loadMarker()

  drawInteractionCellMarker(makeLayer(), { i: 4, j: 6 }, 0.5)

  assert.deepEqual(shapes, [{ x: 40, y: 60, factor: 1 }])
})
