const assert = require('node:assert/strict')
const test = require('node:test')
const { createCave, validateCave, VARIANTS } = require('../tools/caves/layout.cjs')
const { loadTsModule } = require('./helpers/loadTsModule.cjs')
const { getInteriorWallGeometry } = loadTsModule('app/lib/terrain/interiorWallGeometry.ts')
const { getNeighborFlagsFromRing, hasUnsupportedTransition, EIGHT_NEIGHBOR_OFFSETS } =
  loadTsModule('app/lib/terrain/topology.ts')

function decode(payload) {
  const width = payload.size + 1
  const decodeLayer = layer => {
    const bytes = Buffer.from(layer, 'base64')
    return Array.from({ length: width }, (_, i) => Array.from(bytes.subarray(i * width, (i + 1) * width)))
  }
  return { ...payload, floorMask: decodeLayer(payload.floorMask), relief: decodeLayer(payload.relief) }
}

test('every cave has progressive, atlas-compatible terraces and a level entrance', () => {
  for (let seed = 0; seed < 8; seed++)
    for (const tier of ['small', 'medium', 'large']) {
      for (const variant of tier === 'small' ? ['circle'] : VARIANTS) {
        const payload = createCave(tier, variant, seed)
        validateCave(payload)
        const map = decode(payload)
        const heights = new Set()
        for (let i = 0; i <= map.size; i++)
          for (let j = 0; j <= map.size; j++) {
            if (!map.floorMask[i][j]) continue
            const z = map.relief[i][j]
            heights.add(z)
            const flags = getNeighborFlagsFromRing(
              EIGHT_NEIGHBOR_OFFSETS.map(([di, dj]) => {
                const neighbor = map.relief[i + di]?.[j + dj] ?? z
                assert.ok(Math.abs(neighbor - z) <= 1)
                return neighbor > z
              })
            )
            assert.equal(hasUnsupportedTransition(flags), false)
          }
        assert.ok(heights.size >= 2, payload.id)
        const exit = map.exits[0]
        for (let di = -2; di <= 2; di++)
          for (let dj = -2; dj <= 2; dj++) {
            assert.equal(map.relief[exit.i + di]?.[exit.j + dj], 0)
          }
      }
    }
})

test('walls on generated slopes meet at identical elevations at shared corners', () => {
  const used = new Set()
  const corners = [
    [-1, 1],
    [-1, -1],
    [1, -1],
    [1, 1],
  ]
  const edges = [
    [0, 1],
    [1, 2],
    [0, 3],
    [3, 2],
  ]
  for (const seed of [4242, 4243])
    for (const tier of ['small', 'medium', 'large']) {
      for (const variant of tier === 'small' ? ['circle'] : VARIANTS) {
        const map = decode(createCave(tier, variant, seed))
        const vertices = new Map()
        for (const wall of map.walls) {
          const g = getInteriorWallGeometry(map, wall)
          used.add(g.frame)
          const rise = g.height - 101
          const descending = g.frame === 0 || g.flip
          const ys = descending ? [g.y + 100, g.y + 100 + rise] : [g.y + 100 + rise, g.y + 100]
          edges[wall.side].forEach((corner, index) => {
            const [di, dj] = corners[corner]
            const key = `${2 * wall.i + di},${2 * wall.j + dj}`
            if (vertices.has(key)) assert.equal(ys[index], vertices.get(key), `${map.id}: wall gap at ${key}`)
            vertices.set(key, ys[index])
          })
        }
      }
    }
  assert.deepEqual([...used].sort(), [0, 2, 3, 4])
})

test('steep wall panels mirror downhill edges without changing their lighting', () => {
  const map = {
    size: 2,
    relief: [
      [1, 1, 1],
      [0, 0, 0],
      [0, 0, 0],
    ],
  }
  const left = getInteriorWallGeometry(map, { i: 1, j: 1, side: 0 })
  const right = getInteriorWallGeometry(map, { i: 1, j: 1, side: 1 })
  assert.equal(left.frame, 3)
  assert.equal(right.frame, 2)
  assert.equal(right.flip, true)
  assert.equal(right.height, 133)
  assert.equal(right.tint, 0xffffff)
})
