const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { point, reliefMap } = require('./helpers/reliefFixture.cjs')
const { getReliefLevelAtPoint: height } = loadTsModule('app/lib/terrain/reliefSurface.ts')
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)

test('front faces soften beyond the painted band while rear faces keep their profile', () => {
  const front = reliefMap(i => (i < 4 ? 1 : 0))
  near(height(front, point(4 - 0.5 / 64, 4)), 1)
  assert.ok(height(front, point(4 + 1 / 64, 4)) < 1)
  near(height(front, point(4 + 4 / 64, 4)), 0.5)
  assert.ok(height(front, point(4 + 7 / 64, 4)) > 0)
  near(height(front, point(4 + 8.5 / 64, 4)), 0)
  near(height(front, point(4.25, 4)), 0)
  const back = reliefMap(i => (i > 4 ? 1 : 0))
  near(height(back, point(3.55, 4)), 0)
  near(height(back, point(4 - 1.5 / 64, 4)), 0.5)
  near(height(back, point(4.45, 4)), 1)
})

test('sprite colour, frame and display offset cannot change physical height', () => {
  const map = reliefMap(i => (i < 4 ? 1 : 0))
  const p = point(4.06, 4)
  const expected = height(map, p)
  for (const row of map.grid)
    for (const cell of row) {
      cell.y -= 80
      cell.inclined = true
      cell._terrainAppearance = { relief: { index: 18, elevation: 8 } }
    }
  near(height(map, p), expected)
  near(height(map, p, map.grid[2][2]), expected)
  near(height(map, p, map.grid[6][6]), expected)
})

test('a complete plateau has no rebound on its south corners and no reversed rear projection', () => {
  const map = reliefMap((i, j) => (i >= 4 && i <= 8 && j >= 4 && j <= 8 ? 1 : 0))
  // Includes the reproduced 016/010 seam at x=-21, y=282.4.
  for (let x = -180; x <= 180; x += 3) {
    let previous = height(map, { x, y: 64 })
    let descending = false
    for (let y = 64.25; y <= 336; y += 0.25) {
      const h = height(map, { x, y })
      assert.ok(y - 16 * h > y - 0.25 - 16 * previous, `reversed projection at ${x},${y}`)
      if (h < previous - 1e-12) descending = true
      if (descending) assert.ok(h <= previous + 1e-12, `rebound at ${x},${y}`)
      previous = h
    }
  }
})

test('corners and crossings remain continuous across every ownership boundary', () => {
  for (let mask = 0; mask < 16; mask++) {
    const map = reliefMap((i, j) => (mask >> ((i >= 6 ? 2 : 0) + (j >= 6 ? 1 : 0))) & 1)
    for (let k = 4; k <= 8; k += 0.125)
      for (const edge of [4.5, 5.5, 6.5, 7.5]) {
        assert.ok(Math.abs(height(map, point(edge - 1e-7, k)) - height(map, point(edge + 1e-7, k))) < 1e-5)
        assert.ok(Math.abs(height(map, point(k, edge - 1e-7)) - height(map, point(k, edge + 1e-7))) < 1e-5)
      }
  }
})

test('negative and fractional elevations preserve their actual levels', () => {
  const map = reliefMap(i => (i < 4 ? -1.5 : -2))
  near(height(map, point(4 + 4 / 64, 4)), -1.75)
  near(height(null, point(4, 4), { i: 4, j: 4, z: -2 }), -2)
  near(height({ grid: [] }, point(4, 4)), 0)
})
