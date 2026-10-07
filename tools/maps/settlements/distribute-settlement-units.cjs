const buildings = require('../../../public/assets/data/gameplay/buildings.json')
const { footprint } = require('./validate-settlements.cjs')
const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { getBuildingInteriorEntryPosition } = loadGenerationTs('app/lib/buildings/interiors.ts')
const { RPG_VILLAGE_WORKERS } = loadGenerationTs('app/config/rpgVillages.ts')
const key = p => `${p.i}:${p.j}`
const distance = (a, b) => Math.max(Math.abs(a.i - b.i), Math.abs(a.j - b.j))
const directions = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

// Offline only: one bounded connectivity search per settlement, never a live relocation.
function distributeSettlementUnits(state, terrain, roads) {
  const roadCells = new Set((roads?.cells ?? []).map(([id]) => `${Math.floor(id / roads.stride)}:${id % roads.stride}`))
  const occupied = new Set(state.resources.filter(r => !r.isDestroyed).map(key))
  const entrances = new Set()
  const buildingClearance = new Set()
  for (const owner of state.players) {
    for (const building of owner.buildings ?? []) {
      for (const cell of footprint(building)) {
        occupied.add(key(cell))
        // Keep idle sprites away from walls as well as outside the solid footprint.
        for (let di = -1; di <= 1; di++)
          for (let dj = -1; dj <= 1; dj++) buildingClearance.add(key({ i: cell.i + di, j: cell.j + dj }))
      }
      const entry = getBuildingInteriorEntryPosition({ ...buildings[building.type], ...building })
      if (entry) {
        entrances.add(key(entry))
        for (const [di, dj] of directions) entrances.add(key({ i: entry.i + di, j: entry.j + dj }))
      }
    }
  }
  const mobiles = new Set(
    [...state.animals, ...state.players.filter(p => p.type !== 'AI').flatMap(p => p.units ?? [])].map(key)
  )
  for (const owner of state.players.filter(p => p.type === 'AI')) {
    const home = owner.buildings.find(b => ['TownCenter', 'FireCamp', 'Granary'].includes(b.type))
    if (!home) throw new Error(`${owner.label}: missing settlement anchor`)
    const walkable = p => {
      const cell = terrain[p.i]?.[p.j]
      return (
        cell &&
        cell.category !== 'Water' &&
        !cell.border &&
        !cell.waterBorder &&
        !occupied.has(key(p)) &&
        distance(p, home) <= 30
      )
    }
    const first = owner.units.find(walkable)
    if (!first) throw new Error(`${owner.label}: no accessible spawn for distribution`)
    const queue = [{ i: first.i, j: first.j }],
      visited = new Set([key(first)])
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      for (const [di, dj] of directions) {
        const next = { i: current.i + di, j: current.j + dj }
        if (
          !walkable(next) ||
          visited.has(key(next)) ||
          Math.abs(terrain[next.i][next.j].z - terrain[current.i][current.j].z) > 1
        )
          continue
        visited.add(key(next))
        queue.push(next)
      }
    }
    const candidates = queue.filter(
      p => !entrances.has(key(p)) && !buildingClearance.has(key(p)) && !roadCells.has(key(p))
    )
    const homes = owner.buildings.filter(b =>
      ['House', 'Market', 'Temple', 'Granary', 'StoragePit', 'Forge'].includes(b.type)
    )
    const defenses = owner.buildings.filter(b =>
      ['WatchTower', 'Barracks', 'ArcheryRange', 'Stable', 'FireCamp'].includes(b.type)
    )
    // Spread workers between authored fields, rather than choosing the first row of wheat.
    const fields = new Map()
    for (const resource of state.resources) {
      const prefix = `start:${owner.label}:wheat:`
      if (!resource.isDestroyed && resource.label?.startsWith(prefix)) {
        const field = resource.label.slice(prefix.length).split(':')[0]
        if (!fields.has(field)) fields.set(field, resource)
      }
    }
    const wheat = [...fields.values()]
    let workerIndex = 0,
      civilianIndex = 0,
      soldierIndex = 0
    const placed = []
    const chief = owner.units.find(unit => unit.type === 'Chief' || unit.isChief)
    const escorts = chief ? owner.units.filter(unit => unit.type === 'Fantassin').slice(0, 2) : []
    // Place the leader first, then his escort beside him rather than at distant defenses.
    const units = chief
      ? [chief, ...escorts, ...owner.units.filter(unit => unit !== chief && !escorts.includes(unit))]
      : owner.units
    for (const unit of units) {
      let anchor = home
      const farmer =
        unit.type === 'Villager' && workerIndex++ < (RPG_VILLAGE_WORKERS[owner.settlementType] ?? 0) && wheat.length > 0
      if (escorts.includes(unit)) anchor = chief
      else if (farmer) anchor = wheat[(workerIndex - 1) % wheat.length]
      else if (unit.type === 'Villager' && homes.length) anchor = homes[civilianIndex++ % homes.length]
      else if (unit.type !== 'Chief' && defenses.length) anchor = defenses[soldierIndex++ % defenses.length]
      let best,
        bestScore = Infinity
      for (const cell of candidates) {
        if (mobiles.has(key(cell))) continue
        const nearest = placed.reduce((d, p) => Math.min(d, distance(p, cell)), Infinity)
        // Prefer a two-cell gap, but allow tighter placement on constrained terrain.
        const crowding = !escorts.includes(unit) && nearest < 3 ? (3 - nearest) * 30 : 0
        const score = distance(cell, anchor) * (farmer ? 8 : 3) + crowding
        if (score < bestScore) {
          best = cell
          bestScore = score
        }
      }
      if (!best) throw new Error(`${unit.label}: no free distributed spawn`)
      unit.i = best.i
      unit.j = best.j
      placed.push(best)
      mobiles.add(key(best))
    }
  }
}
module.exports = { distributeSettlementUnits }
