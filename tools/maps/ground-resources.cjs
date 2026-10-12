const { randomFrom } = require('./noise.cjs')
const { connectingCells } = require('../caves/sites.cjs')

const { loadGenerationTs } = require('./load-generation-ts.cjs')
const { GROUND_RESOURCE_PLACEMENT: RULES } = loadGenerationTs('app/config/groundResources.ts')
const TYPES = new Set(['GroundWood', 'GroundStone'])
const ZONE_SIZE = RULES.zoneSize
const ATTEMPTS = RULES.attempts

/** Seeded, bounded scatter after trees, settlements and cave entrances have been placed. */
function addGroundResources(blueprint, { buildings = [], isAvailable = () => true } = {}) {
  const width = blueprint.size + 1
  const terrain = Buffer.from(blueprint.terrain, 'base64')
  const relief = Buffer.from(blueprint.relief, 'base64')
  if (terrain.length !== width * width || relief.length !== terrain.length)
    throw new Error('Invalid blueprint terrain or relief')
  const resources = (blueprint.resources ?? []).filter(resource => !TYPES.has(resource.type))
  const occupied = new Uint8Array(terrain.length)
  const scattered = new Uint8Array(terrain.length)
  const trees = new Uint8Array(terrain.length)
  for (const item of [...resources, ...(blueprint.animals ?? [])]) {
    occupied[item.i * width + item.j] = 1
    if (item.type === 'Tree') trees[item.i * width + item.j] = 1
  }
  const reserve = (point, radius, circular = false) => {
    for (let i = Math.max(0, point.i - radius); i <= Math.min(width - 1, point.i + radius); i++)
      for (let j = Math.max(0, point.j - radius); j <= Math.min(width - 1, point.j + radius); j++)
        if (!circular || (i - point.i) ** 2 + (j - point.j) ** 2 <= radius ** 2) occupied[i * width + j] = 1
  }
  for (const site of blueprint.settlements ?? [])
    if (site.local) reserve(site.local, Math.ceil(site.radius ?? 12) + RULES.settlementClearance, true)
  for (const point of buildings) reserve(point, RULES.buildingClearance)
  for (const cave of blueprint.caves ?? []) reserve(cave, 6)
  for (const camp of blueprint.banditCampPositions ?? []) reserve(camp, 8)
  for (const cave of blueprint.caves ?? [])
    for (const camp of blueprint.banditCampPositions ?? [])
      if (camp.caveId === cave.id) for (const point of connectingCells(cave, camp)) reserve(point, 0)
  const land = value => [0, 1, 3, 4, 5, 7].includes(value)
  const free = (i, j) => {
    if (i < 2 || j < 2 || i >= width - 2 || j >= width - 2 || occupied[i * width + j]) return false
    if (!isAvailable(i, j)) return false
    for (let di = -RULES.minDistance + 1; di < RULES.minDistance; di++)
      for (let dj = -RULES.minDistance + 1; dj < RULES.minDistance; dj++)
        if (di * di + dj * dj < RULES.minDistance ** 2 && scattered[(i + di) * width + j + dj]) return false
    const z = relief[i * width + j]
    for (let di = -1; di <= 1; di++)
      for (let dj = -1; dj <= 1; dj++) {
        const index = (i + di) * width + j + dj
        if (!land(terrain[index]) || relief[index] !== z) return false
      }
    return true
  }
  const nearTree = (i, j) => {
    for (let di = -RULES.treeRadius; di <= RULES.treeRadius; di++)
      for (let dj = -RULES.treeRadius; dj <= RULES.treeRadius; dj++) {
        if (di * di + dj * dj > RULES.treeRadius ** 2 || i + di < 0 || j + dj < 0 || i + di >= width || j + dj >= width)
          continue
        const index = (i + di) * width + j + dj
        if (trees[index] && relief[index] === relief[i * width + j]) return true
      }
    return false
  }
  const counts = { GroundWood: 0, GroundStone: 0 }
  for (let zi = 0; zi < width; zi += ZONE_SIZE)
    for (let zj = 0; zj < width; zj += ZONE_SIZE)
      for (const type of TYPES) {
        const random = randomFrom(`${blueprint.seed}:ground-resources-v${RULES.version}:${zi}:${zj}:${type}`)
        if (random() > RULES.chance[type]) continue
        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
          const i = zi + Math.floor(random() * Math.min(ZONE_SIZE, width - zi))
          const j = zj + Math.floor(random() * Math.min(ZONE_SIZE, width - zj))
          if (!free(i, j) || (type === 'GroundWood' && !nearTree(i, j))) continue
          const frame = Math.floor(random() * 3) + (type === 'GroundStone' ? 3 : 0)
          resources.push({
            type,
            i,
            j,
            quantity: 1,
            totalQuantity: 1,
            textureName: `${String(frame).padStart(3, '0')}_resources/ground`,
          })
          occupied[i * width + j] = 1
          scattered[i * width + j] = 1
          counts[type]++
          break
        }
      }
  return {
    ...blueprint,
    resources,
    generation: { ...blueprint.generation, groundResources: { ...RULES, counts } },
  }
}

module.exports = { addGroundResources }
