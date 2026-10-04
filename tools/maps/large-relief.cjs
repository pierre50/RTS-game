const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { createReliefHeightSampler, RELIEF_BANDS } = loadGenerationTs('app/lib/terrain/reliefGeneration.ts')
const { EIGHT_NEIGHBOR_OFFSETS, hasUnsupportedTransition } = require('./topology.cjs')
const {
  ENVIRONMENT_TERRAIN_PARAMS,
  MACRO_ENVIRONMENT_BY_CODE,
  RELIEF_WATER_BUFFER_RADIUS,
  BLUEPRINT_MAP_SIZE,
} = require('./config.cjs')
const { connectingCells } = require('../caves/sites.cjs')

const names = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
const unsupported = Array.from({ length: 256 }, (_, mask) =>
  hasUnsupportedTransition(Object.fromEntries(names.map((name, bit) => [name, Boolean(mask & (1 << bit))])))
)

// Global packed buffers keep relief independent of resource patches and avoid a
// continent-sized object grid. Share the old noise, bands and biome amplitudes.
function generateLargeRelief({ terrain, biomeCodes, size, seed, settlements = [], caves = [], camps = [] }) {
  const stride = size + 1,
    length = stride * stride
  if (terrain.length !== length || biomeCodes.length !== length) throw new Error('Invalid continent relief buffers')
  const land = index => terrain[index] !== 2 && terrain[index] !== 255
  const heights = new Float32Array(length)
  const counts = new Map()
  const sample = createReliefHeightSampler(seed)
  for (let index = 0; index < length; index++) {
    if (!land(index)) continue
    const code = biomeCodes[index]
    if (!MACRO_ENVIRONMENT_BY_CODE[String.fromCharCode(code)]) throw new Error(`Unknown relief biome: ${code}`)
    heights[index] = sample(
      (Math.floor(index / stride) * 4.5) / BLUEPRINT_MAP_SIZE,
      ((index % stride) * 4.5) / BLUEPRINT_MAP_SIZE
    )
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const samples = new Map([...counts].map(([code, count]) => [code, new Float32Array(count)]))
  const cursors = new Map()
  for (let index = 0; index < length; index++) {
    if (!land(index)) continue
    const code = biomeCodes[index],
      cursor = cursors.get(code) ?? 0
    samples.get(code)[cursor] = heights[index]
    cursors.set(code, cursor + 1)
  }
  const bands = new Map(
    [...samples].map(([code, values]) => {
      values.sort()
      const amplitude = ENVIRONMENT_TERRAIN_PARAMS[MACRO_ENVIRONMENT_BY_CODE[String.fromCharCode(code)]].reliefAmplitude
      return [
        code,
        RELIEF_BANDS.map(([ratio, level]) => [
          values[Math.min(values.length - 1, Math.floor(values.length * ratio))],
          Math.round(level * amplitude),
        ]),
      ]
    })
  )
  const relief = new Int8Array(length)
  for (let index = 0; index < length; index++) {
    if (land(index)) relief[index] = bands.get(biomeCodes[index]).find(([threshold]) => heights[index] <= threshold)[1]
  }

  // Eight-neighbour clearance also protects diagonal shore sprites. Distances
  // saturate beyond the maximum relief, so the queue needs only one entry/cell.
  const distance = new Uint8Array(length).fill(255),
    queue = new Uint32Array(length)
  let tail = 0
  const reserve = index => {
    if (distance[index] === 0) return
    distance[index] = 0
    queue[tail++] = index
  }
  for (let index = 0; index < length; index++)
    if (!land(index) || index < stride || index >= length - stride || index % stride === 0 || index % stride === size)
      reserve(index)
  const spread = limit => {
    for (let cursor = 0; cursor < tail; cursor++) {
      const index = queue[cursor],
        nextDistance = distance[index] + 1
      if (nextDistance > limit) continue
      const i = Math.floor(index / stride),
        j = index % stride
      for (const [di, dj] of EIGHT_NEIGHBOR_OFFSETS) {
        const ni = i + di,
          nj = j + dj,
          next = ni * stride + nj
        if (ni < 0 || nj < 0 || ni > size || nj > size || distance[next] !== 255) continue
        distance[next] = nextDistance
        queue[tail++] = next
      }
    }
  }
  spread(RELIEF_WATER_BUFFER_RADIUS)
  for (let index = 0; index < length; index++) distance[index] = distance[index] <= RELIEF_WATER_BUFFER_RADIUS ? 0 : 255
  tail = 0
  for (let index = 0; index < length; index++) if (distance[index] === 0) queue[tail++] = index
  const clearing = (point, radius) => {
    for (let i = Math.max(0, point.i - radius); i <= Math.min(size, point.i + radius); i++)
      for (let j = Math.max(0, point.j - radius); j <= Math.min(size, point.j + radius); j++) reserve(i * stride + j)
  }
  for (const site of settlements) clearing(site.local, 32)
  for (const cave of caves) clearing(cave, 8)
  for (const camp of camps) {
    clearing(camp, 10)
    const cave = caves.find(entry => entry.id === camp.caveId)
    if (cave) for (const point of connectingCells(cave, camp)) clearing(point, 1)
  }
  spread(4)
  for (let index = 0; index < length; index++)
    relief[index] = Math.max(-distance[index], Math.min(distance[index], relief[index]))
  normalizeLargeRelief(relief, size)
  return relief
}

// Every repair reduces absolute elevation. This converges without moving a
// protected zero-height cell, including at biome and resource-patch boundaries.
function normalizeLargeRelief(relief, size) {
  const stride = size + 1
  let changed
  do {
    changed = false
    for (let i = 0; i <= size; i++)
      for (let j = 0; j <= size; j++) {
        const index = i * stride + j
        let mask = 0,
          lowestHigher = Infinity
        const neighbors = []
        for (let bit = 0; bit < 8; bit++) {
          const [di, dj] = EIGHT_NEIGHBOR_OFFSETS[bit],
            ni = i + di,
            nj = j + dj
          if (ni < 0 || nj < 0 || ni > size || nj > size) continue
          const next = ni * stride + nj
          if (relief[next] > relief[index]) {
            neighbors.push(next)
            mask |= 1 << bit
            lowestHigher = Math.min(lowestHigher, relief[next])
          }
          if (relief[next] - relief[index] > 1) {
            if (relief[index] < 0) relief[index] = Math.min(0, relief[next] - 1)
            else relief[next] = relief[index] + 1
            changed = true
          }
        }
        // A stale mask after a step repair is checked again on the next pass.
        if (!unsupported[mask]) continue
        if (relief[index] < 0) {
          const target = Math.min(0, lowestHigher)
          if (target > relief[index]) {
            relief[index] = target
            changed = true
          }
        } else
          for (const next of neighbors) {
            if (relief[next] > relief[index]) {
              relief[next] = relief[index]
              changed = true
            }
          }
      }
  } while (changed)
}
module.exports = { generateLargeRelief }
