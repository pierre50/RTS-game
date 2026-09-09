const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const {
  MapBlueprintLoadError,
  loadPregeneratedInteriorBlueprint: interior,
  loadPregeneratedWorldMapBlueprint: world,
} = loadTsModule('app/serialization/MapBlueprintLoader.ts')
const { toGrid } = loadTsModule('app/serialization/MapBlueprintDecoding.ts')
const encoded = values => Buffer.from(values).toString('base64')
const terrain = encoded([0, 6, 99, 1])
const relief = encoded([0, 255, 1, 2])
const basePayload = { format: 'map-blueprint', version: 1, kind: 'interior', size: 1, terrain, relief }
const blueprint = { id: 'room', path: 'room.map', size: 1, buildingSize: 3 }
const mapping = { id: 'stable', legacyId: 'old-stable', blueprintId: 'room', buildingSize: 3, buildingType: 'Stable' }
const compact = { blueprints: [blueprint], buildingTypes: [mapping] }
const legacy = { interiors: [{ ...blueprint, interiorType: 'Stable', legacyId: 'old-room' }] }
const worldManifest = { maps: [{ id: 'region', path: 'region.map', size: 1, region: { x: 0, y: 0 } }] }

async function withFetch(manifest, payload, run, failure = {}) {
  const saved = global.fetch
  global.fetch = async path => {
    const isManifest = path.endsWith('manifest.json')
    if (isManifest && failure.manifestFetch) throw failure.manifestFetch
    if (!isManifest && failure.mapFetch) throw failure.mapFetch
    const status = isManifest ? failure.manifestStatus : failure.mapStatus
    return {
      ok: !status,
      status: status ?? 200,
      json: async () => {
        const error = isManifest ? failure.manifestJson : failure.mapJson
        if (error) throw error
        return isManifest ? manifest : payload
      },
    }
  }
  try {
    return await run()
  } finally {
    global.fetch = saved
  }
}
const reason = expected => error => error instanceof MapBlueprintLoadError && error.reason === expected
const loadWorld = () => world({ worldId: 'test', worldRegionId: 'region', size: 1 })

test('world payload decoding preserves signed relief, terrain aliases and optional entities', async () => {
  const payload = {
    ...basePayload,
    id: 42,
    seed: 'seed',
    mapType: 'custom',
    spawns: [{ i: 0, j: 0 }],
    resources: [],
    settlements: [],
    banditCampPositions: [],
  }
  const result = await withFetch(worldManifest, payload, loadWorld)
  assert.equal(result.id, 42)
  assert.equal(result.seed, 'seed')
  assert.equal(result.mapType, 'custom')
  assert.deepEqual(result.terrain, [
    ['Grass', 'Water'],
    ['Grass', 'Desert'],
  ])
  assert.deepEqual(result.relief, [
    [0, -1],
    [1, 2],
  ])
  assert.deepEqual(result.spawns, payload.spawns)
  const fallback = await withFetch(
    { maps: [{ ...worldManifest.maps[0], id: undefined }] },
    { ...basePayload, id: {}, seed: 17 },
    () => world({ worldId: 'test', size: 1 })
  )
  assert.equal(fallback.id, 'region.map')
  assert.equal(fallback.seed, 17)
})

test('loaders classify manifest transport, JSON and schema failures', async () => {
  for (const load of [loadWorld, () => interior()]) {
    for (const [failure, expected] of [
      [{ manifestFetch: new Error('offline') }, 'manifest-fetch-failed'],
      [{ manifestStatus: 503 }, 'manifest-fetch-failed'],
      [{ manifestJson: new Error('bad JSON') }, 'manifest-invalid'],
      [{ manifestFetch: new MapBlueprintLoadError('size-missing', 'known') }, 'size-missing'],
      [{ manifestJson: new MapBlueprintLoadError('size-missing', 'known') }, 'size-missing'],
    ])
      await assert.rejects(withFetch(compact, basePayload, load, failure), reason(expected))
    for (const manifest of [null, {}])
      await assert.rejects(withFetch(manifest, basePayload, load), reason('manifest-invalid'))
  }
  await assert.rejects(withFetch({ maps: [] }, basePayload, loadWorld), reason('no-compatible-map'))
})

