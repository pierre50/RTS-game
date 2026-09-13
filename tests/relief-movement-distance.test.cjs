const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { point, reliefMap } = require('./helpers/reliefFixture.cjs')
const { getReliefLevelAtPoint: height } = loadTsModule('app/lib/terrain/reliefSurface.ts')
const { getReliefMovementDistance: distance } = loadTsModule('app/lib/terrain/reliefMovement.ts')

function traverse(map, start, target, budget) {
  let p = { ...start },
    ticks = 0,
    slopeTicks = 0
  while (Math.hypot(target.x - p.x, target.y - p.y) > 1e-5 && ticks++ < 2000) {
    const total = Math.hypot(target.x - p.x, target.y - p.y)
    const step = distance(map, p, target, budget)
    assert.ok(step > 0 && step <= budget + 1e-9)
    const next = { x: p.x + ((target.x - p.x) / total) * step, y: p.y + ((target.y - p.y) / total) * step }
    const rise = 16 * (height(map, next) - height(map, p))
    assert.ok(Math.hypot(next.x - p.x, next.y - p.y - rise) <= budget + 0.001)
    if (Math.abs(rise) > 0.1) slopeTicks++
    p = next
  }
  assert.ok(ticks < 2000)
  return { ticks, slopeTicks }
}

for (const axis of ['i', 'j'])
  test(`both directions across the ${axis} front face slow without bursts`, () => {
    const map = reliefMap((i, j) => ((axis === 'i' ? i : j) < 4 ? 1 : 0))
    const top = { x: 0, y: 118 },
      bottom = { x: 0, y: 138 }
    assert.ok(traverse(map, top, bottom, 1.5).slopeTicks >= 10)
    assert.ok(traverse(map, bottom, top, 1.5).slopeTicks >= 10)
    for (const direction of [-1, 1]) {
      const p = { x: 0, y: 130 }
      const step = distance(map, p, { x: 0, y: 130 + direction * 10 }, 0.5)
      const next = { x: 0, y: 130 + direction * step }
      const visible = Math.abs(next.y - 16 * height(map, next) - (p.y - 16 * height(map, p)))
      assert.ok(visible > 0.295 && visible <= 0.301)
    }
  })

test('contour travel on all four faces preserves both height and full speed', () => {
  for (const axis of ['i', 'j'])
    for (const sign of [-1, 1]) {
      const map = reliefMap((i, j) => (sign * ((axis === 'i' ? i : j) - 4) > 0 ? 1 : 0))
      const normal = 4 + (sign < 0 ? 4 / 64 : -1.5 / 64)
      const start = axis === 'i' ? point(normal, 4) : point(4, normal)
      const end = axis === 'i' ? point(normal, 6) : point(6, normal)
      assert.ok(height(map, start) > 0 && height(map, start) < 1)
      assert.ok(Math.abs(height(map, start) - height(map, end)) < 1e-9)
      assert.ok(Math.abs(distance(map, start, end, 20) - 20) < 1e-9)
    }
})

test('crossing a whole ridge costs movement even with equal endpoint heights', () => {
  const map = reliefMap((i, j) => (i >= 4 && i <= 8 && j >= 4 && j <= 8 ? 1 : 0))
  const a = { x: 0, y: 64 },
    b = { x: 0, y: 336 }
  assert.equal(height(map, a), height(map, b))
  assert.ok(distance(map, a, b, 272) < 272)
  for (const budget of [0.5, 3, 8]) {
    traverse(map, a, b, budget)
    traverse(map, b, a, budget)
  }
})

test('flat ground and short final steps retain their exact budgets', () => {
  const map = reliefMap(() => 0),
    p = point(4, 4)
  assert.equal(distance(map, p, { x: p.x + 30, y: p.y + 40 }, 1.5), 1.5)
  assert.ok(Math.abs(distance(map, p, { x: p.x + 0.1, y: p.y }, 1.5) - 0.1) < 1e-9)
  assert.equal(distance(map, p, p, 1.5), 0)
})
