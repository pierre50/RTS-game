const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { TerrainTextureCache } = loadTsModule('app/classes/map/terrain/TerrainTextureCache.ts')
const world = { minX: -10000, minY: -10000, width: 20000, height: 20000 }
const view = (x, y = 0, width = 90) => ({ visibleLeft: x, visibleTop: y, visibleWidth: width, visibleHeight: 90 })

function harness(budget = 120000) {
  let resident = 0
  let created = 0
  const cache = new TerrainTextureCache(
    world,
    (bounds, resolution) => {
      const bytes = bounds.width * bounds.height * resolution ** 2 * 4
      resident += bytes
      created++
      assert.ok(resident <= budget, 'peak allocation must respect the budget, including before eviction')
      return {
        renderable: true,
        destroy() {
          resident -= bytes
        },
      }
    },
    budget,
    100,
    0
  )
  return { cache, resident: () => resident, created: () => created }
}

test('long camera travel evicts GPU allocations before allocating and revisiting rebakes', () => {
  const h = harness()
  for (let x = 0; x < 9000; x += 100) {
    h.cache.update(view(x))
    assert.equal(h.cache.bytes, h.resident())
    assert.ok(h.cache.entries.size <= 3)
  }
  assert.equal(h.created(), 90)
  h.cache.update(view(0))
  assert.equal(h.created(), 91)
  h.cache.destroy()
  assert.equal(h.resident(), 0)
  h.cache.destroy()
  assert.equal(h.resident(), 0)
})

test('nearby cached terrain is reused and hidden outside the required view', () => {
  const h = harness()
  h.cache.update(view(0))
  const first = h.cache.entries.get('0:0')
  h.cache.update(view(100))
  assert.equal(first.handle.renderable, false)
  h.cache.update(view(0))
  assert.equal(first.handle.renderable, true)
  assert.equal(h.created(), 2)
  h.cache.update(view(50000))
  assert.ok([...h.cache.entries.values()].every(entry => !entry.handle.renderable))
})

test('zoom out reduces resolution to keep all required tiles within budget', () => {
  const h = harness()
  h.cache.update(view(0))
  h.cache.update(view(-100, -100, 700))
  assert.equal(h.cache.resolution, 0.5)
  assert.equal(h.cache.entries.size, 7)
  assert.equal(h.resident(), 70000)
  h.cache.update(view(0))
  assert.equal(h.cache.resolution, 1)
  assert.equal(h.resident(), 40000)
})

test('negative coordinates and edge crossing cover the full viewport', () => {
  const h = harness(200000)
  h.cache.update(view(-1, -1, 2))
  assert.deepEqual([...h.cache.entries.keys()].sort(), ['-1:-1', '-1:0', '0:-1', '0:0'])
})

test('failed tile creation is not retained and can be retried', () => {
  let fail = true
  const cache = new TerrainTextureCache(
    world,
    () => {
      if (fail) throw new Error('renderer failed')
      return { renderable: true, destroy() {} }
    },
    120000,
    100,
    0
  )
  assert.throws(() => cache.update(view(0)), /renderer failed/)
  assert.equal(cache.bytes, 0)
  fail = false
  cache.update(view(0))
  assert.equal(cache.entries.size, 1)
})
