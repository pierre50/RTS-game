const test = require('node:test')
const assert = require('node:assert/strict')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { minimapTerrainSampling, terrainSampleKey } = loadTsModule('app/ui/minimap/MinimapTerrainSampling.ts')

function transform(zoom, center = 3750) {
  const factor = 80 / zoom
  return {
    size: 7500,
    factor,
    offsetX: -600 * factor,
    offsetY: center * 32 - 600 * factor,
    translate: 0,
    canvasWidth: 1200,
    canvasHeight: 1200,
  }
}

test('zoom samples fewer visible cells at finer detail with a bounded rendering budget', () => {
  const overview = minimapTerrainSampling(transform(1))
  let previous = overview.step
  for (const zoom of [1.5, 2, 3, 4]) {
    const plan = minimapTerrainSampling(transform(zoom))
    assert.ok(plan.step < previous)
    assert.ok(plan.maxI - plan.minI < overview.maxI - overview.minI)
    const countI = Math.floor((plan.maxI - plan.minI) / plan.step) + 1
    const countJ = Math.floor((plan.maxJ - plan.minJ) / plan.step) + 1
    assert.ok(countI * countJ <= 256 * 256)
    previous = plan.step
  }
})

test('sampling remains aligned and bounded near map edges and reaches individual cells', () => {
  for (const center of [0, 1, 3750, 7499, 7500]) {
    const plan = minimapTerrainSampling(transform(4, center))
    assert.ok(plan.minI >= 0 && plan.minJ >= 0)
    assert.ok(plan.maxI <= 7500 && plan.maxJ <= 7500)
    assert.equal(plan.minI % plan.step, 0)
    assert.equal(plan.minJ % plan.step, 0)
  }
  const close = minimapTerrainSampling({ ...transform(4), factor: 1 })
  assert.equal(close.step, 1)
  assert.notEqual(terrainSampleKey(100, 100, 5), terrainSampleKey(100, 100, 10))
  assert.equal(terrainSampleKey(100, 100, 5), terrainSampleKey(104, 104, 5))
})

test('terrain density scales with displayed size and pixel density, with a hard upper budget', () => {
  const plan = (width, pixelRatio = 1) => minimapTerrainSampling(transform(1), { width, height: width, pixelRatio })
  assert.ok(plan(180).step > plan(600).step)
  assert.ok(plan(600).step > plan(600, 2).step)
  assert.deepEqual(plan(600, 2), plan(600, 4), 'retina sampling is capped at 2x')
  const huge = plan(4000, 4)
  const countI = Math.floor((huge.maxI - huge.minI) / huge.step) + 1
  const countJ = Math.floor((huge.maxJ - huge.minJ) / huge.step) + 1
  assert.ok(countI * countJ <= 512 * 512)
  assert.deepEqual(plan(0), minimapTerrainSampling(transform(1)), 'hidden containers use a safe fallback')
  assert.deepEqual(plan(NaN), minimapTerrainSampling(transform(1)))
})

test('display-aware sampling retains aligned buckets and increases detail with zoom', () => {
  for (const width of [180, 300, 600, 1200]) {
    const display = { width, height: width, pixelRatio: 2 }
    const overview = minimapTerrainSampling(transform(1), display)
    const zoomed = minimapTerrainSampling(transform(4), display)
    assert.ok(zoomed.step < overview.step)
    assert.equal(zoomed.minI % zoomed.step, 0)
    assert.equal(zoomed.minJ % zoomed.step, 0)
  }
})


test('isometric viewport culling rejects offscreen corners without dropping onscreen sample centers', () => {
  const { minimapSampleIntersectsViewport } = loadTsModule('app/ui/minimap/MinimapTerrainSampling.ts')
  const view = transform(4)
  const plan = minimapTerrainSampling(view)
  let total = 0
  let drawn = 0
  for (let i = plan.minI; i <= plan.maxI; i += plan.step) {
    for (let j = plan.minJ; j <= plan.maxJ; j += plan.step) {
      total++
      const visible = minimapSampleIntersectsViewport(i, j, plan.step, view)
      if (visible) drawn++
      const x = ((i - j) * 32 - view.offsetX) / view.factor
      const y = ((i + j) * 16 - view.offsetY) / view.factor
      if (x >= 0 && x <= view.canvasWidth && y >= 0 && y <= view.canvasHeight) assert.equal(visible, true)
    }
  }
  assert.ok(drawn < total * 0.65, `${drawn} drawn out of ${total}`)
})

