const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { TERRAIN, VILLAGE_GROVE_PROFILES } = require('../config.cjs')
const { pickTreeTextureNameForFamily } = loadGenerationTs('app/classes/map/resources/TreeResourceTextures.ts')
const { randomFrom } = require('../noise.cjs')
const { connectingCells, isClearing } = require('../../caves/sites.cjs')

// Biome presets apply equally to named and anonymous settlement sites.

function addVillageGroves(blueprint) {
  const villages = blueprint.settlements?.filter(site => site.kind === 'village' || site.kind === 'city') ?? []
  if (!villages.length) return blueprint
  const width = blueprint.size + 1
  const terrain = Buffer.from(blueprint.terrain, 'base64')
  const relief = Buffer.from(blueprint.relief, 'base64')
  const resources = [...(blueprint.resources ?? [])]
  const occupied = new Set([...resources, ...(blueprint.animals ?? [])].map(p => p.i * width + p.j))
  const caves = blueprint.caves ?? []
  const camps = blueprint.banditCampPositions ?? []
  const paths = new Set(
    caves
      .flatMap(cave => camps.filter(camp => camp.caveId === cave.id).flatMap(camp => connectingCells(cave, camp)))
      .map(p => p.i * width + p.j)
  )
  const at = (i, j) => (i >= 0 && j >= 0 && i < width && j < width ? terrain[i * width + j] : 255)
  for (const { local: home } of villages) {
    const profile = VILLAGE_GROVE_PROFILES[TERRAIN[at(home.i, home.j)]]
    if (!profile) continue
    const offset = Math.round(profile.distance / Math.sqrt(2))
    const centres = [-1, 1].flatMap(di => [-1, 1].map(dj => ({ i: home.i + di * offset, j: home.j + dj * offset })))
    for (const centre of centres) {
      for (let i = centre.i - profile.radius; i <= centre.i + profile.radius; i++) {
        for (let j = centre.j - profile.radius; j <= centre.j + profile.radius; j++) {
          const distance = Math.hypot(i - centre.i, j - centre.j)
          const key = i * width + j
          if (distance > profile.radius || TERRAIN[at(i, j)] !== profile.terrain || occupied.has(key) || paths.has(key))
            continue
          if (
            caves.some(cave => isClearing({ i, j }, cave)) ||
            camps.some(camp => Math.abs(i - camp.i) <= 8 && Math.abs(j - camp.j) <= 8)
          )
            continue
          if ((blueprint.spawns ?? []).some(p => Math.hypot(i - p.i, j - p.j) < 12)) continue
          let safe = true
          for (let di = -2; di <= 2 && safe; di++) {
            for (let dj = -2; dj <= 2; dj++) {
              const type = at(i + di, j + dj)
              if (type === 2 || type === 255 || relief[(i + di) * width + j + dj] !== relief[key]) safe = false
            }
          }
          if (!safe) continue
          // Per-cell randomness makes updating an existing blueprint idempotent.
          const random = randomFrom(`${blueprint.seed}:village-groves:${i}:${j}`)
          if (random() >= (distance <= profile.coreRadius ? profile.coreChance : profile.edgeChance)) continue
          resources.push({
            type: 'Tree',
            i,
            j,
            quantity: Math.round(140 + random() * 80),
            textureName: pickTreeTextureNameForFamily(
              profile.treeFamily,
              items => items[Math.floor(random() * items.length)]
            ),
          })
          occupied.add(key)
        }
      }
    }
  }
  return { ...blueprint, resources }
}

module.exports = { addVillageGroves }
