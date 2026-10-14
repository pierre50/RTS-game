const buildings = require('../../../public/assets/data/gameplay/buildings.json')
const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { getBuildingInteriorEntryPosition } = loadGenerationTs('app/lib/buildings/interiors.ts')
const { footprint } = require('./validate-settlements.cjs')

const key = point => `${point.i}:${point.j}`
const neighbors = point => [
  { i: point.i + 1, j: point.j },
  { i: point.i - 1, j: point.j },
  { i: point.i, j: point.j + 1 },
  { i: point.i, j: point.j - 1 },
]

/** Clear only trees needed to connect a generated doorway to its settlement. */
function clearEntranceTrees(prepared, terrain) {
  const occupied = new Map()
  for (const resource of prepared.resources) if (!resource.isDestroyed) occupied.set(key(resource), resource)
  for (const player of prepared.players)
    for (const building of player.buildings ?? [])
      for (const point of footprint(building)) occupied.set(key(point), building)
  const land = point => {
    const cell = terrain[point.i]?.[point.j]
    return Boolean(cell && cell.category !== 'Water' && !cell.border)
  }
  const step = (from, to) =>
    land(to) && Math.abs((terrain[from.i][from.j].z ?? 0) - (terrain[to.i][to.j].z ?? 0)) <= 1
  const walkable = point => land(point) && !occupied.has(key(point))
  const reachable = (start, center) => {
    const seen = new Set([key(start)])
    const queue = [start]
    for (const point of queue)
      for (const next of neighbors(point)) {
        if (
          Math.max(Math.abs(next.i - center.i), Math.abs(next.j - center.j)) > 40 ||
          seen.has(key(next)) ||
          !walkable(next) ||
          !step(point, next)
        )
          continue
        seen.add(key(next))
        queue.push(next)
      }
    return seen
  }
  const removed = new Set()
  for (const player of prepared.players) {
    const center = player.buildings?.find(building => ['TownCenter', 'FireCamp', 'Granary'].includes(building.type))
    if (!center) continue
    const start = player.units?.find(point => walkable(point))
    if (!start) continue
    let connected = reachable(start, center)
    for (const building of player.buildings) {
      const entry = getBuildingInteriorEntryPosition({ ...buildings[building.type], ...building })
      if (!entry || connected.has(key(entry))) continue
      const seen = new Set([key(entry)])
      const previous = new Map()
      const queue = [entry]
      let target
      for (let index = 0; index < queue.length && !target; index++) {
        const point = queue[index]
        if (connected.has(key(point))) {
          target = point
          break
        }
        for (const next of neighbors(point)) {
          const id = key(next)
          const occupant = occupied.get(id)
          if (
            seen.has(id) ||
            Math.max(Math.abs(next.i - center.i), Math.abs(next.j - center.j)) > 40 ||
            !step(point, next) ||
            (occupant && occupant.type !== 'Tree')
          )
            continue
          seen.add(id)
          previous.set(id, point)
          queue.push(next)
        }
      }
      if (!target) continue
      for (let point = target; point && key(point) !== key(entry); point = previous.get(key(point))) {
        const resource = occupied.get(key(point))
        if (resource?.type === 'Tree') {
          occupied.delete(key(point))
          removed.add(resource)
        }
      }
      const entryResource = occupied.get(key(entry))
      if (entryResource?.type === 'Tree') {
        occupied.delete(key(entry))
        removed.add(entryResource)
      }
      connected = reachable(start, center)
    }
  }
  if (removed.size) prepared.resources = prepared.resources.filter(resource => !removed.has(resource))
  return removed.size
}

module.exports = { clearEntranceTrees }
