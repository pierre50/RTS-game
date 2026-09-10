const assert = require('node:assert/strict')
const test = require('node:test')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { encodePreparedTerrain: encode, decodePreparedTerrain: decode } = loadTsModule(
  require.resolve('../app/serialization/PreparedTerrainCodec.ts')
)

test('terrain codec round-trips all visual fields and respects buffer slices', () => {
  const entries = [
    { i: 0, j: 0 },
    ...['Desert', 'DarkForest', 'Dirt', 'Jungle', 'Snow'].map((ground, i) => ({
      i,
      j: 5,
      ground,
      water: ['desert-sand-water-border', '254'],
      relief: ['000', 127.5],
      patches: ['north', 'south', 'east', 'west'],
    })),
    { i: 5, j: 0, relief: ['254', 0], water: ['desert-sand-water-border', '000'], patches: ['east'] },
  ]
  const bytes = encode(entries, 5)
  const padded = new Uint8Array(bytes.length + 12).fill(255)
  padded.set(bytes, 7)
  assert.deepEqual(decode(padded.subarray(7, 7 + bytes.length), 5), entries)
  assert.deepEqual(decode(encode([], 0), 0), [])
  assert.deepEqual(decode(encode([{ i: 65535, j: 65535 }], 65535), 65535), [{ i: 65535, j: 65535 }])
})

test('terrain encoding rejects values that would be silently truncated or wrapped', () => {
  for (const size of [-1, 0.5, NaN, Infinity, 65536]) {
    assert.throws(() => encode([], size), /Invalid prepared terrain/)
    assert.throws(() => decode(new Uint8Array(), size), /Invalid prepared terrain/)
  }
  for (const extra of [
    { i: -1 },
    { j: 6 },
    { i: 1.5 },
    { water: ['unknown', '000'] },
    { water: ['desert-sand-water-border', '255'] },
    { water: ['desert-sand-water-border', 'NaN'] },
    { relief: ['-1', 0] },
    { relief: ['000', 128] },
    { relief: ['000', 0.25] },
    { patches: ['up'] },
    { ground: 'invalid' },
  ])
    assert.throws(() => encode([{ i: 0, j: 0, ...extra }], 5), /prepared (terrain|water)/)
})

test('terrain decoding rejects truncated data and invalid coordinates, masks and grounds', () => {
  assert.throws(() => decode(new Uint8Array(8), 5), /Truncated/)
  for (const [offset, value] of [
    [0, 36],
    [7, 16],
    [8, 6],
  ]) {
    const bytes = new Uint8Array(9)
    bytes[offset] = value
    assert.throws(() => decode(bytes, 5), /Invalid prepared terrain/)
  }
})
