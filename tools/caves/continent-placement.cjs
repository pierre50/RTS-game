const { randomFrom } = require('../maps/noise.cjs')
const { VARIANTS } = require('./layout.cjs')
const { MAP_PADDING } = require('./sites.cjs')

const CAVE_LAND_CELLS = 20000
const CAVE_MIN_DISTANCE = 80
const VILLAGE_DISTANCE = 40

// Sample the packed continent directly: no second grid of cell objects, and no
// dependence on the resource generator's patch boundaries.
function planContinentCaves({ terrain, size, seed, id, settlements = [], cellsPerCave = CAVE_LAND_CELLS }) {
  if (!Number.isSafeInteger(cellsPerCave) || cellsPerCave < 1)
    throw new Error('Cave density must be a positive integer')
  const stride = size + 1
  const land = value => value !== undefined && value !== 2 && value !== 255
  let landCells = 0
  for (const value of terrain) if (land(value)) landCells++
  const target = Math.round(landCells / cellsPerCave)
  const random = randomFrom(`${seed}:continent-caves-v1`)
  const caves = []
  const buckets = new Map()
  const bucketKey = (i, j) => `${i}:${j}`
  const safe = (i, j) => {
    if (i < MAP_PADDING || j < MAP_PADDING || i > size - MAP_PADDING || j > size - MAP_PADDING) return false
    if (!land(terrain[i * stride + j])) return false
    if (settlements.some(site => Math.hypot(site.local.i - i, site.local.j - j) < (site.clearance ?? VILLAGE_DISTANCE)))
      return false
    const bi = Math.floor(i / CAVE_MIN_DISTANCE),
      bj = Math.floor(j / CAVE_MIN_DISTANCE)
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++)
        if (
          (buckets.get(bucketKey(bi + di, bj + dj)) ?? []).some(
            cave => Math.hypot(cave.i - i, cave.j - j) < CAVE_MIN_DISTANCE
          )
        )
          return false
    // Include the approach and a margin from coasts and sparse-grid boundaries.
    for (let di = -MAP_PADDING; di <= MAP_PADDING; di++)
      for (let dj = -MAP_PADDING; dj <= MAP_PADDING; dj++) if (!land(terrain[(i + di) * stride + j + dj])) return false
    return true
  }
  // Impossible terrain lowers the count instead of forcing an unsafe entrance.
  for (let attempt = 0; attempt < Math.max(1000, target * 300) && caves.length < target; attempt++) {
    const i = Math.floor(random() * stride),
      j = Math.floor(random() * stride)
    if (!safe(i, j)) continue
    const tier = ['small', 'medium', 'large'][Math.floor(random() * 3)]
    const variant = tier === 'small' ? 'circle' : VARIANTS[Math.floor(random() * VARIANTS.length)]
    const cave = {
      i,
      j,
      id: `${id}:cave-${caves.length + 1}`,
      blueprintId: `cave-${tier}-${variant}`,
      tier,
      seed: Math.floor(random() * 0x7fffffff),
    }
    caves.push(cave)
    const key = bucketKey(Math.floor(i / CAVE_MIN_DISTANCE), Math.floor(j / CAVE_MIN_DISTANCE))
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(cave)
  }
  return { caves, landCells, target, cellsPerCave, minDistance: CAVE_MIN_DISTANCE }
}
module.exports = { planContinentCaves, CAVE_LAND_CELLS, CAVE_MIN_DISTANCE }
