const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

const { getTerrainBakeChunkRects } = loadTsModule('app/lib/graphics/terrainBakeChunks.ts')

test('terrain bake chunks snap to integer pixels and overlap adjacent chunks', () => {
  const rects = getTerrainBakeChunkRects({ minX: -12.4, minY: 7.25, width: 80.2, height: 251.5 }, 100)

  assert.ok(rects.length > 1)
  for (const rect of rects) {
    assert.equal(Number.isInteger(rect.minX), true)
    assert.equal(Number.isInteger(rect.minY), true)
    assert.equal(Number.isInteger(rect.width), true)
    assert.equal(Number.isInteger(rect.height), true)
    assert.ok(rect.width <= 100)
    assert.ok(rect.height <= 100)
  }

  const yRects = [...new Map(rects.map(rect => [`${rect.minY}:${rect.height}`, rect])).values()].sort(
    (a, b) => a.minY - b.minY
  )

  for (let index = 1; index < yRects.length; index++) {
    const previousMaxY = yRects[index - 1].minY + yRects[index - 1].height
    assert.ok(yRects[index].minY < previousMaxY)
  }
})