test('world payload failures never produce a partial grid', async () => {
  for (const patch of [
    { format: 'wrong' },
    { version: 2 },
    { size: 2 },
    { terrain: encoded([0]) },
    { relief: encoded([0]) },
    { terrain: '!!!' },
  ]) {
    await assert.rejects(withFetch(worldManifest, { ...basePayload, ...patch }, loadWorld), reason('map-invalid'))
  }
  for (const [failure, expected] of [
    [{ mapStatus: 404 }, 'map-fetch-failed'],
    [{ mapJson: new Error('bad JSON') }, 'map-invalid'],
    [{ mapFetch: new Error('offline') }, 'map-invalid'],
  ]) {
    await assert.rejects(withFetch(worldManifest, basePayload, loadWorld, failure), reason(expected))
  }
  assert.throws(() => toGrid(new Uint8Array(1), 1, value => value), { name: 'MapBlueprintLoadError', reason: 'map-invalid' })
})

test('interior selection supports compact ids, legacy ids and size fallbacks', async () => {
  for (const options of [
    { id: 'stable' },
    { id: 'old-stable' },
    { id: 'room' },
    { buildingSize: 3, buildingType: 'stable', random: () => 0 },
    { buildingSize: 3, buildingType: 'Unknown', random: () => 0 },
  ]) {
    const result = await withFetch(compact, basePayload, () => interior(options))
    assert.equal(result.size, 1)
    assert.deepEqual(result.relief, [
      [0, -1],
      [1, 2],
    ])
  }
  for (const options of [
    { id: 'room' },
    { id: 'old-room' },
    { interiorType: 'stable', buildingSize: 3, random: () => 0 },
    {},
  ]) {
    const result = await withFetch(legacy, basePayload, () => interior(options))
    assert.equal(result.interiorType, options.interiorType || 'Stable')
  }
  const fallback = await withFetch({ interiors: [{ path: 'fallback.map', size: 1 }] }, basePayload, () => interior())
  assert.equal(fallback.id, 'fallback.map')
  const missingMapping = { blueprints: [blueprint], buildingTypes: [{ ...mapping, blueprintId: 'missing' }] }
  assert.equal((await withFetch(missingMapping, basePayload, () => interior({ buildingSize: 3 }))).id, 'room')
})

test('interiors reject absent selections and invalid random selection indexes', async () => {
  for (const [manifest, options, expected] of [
    [compact, { id: 'missing' }, 'blueprint-id-missing'],
    [compact, { buildingSize: 8 }, 'no-compatible-map'],
    [legacy, { interiorType: 'Temple' }, 'no-compatible-map'],
    [{ interiors: [] }, {}, 'no-compatible-map'],
    [compact, { random: () => 1 }, 'no-compatible-map'],
  ])
    await assert.rejects(
      withFetch(manifest, basePayload, () => interior(options)),
      reason(expected)
    )
})

test('interior masks and metadata survive decoding without sharing signed terrain buffers', async () => {
  const payload = {
    ...basePayload,
    floorMask: encoded([1, 1, 0, 0]),
    borderMask: encoded([0, 1, 0, 1]),
    buildingSize: 4,
    seed: 99,
    interiorType: 'House',
    localGridLayout: { columns: 2, rows: 2 },
    spawns: [{ i: 0, j: 1 }],
    exits: [],
    resources: [],
    floorShape: { radius: 2 },
  }
  const result = await withFetch(compact, payload, () => interior({ id: 'room' }))
  assert.deepEqual(result.floorMask, [
    [1, 1],
    [0, 0],
  ])
  assert.deepEqual(result.borderMask, [
    [0, 1],
    [0, 1],
  ])
  assert.equal(result.buildingSize, 4)
  assert.equal(result.seed, 99)
  assert.equal(result.interiorType, 'House')
  assert.deepEqual(result.localGridLayout, payload.localGridLayout)
  assert.deepEqual(result.floorShape, payload.floorShape)
})

test('invalid interior dimensions, layers and JSON are rejected consistently', async () => {
  for (const patch of [
    { format: 'wrong' },
    { version: 2 },
    { kind: 'outside' },
    { size: -1 },
    { size: 1.5 },
    { size: 'invalid' },
    { terrain: null },
    { relief: undefined },
    { terrain: '!!!' },
    { relief: encoded([0]) },
    { floorMask: encoded([0]) },
    { borderMask: encoded([0]) },
  ]) {
    await assert.rejects(
      withFetch(compact, { ...basePayload, ...patch }, () => interior({ id: 'stable' })),
      reason('map-invalid')
    )
  }
  for (const [failure, expected] of [
    [{ mapStatus: 404 }, 'map-fetch-failed'],
    [{ mapJson: new Error('bad JSON') }, 'map-invalid'],
    [{ mapFetch: new Error('offline') }, 'map-invalid'],
  ]) {
    await assert.rejects(
      withFetch(compact, basePayload, () => interior({ id: 'stable' }), failure),
      reason(expected)
    )
  }
})
