const assert = require('node:assert/strict')
const test = require('node:test')
const { normalizeLargeCoast } = require('../tools/maps/large-coast.cjs')
const { loadGenerationTs } = require('../tools/maps/load-generation-ts.cjs')
const { hasUnsupportedTransition, EIGHT_NEIGHBOR_OFFSETS } = loadGenerationTs('app/lib/terrain/topology.ts')

function assertRenderable(terrain, size) {
  const stride = size + 1
  const names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  for (let i = 0; i <= size; i++)
    for (let j = 0; j <= size; j++) {
      if ([2, 255].includes(terrain[i * stride + j])) continue
      const flags = Object.fromEntries(
        EIGHT_NEIGHBOR_OFFSETS.map(([di, dj], bit) => {
          const ni = i + di,
            nj = j + dj
          return [
            names[bit],
            ni < 0 || nj < 0 || ni > size || nj > size || [2, 255].includes(terrain[ni * stride + nj]),
          ]
        })
      )
      assert.equal(hasUnsupportedTransition(flags), false, `unsupported coast at ${i},${j}`)
    }
}

test('all 3x3 land/water patterns converge to renderable coasts, with consistent biomes and no lost land', () => {
  for (let pattern = 0; pattern < 512; pattern++) {
    const terrain = Buffer.alloc(49, 2),
      biomes = Buffer.alloc(49, 87)
    for (let bit = 0; bit < 9; bit++)
      if (pattern & (1 << bit)) {
        const index = (2 + Math.floor(bit / 3)) * 7 + 2 + (bit % 3)
        terrain[index] = 4
        biomes[index] = 70
      }
    terrain[0] = 255
    const original = Buffer.from(terrain)
    const repeat = Buffer.from(terrain)
    const repeatBiomes = Buffer.from(biomes)
    const result = normalizeLargeCoast(terrain, 6, biomes)
    assert.deepEqual(normalizeLargeCoast(repeat, 6, repeatBiomes), result)
    assert.deepEqual(repeat, terrain)
    assert.deepEqual(repeatBiomes, biomes)
    assertRenderable(terrain, 6)
    let added = 0
    for (let index = 0; index < terrain.length; index++) {
      if (original[index] !== terrain[index]) {
        assert.equal(original[index], 2)
        assert.equal(terrain[index], 4)
        added++
      }
      assert.equal(biomes[index], terrain[index] === 4 ? 70 : 87)
    }
    assert.equal(result.added, added)
    assert.equal(result.addedByBiome.F ?? 0, added)
    assert.equal(normalizeLargeCoast(terrain, 6, biomes).added, 0)
  }
})

test('wide land and ordinary coast corners remain intact', () => {
  const terrain = Buffer.alloc(400, 2),
    biomes = Buffer.alloc(400, 87)
  for (let i = 4; i < 16; i++)
    for (let j = 4; j < 16; j++) {
      terrain[i * 20 + j] = 1
      biomes[i * 20 + j] = 68
    }
  const original = Buffer.from(terrain)
  assert.equal(normalizeLargeCoast(terrain, 19, biomes).added, 0)
  assert.deepEqual(terrain, original)
  assertRenderable(terrain, 19)
})

test('a three-sided tip crossing a content patch boundary is repaired without cutting back the mainland', () => {
  const stride = 170,
    terrain = Buffer.alloc(stride * stride, 2),
    biomes = Buffer.alloc(terrain.length, 87)
  for (let i = 120; i < 160; i++)
    for (let j = 120; j < 144; j++) {
      terrain[i * stride + j] = 0
      biomes[i * stride + j] = 83
    }
  for (let j = 144; j < 150; j++) {
    terrain[140 * stride + j] = 0
    biomes[140 * stride + j] = 83
  }
  const result = normalizeLargeCoast(terrain, stride - 1, biomes)
  assert.ok(result.added > 0 && result.added <= 12)
  assert.equal(result.addedByBiome.S, result.added)
  assert.equal(terrain[140 * stride + 143], 0)
  assertRenderable(terrain, stride - 1)
})

test('an impossible void boundary fails explicitly without extending the playable footprint', () => {
  const terrain = Buffer.alloc(9, 255),
    biomes = Buffer.alloc(9, 87)
  terrain[4] = 0
  biomes[4] = 84
  const original = Buffer.from(terrain)
  assert.throws(() => normalizeLargeCoast(terrain, 2, biomes), /Unrenderable continent boundary at 1,1/)
  assert.deepEqual(terrain, original)
})
