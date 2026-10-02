const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')

function fixture() {
  const maps = ['a', 'b', 'c'].map((id, y) => ({ id, region: { x: 0, y }, size: 2, path: `${id}.map` }))
  const payload = {
    format: 'map-blueprint',
    version: 1,
    size: 2,
    terrain: Buffer.alloc(9).toString('base64'),
    relief: Buffer.alloc(9).toString('base64'),
  }
  const requests = []
  let failPath = null
  return {
    requests,
    fail(path) {
      failPath = path
    },
    async fetch(path) {
      requests.push(path)
      if (path.endsWith(failPath)) return { ok: false, status: 503 }
      return { ok: true, json: async () => (path.endsWith('manifest.json') ? { maps } : payload) }
    },
  }
}

test('region loads cache only requested maps within one session', async () => {
  const previousFetch = global.fetch
  const data = fixture()
  global.fetch = data.fetch
  try {
    const { loadPregeneratedWorldMapBlueprint: load } = loadTsModule('app/serialization/blueprint/MapBlueprintLoader.ts')
    const cache = new Map()
    const options = { size: 2, worldId: 'test' }
    const [a, b] = await Promise.all([
      load({ ...options, worldRegionId: 'a' }, cache),
      load({ ...options, worldRegionId: 'b' }, cache),
    ])
    assert.equal(data.requests.filter(path => path.endsWith('.map')).length, 2)
    assert.equal(a.visualNeighbors, undefined)
    assert.equal(b.visualNeighbors, undefined)
    const repeated = await load({ ...options, worldRegionId: 'a' }, cache)
    assert.equal(repeated.terrain, a.terrain)
    assert.equal(cache.size, 2)
    assert.ok(a.timings.blueprintManifestFetch >= 0)
    await load({ ...options, worldRegionId: 'b' }, new Map())
    assert.equal(
      data.requests.filter(path => path.endsWith('.map')).length,
      3,
      'new sessions must reload regenerated files'
    )
  } finally {
    global.fetch = previousFetch
  }
})

test('failed requested map fetches are evicted and can be retried', async () => {
  const previousFetch = global.fetch
  const data = fixture()
  global.fetch = data.fetch
  try {
    const { loadPregeneratedWorldMapBlueprint: load } = loadTsModule('app/serialization/blueprint/MapBlueprintLoader.ts')
    const options = { size: 2, worldId: 'test', worldRegionId: 'a' }
    const cache = new Map()
    data.fail('a.map')
    await assert.rejects(load(options, cache), error => error.reason === 'map-fetch-failed')
    assert.equal(cache.size, 0)
    data.fail(null)
    const result = await load(options, cache)
    assert.equal(result.visualNeighbors, undefined)
    assert.equal(cache.size, 1)
    assert.equal(data.requests.filter(path => path.endsWith('a.map')).length, 2)
    assert.equal(data.requests.filter(path => path.endsWith('b.map')).length, 0)
  } finally {
    global.fetch = previousFetch
  }
})

test('world blueprint selection uses the chosen civilization village', () => {
  const { selectWorldMap } = loadTsModule('app/serialization/blueprint/WorldMapBlueprintSelection.ts')
  const manifest = {
    maps: [
      {
        id: 'world-4242-r1-1-black-forest',
        path: 'hellas.map',
        region: { x: 1, y: 1 },
        size: 144,
        settlements: [{ kind: 'village', civ: 'Hellas' }],
      },
      {
        id: 'world-4242-r0-2-temperate',
        path: 'nobatia.map',
        region: { x: 0, y: 2 },
        size: 144,
        settlements: [{ kind: 'village', civ: 'Nobatia' }],
      },
    ],
  }

  const selected = selectWorldMap(manifest, { playerCiv: 'Nobatia', size: 144 })

  assert.equal(selected.id, 'world-4242-r0-2-temperate')
})

test('a missing neighboring map does not prevent loading the current map', async () => {
  const previousFetch = global.fetch
  const data = fixture()
  data.fail('b.map')
  global.fetch = data.fetch
  try {
    const { loadPregeneratedWorldMapBlueprint: load } = loadTsModule('app/serialization/blueprint/MapBlueprintLoader.ts')
    const result = await load({ size: 2, worldId: 'test', worldRegionId: 'a' })
    assert.equal(result.worldRegionId, 'a')
    assert.deepEqual(data.requests, ['maps/worlds/test/manifest.json', 'maps/worlds/test/maps/a.map'])
  } finally {
    global.fetch = previousFetch
  }
})
