const buildings = require('../../../public/assets/data/gameplay/buildings.json')
const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { getStorageCapacity } = loadGenerationTs('app/lib/resources/storagePolicy.ts')
const { getBuildingInteriorEntryPosition } = loadGenerationTs('app/lib/buildings/interiors.ts')
const key = point => `${point.i}:${point.j}`
function footprint(building) {
  const size = building.size ?? buildings[building.type]?.size
  if (!Number.isInteger(size) || size < 1) throw new Error(`Invalid building size: ${building.label}`)
  const before = Math.floor((size - 1) / 2),
    after = size - before - 1
  const cells = []
  for (let i = building.i - before; i <= building.i + after; i++)
    for (let j = building.j - before; j <= building.j + after; j++) cells.push({ i, j })
  return cells
}
function validateSettlements(prepared, terrain, heroSpawns) {
  const occupied = new Map(),
    labels = new Set()
  const land = p =>
    Number.isInteger(p.i) &&
    Number.isInteger(p.j) &&
    terrain[p.i]?.[p.j] &&
    terrain[p.i][p.j].category !== 'Water' &&
    !terrain[p.i][p.j].border
  const reserve = (entity, point) => {
    if (!land(point)) throw new Error(`${entity.label ?? entity.type}: invalid terrain at ${key(point)}`)
    if (occupied.has(key(point)))
      throw new Error(`Overlap at ${key(point)}: ${entity.label ?? entity.type} / ${occupied.get(key(point))}`)
    occupied.set(key(point), entity.label ?? entity.type)
  }
  const identity = entity => {
    if (!entity.label || labels.has(entity.label)) throw new Error(`Missing or duplicate label: ${entity.label}`)
    labels.add(entity.label)
  }
  for (const resource of prepared.resources) if (!resource.isDestroyed) reserve(resource, resource)
  const allBuildings = prepared.players.flatMap(player => player.buildings ?? [])
  for (const building of allBuildings) {
    identity(building)
    const cells = footprint(building)
    for (const cell of cells) reserve(building, cell)
    if (
      cells.some(
        cell => terrain[cell.i][cell.j].inclined || terrain[cell.i][cell.j].z !== terrain[building.i][building.j].z
      )
    )
      throw new Error(`${building.label}: uneven building footprint`)
    const stock = Object.values(building.inventory?.resources ?? {})
    if (
      stock.some(value => !Number.isFinite(value) || value < 0) ||
      (['Granary', 'StoragePit'].includes(building.type) &&
        stock.reduce((sum, n) => sum + n, 0) > getStorageCapacity(building.type))
    )
      throw new Error(`${building.label}: invalid depot stock`)
  }
  const mobileCells = new Set([...prepared.players.flatMap(p => p.units ?? []), ...prepared.animals].map(key))
  // Walk each settlement locally. This never flood-fills a whole continent.
  for (const player of prepared.players) {
    const anchor = player.buildings?.find(b => ['TownCenter', 'FireCamp', 'Granary'].includes(b.type))
    if (!anchor) throw new Error(`${player.label}: missing settlement anchor`)
    const walkable = p =>
      land(p) && !occupied.has(key(p)) && Math.max(Math.abs(p.i - anchor.i), Math.abs(p.j - anchor.j)) <= 40
    const first = player.units?.find(walkable)
    if (!first) throw new Error(`${player.label}: no accessible spawn`)
    const queue = [first],
      visited = new Set([key(first)])
    for (let index = 0; index < queue.length; index++) {
      const current = queue[index]
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const point = { i: current.i + di, j: current.j + dj }
        if (
          !walkable(point) ||
          visited.has(key(point)) ||
          Math.abs(terrain[point.i][point.j].z - terrain[current.i][current.j].z) > 1
        )
          continue
        visited.add(key(point))
        queue.push(point)
      }
    }
    if (heroSpawns && player.type !== 'Bandits' && !heroSpawns.some(spawn => spawn.civ === player.civ)) {
      const spawn = queue.find(point => !mobileCells.has(key(point)))
      if (!spawn) throw new Error(`${player.label}: missing hero spawn`)
      heroSpawns.push({ civ: player.civ, i: spawn.i, j: spawn.j })
      mobileCells.add(key(spawn))
    }
    for (const building of player.buildings) {
      const entry = getBuildingInteriorEntryPosition({ ...buildings[building.type], ...building })
      if (entry && !visited.has(key(entry))) throw new Error(`${building.label}: blocked entrance`)
      const edge = footprint(building).some(p =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([di, dj]) => visited.has(`${p.i + di}:${p.j + dj}`))
      )
      if (!edge) throw new Error(`${building.label}: inaccessible building`)
    }
    for (const unit of player.units) if (!visited.has(key(unit))) throw new Error(`${unit.label}: disconnected spawn`)
  }
  for (const player of prepared.players)
    for (const unit of player.units ?? []) {
      identity(unit)
      reserve(unit, unit)
    }
  for (const animal of prepared.animals) reserve(animal, animal)
  return {
    settlements: prepared.settlements.length,
    banditCamps: prepared.banditCamps.length,
    buildings: allBuildings.length,
    units: prepared.players.reduce((sum, player) => sum + player.units.length, 0),
    resources: prepared.resources.length,
  }
}
module.exports = { validateSettlements, footprint }
