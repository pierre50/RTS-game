const assert = require('node:assert/strict')
const test = require('node:test')
const { generateLargeRelief } = require('../tools/maps/large-relief.cjs')
const { generateLargeContent } = require('../tools/maps/large-content.cjs')
const {
  EIGHT_NEIGHBOR_OFFSETS,
  getNeighborFlagsFromRing,
  hasUnsupportedTransition,
} = require('../tools/maps/topology.cjs')
globalThis.requestAnimationFrame ??= callback => setImmediate(() => callback(0))

function fixture() {
  const size = 191,
    stride = size + 1
  const terrain = Buffer.alloc(stride * stride, 0),
    biomeCodes = Buffer.alloc(terrain.length, 84)
  for (let i = 0; i <= size; i++)
    for (let j = 0; j <= size; j++) {
      const index = i * stride + j
      if (i < 8 || j < 8) {
        terrain[index] = i < 4 ? 255 : 2
        biomeCodes[index] = 87
      } else biomeCodes[index] = 'TFJDS'.charCodeAt(Math.min(4, Math.floor(j / 39)))
    }
  return {
    terrain,
    biomeCodes,
    size,
    seed: 5000,
    settlements: [{ local: { i: 75, j: 75 } }],
    caves: [{ i: 144, j: 140, id: 'cave' }],
    camps: [{ i: 148, j: 144, caveId: 'cave' }],
  }
}

test('continent relief uses deterministic biome amplitudes and protects coasts and sites without unsupported seams', () => {
  const input = fixture(),
    { size, terrain, biomeCodes } = input,
    stride = size + 1
  const relief = generateLargeRelief(input)
  assert.deepEqual(generateLargeRelief(input), relief)
  assert.ok(relief.some(z => z < 0))
  assert.ok(relief.some(z => z > 0))
  const limits = { T: 4, F: 4, J: 4, D: 1, S: 3 }
  for (let i = 0; i <= size; i++)
    for (let j = 0; j <= size; j++) {
      const index = i * stride + j,
        z = relief[index]
      if (terrain[index] === 2 || terrain[index] === 255 || i <= 12 || j <= 12) assert.equal(z, 0)
      else assert.ok(Math.abs(z) <= limits[String.fromCharCode(biomeCodes[index])])
      if (Math.abs(i - 75) <= 32 && Math.abs(j - 75) <= 32) assert.equal(z, 0)
      if (Math.abs(i - 148) <= 10 && Math.abs(j - 144) <= 10) assert.equal(z, 0)
      const ring = EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => {
        const ni = i + di,
          nj = j + dj
        if (ni < 0 || nj < 0 || ni > size || nj > size) return false
        const nz = relief[ni * stride + nj]
        assert.ok(Math.abs(nz - z) <= 1, `height step at ${i},${j}`)
        return nz > z
      })
      assert.equal(hasUnsupportedTransition(getNeighborFlagsFromRing(ring)), false, `unsupported relief at ${i},${j}`)
    }
})

test('content carries signed heights across patch seams and keeps entities off relief borders', async () => {
  const input = fixture(),
    { terrain, size, seed, biomeCodes, settlements, caves, camps } = input
  const relief = generateLargeRelief(input)
  const content = await generateLargeContent(
    terrain,
    size,
    settlements,
    seed,
    () => {},
    biomeCodes,
    caves,
    camps,
    relief
  )
  const slopes = new Set(content.appearance.filter(entry => entry.relief).map(entry => `${entry.i}:${entry.j}`))
  assert.ok(slopes.size > 0)
  for (const entity of [...content.resources, ...content.animals]) assert.ok(!slopes.has(`${entity.i}:${entity.j}`))
  const stride = size + 1
  for (let i = 1; i < size; i++)
    for (let j = 143; j <= 145; j++) {
      if (EIGHT_NEIGHBOR_OFFSETS.some(([di, dj]) => relief[(i + di) * stride + j + dj] > relief[i * stride + j]))
        assert.ok(slopes.has(`${i}:${j}`), `missing seam slope at ${i},${j}`)
    }
})
