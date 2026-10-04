const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { drawMinimapRoads } = loadTsModule('app/ui/minimap/MinimapRoads.ts')
function setup() {
  const viewed = new Set(['1:1', '2:1'])
  const map = {
    roads: {
      version: 1,
      stride: 4,
      cells: [
        [5, 2],
        [9, 12],
        [10, 1],
      ],
    },
  }
  Object.defineProperty(map, 'grid', {
    get() {
      assert.fail('road drawing must not load terrain cells')
    },
  })
  const menu = { context: { map, player: { views: { isViewed: (i, j) => viewed.has(`${i}:${j}`) } } } }
  const geometry = {
    toMinimapX: (x, t) => (x - t.offsetX) / t.factor,
    toMinimapY: (y, t) => (y - t.offsetY) / t.factor,
  }
  const transform = { factor: 1, offsetX: 0, offsetY: 0, translate: 0, canvasWidth: 200, canvasHeight: 200 }
  const segments = [],
    strokes = []
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    moveTo(x, y) {
      this.start = [x, y]
    },
    lineTo(x, y) {
      segments.push([...this.start, x, y])
    },
    stroke() {
      strokes.push([this.strokeStyle, this.lineWidth])
    },
  }
  const draw = (space = 'outside') => drawMinimapRoads(menu, geometry, transform, space, context)
  return { map, viewed, transform, segments, strokes, draw }
}
test('minimap roads show only edges with both endpoints explored and add discoveries on redraw', () => {
  const h = setup()
  h.draw()
  assert.deepEqual(h.segments, [[0, 32, 32, 48]])
  h.segments.length = 0
  h.viewed.add('2:2')
  h.draw()
  assert.equal(h.segments.length, 2)
  h.segments.length = 0
  h.viewed.clear()
  h.draw()
  assert.equal(h.segments.length, 0)
})
test('terrain reveal shows the whole road network, while interiors and old saves show none', () => {
  const h = setup()
  h.viewed.clear()
  h.map.revealTerrain = true
  h.draw()
  assert.equal(h.segments.length, 2)
  h.segments.length = 0
  h.draw('interior:cave')
  assert.equal(h.segments.length, 0)
  delete h.map.roads
  h.draw()
  assert.equal(h.segments.length, 0)
})
test('road geometry follows zoom and pan while line widths stay readable; offscreen edges are culled', () => {
  const h = setup()
  h.draw()
  const widths = h.strokes.map(s => s[1])
  h.segments.length = h.strokes.length = 0
  Object.assign(h.transform, { factor: 0.5, offsetX: -10, offsetY: 20 })
  h.draw()
  assert.deepEqual(h.segments, [[20, 24, 84, 56]])
  assert.deepEqual(
    h.strokes.map(s => s[1]),
    widths
  )
  h.segments.length = 0
  h.transform.offsetX = 1000
  h.draw()
  assert.equal(h.segments.length, 0)
})
