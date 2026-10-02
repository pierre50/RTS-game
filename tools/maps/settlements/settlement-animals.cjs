const { footprint } = require('./validate-settlements.cjs')
const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { randomFrom } = require('../noise.cjs')
const { STABLE_HORSE_CAPACITY } = loadGenerationTs('app/lib/horses/stableHorses.ts')
const { HORSE_TAMING_STATUS } = loadGenerationTs('app/lib/horses/horseTaming.ts')
const { getAmbientAnimalProfile, getAnimalHabitatWeight } = loadGenerationTs(
  'app/classes/map/generation/AmbientAnimalGeneration.ts'
)
const key = p => `${p.i}:${p.j}`
const distance = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j))
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// Include fields and the interior of perimeter walls, with two cells of clearance.
function settlementAnimalZones(state) {
  return state.players
    .filter(p => p.type === 'AI')
    .flatMap(owner => {
      const cells = (owner.buildings ?? []).flatMap(footprint)
      for (const resource of state.resources)
        if (!resource.isDestroyed && resource.label?.startsWith(`start:${owner.label}:wheat:`)) cells.push(resource)
      if (!cells.length) return []
      return [
        {
          minI: Math.min(...cells.map(p => p.i)) - 2,
          maxI: Math.max(...cells.map(p => p.i)) + 2,
          minJ: Math.min(...cells.map(p => p.j)) - 2,
          maxJ: Math.max(...cells.map(p => p.j)) + 2,
        },
      ]
    })
}

// Old blueprints have no herd IDs. Recover compact groups using the species'
// generation radius and maximum size, without joining long animal chains.
function animalGroups(animals) {
  const remaining = new Set(animals),
    groups = []
  for (const anchor of animals) {
    if (!remaining.delete(anchor)) continue
    const profile = getAmbientAnimalProfile(anchor.type),
      group = [anchor]
    for (const animal of remaining) {
      if (group.length >= profile.groupSize[1]) break
      if (animal.type === anchor.type && distance(animal, anchor) <= profile.radius * 2) {
        group.push(animal)
        remaining.delete(animal)
      }
    }
    groups.push(group)
  }
  return groups
}

function* rings(anchor, limit) {
  for (let ring = 0; ring <= limit; ring++)
    for (let di = -ring; di <= ring; di++) {
      const offsets = Math.abs(di) === ring ? Array.from({ length: 2 * ring + 1 }, (_, n) => n - ring) : [-ring, ring]
      for (const dj of offsets) yield { i: anchor.i + di, j: anchor.j + dj }
    }
}

// Final wildlife placement runs after AI buildings, fields and inhabitants exist.
function relocateSettlementAnimals(state, terrain, blueprint = {}) {
  const zones = settlementAnimalZones(state)
  const clearings = [...(blueprint.caves ?? []), ...(blueprint.banditCampPositions ?? [])]
  const reserved = p =>
    zones.some(z => p.i >= z.minI && p.i <= z.maxI && p.j >= z.minJ && p.j <= z.maxJ) ||
    clearings.some(c => distance(p, c) <= 8)
  const occupied = new Set(state.resources.filter(r => !r.isDestroyed).map(key))
  const mobiles = new Set(state.players.flatMap(p => p.units ?? []).map(key))
  for (const owner of state.players)
    for (const building of owner.buildings ?? []) for (const cell of footprint(building)) occupied.add(key(cell))
  const animalCells = new Map()
  for (const animal of state.animals) animalCells.set(key(animal), (animalCells.get(key(animal)) ?? 0) + 1)
  const walkable = p => {
    const cell = terrain[p.i]?.[p.j]
    return (
      cell &&
      cell.category !== 'Water' &&
      !cell.border &&
      !cell.waterBorder &&
      !cell.inclined &&
      !cell.terrainHidden &&
      !occupied.has(key(p)) &&
      !reserved(p)
    )
  }
  const free = p => walkable(p) && !mobiles.has(key(p)) && !animalCells.get(key(p))
  const biome = p =>
    blueprint.macroTerrainRows?.[p.i]?.[p.j] === 'S' || blueprint.environment === 'Steppe'
      ? 'Steppe'
      : (terrain[p.i]?.[p.j]?.type ?? 'Grass')
  // Prove enough connected land and an escape at least twelve cells away.
  // Bounded to a 25x25 patch; cliffs and permanent obstacles block traversal.
  const roamingPatch = anchor => {
    const queue = [anchor],
      seen = new Set([key(anchor)])
    let reachesEdge = false
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      if (distance(current, anchor) === 12) reachesEdge = true
      if (queue.length >= 96 && reachesEdge) return queue
      for (const [di, dj] of directions) {
        const next = { i: current.i + di, j: current.j + dj }
        if (
          distance(next, anchor) > 12 ||
          seen.has(key(next)) ||
          !walkable(next) ||
          Math.abs((terrain[next.i][next.j].z ?? 0) - (terrain[current.i][current.j].z ?? 0)) > 1
        )
          continue
        seen.add(key(next))
        queue.push(next)
      }
    }
    return null
  }
  for (const group of animalGroups(state.animals)) {
    if (group.every(a => walkable(a) && !mobiles.has(key(a)) && animalCells.get(key(a)) === 1)) continue
    for (const animal of group) animalCells.set(key(animal), animalCells.get(key(animal)) - 1)
    const anchor = group[0],
      originalBiome = biome(anchor)
    const radius = getAmbientAnimalProfile(anchor.type).radius
    let destinations
    // Prefer the original habitat nearby; never use a forbidden habitat as fallback.
    for (const sameHabitat of [true, false]) {
      for (const point of rings(anchor, Math.min(128, terrain.length - 1))) {
        if (
          !free(point) ||
          (sameHabitat && biome(point) !== originalBiome) ||
          getAnimalHabitatWeight(anchor.type, biome(point)) <= 0
        )
          continue
        const patch = roamingPatch(point)
        if (!patch) continue
        const candidates = patch.filter(
          p =>
            distance(p, point) <= radius &&
            free(p) &&
            (!sameHabitat || biome(p) === originalBiome) &&
            getAnimalHabitatWeight(anchor.type, biome(p)) > 0
        )
        if (candidates.length < group.length) continue
        destinations = candidates.slice(0, group.length)
        break
      }
      if (destinations) break
    }
    if (!destinations)
      throw new Error(`${anchor.label ?? anchor.type}: no safe wildlife relocation for group of ${group.length}`)
    group.forEach((animal, index) => {
      Object.assign(animal, destinations[index], { z: terrain[destinations[index].i][destinations[index].j].z ?? 0 })
      for (const field of ['x', 'y', 'zIndex', 'dest', 'path', 'action']) delete animal[field]
      animalCells.set(key(animal), (animalCells.get(key(animal)) ?? 0) + 1)
    })
  }
}

function stockSettlementStables(state, seed) {
  const ranges = { outpost: [1, 2], village: [1, 3], city: [3, STABLE_HORSE_CAPACITY] }
  for (const owner of state.players)
    for (const building of owner.buildings ?? []) {
      if (building.type !== 'Stable') continue
      const random = randomFrom(`${seed}:${building.label}:stable-horses`)
      const [min, max] = ranges[owner.settlementType] ?? ranges.village
      building.horseAmount = Math.min(STABLE_HORSE_CAPACITY, min + Math.floor(random() * (max - min + 1)))
      building.stableHorses = Array.from({ length: building.horseAmount }, () => ({
        tamingStatus: HORSE_TAMING_STATUS.tamed,
      }))
    }
}

module.exports = { relocateSettlementAnimals, stockSettlementStables, settlementAnimalZones }
