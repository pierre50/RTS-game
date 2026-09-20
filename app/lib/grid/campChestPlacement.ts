import { isFootprintBuildable, type GridPoint } from './buildingFootprint'
import { storageAcceptsResource } from '../resources/storagePolicy'

type CampEntity = GridPoint & {
  type: string
  isDead?: boolean
  isDestroyed?: boolean
  isBuilt?: boolean
  spaceId?: string
  quantity?: number
  controlMode?: string
  followingHero?: boolean
  trainingTargetType?: string | null
  inventory?: { resources?: { wood?: number } }
}
const distance = (a: GridPoint, b: GridPoint) => Math.hypot(a.i - b.i, a.j - b.j)
const STORED: Record<string, string> = {
  Tree: 'wood',
  Stone: 'stone',
  Gold: 'gold',
  Copper: 'copper',
  Iron: 'iron',
  Berrybush: 'berry',
  Wheat: 'wheat',
}

/** One bootstrap path for live and detached camps. Bags fund only this small craft. */
export function tryCreateCampChest(options: {
  workers: readonly CampEntity[]
  resources: readonly CampEntity[]
  buildings: readonly CampEntity[]
  stocks: readonly { inventory?: { resources?: { wood?: number } }; isBuilt?: boolean }[]
  woodCost: number
  terrainAt(
    point: GridPoint
  ):
    | {
        category?: string
        border?: boolean
        terrainHidden?: boolean
        waterBorder?: boolean
        inclined?: boolean
        z?: number
      }
    | null
    | undefined
  isFree(point: GridPoint): boolean
  create(point: GridPoint): boolean
}): boolean {
  const { terrainAt, isFree, woodCost } = options
  if (!(woodCost > 0)) return false
  const buildings = options.buildings.filter(
    b => !b.isDead && !b.isDestroyed && (!b.spaceId || b.spaceId === 'outside')
  )
  // Camp chests are a bridge to permanent storage, never a replacement for it.
  if (buildings.filter(b => b.type === 'Chest').length >= 2) return false
  const workers = options.workers.filter(
    w =>
      w.type === 'Villager' &&
      !w.isDead &&
      !w.isDestroyed &&
      w.controlMode !== 'hero' &&
      !w.followingHero &&
      !w.trainingTargetType &&
      (!w.spaceId || w.spaceId === 'outside')
  )
  if (!workers.length) return false
  const stores = [...options.stocks.filter(s => s.isBuilt !== false), ...workers]
  const payments: Array<{ resources: { wood?: number }; amount: number }> = []
  let remaining = woodCost
  const seen = new Set<object>()
  for (const store of stores) {
    const resources = store.inventory?.resources
    if (!resources || seen.has(resources)) continue
    seen.add(resources)
    const amount = Math.min(remaining, Math.max(0, resources.wood ?? 0))
    if (amount) payments.push({ resources, amount })
    remaining -= amount
    if (!remaining) break
  }
  if (remaining) return false
  const resources = options.resources
    .filter(
      r =>
        !r.isDead &&
        !r.isDestroyed &&
        (r.quantity ?? 0) > 0 &&
        STORED[r.type] &&
        (!r.spaceId || r.spaceId === 'outside') &&
        workers.some(w => distance(w, r) <= 12)
    )
    .sort((a, b) => a.i - b.i || a.j - b.j)
  for (const resource of resources) {
    // Full or manually blocked chests do not trigger an endless row of replacement chests.
    if (buildings.some(b => storageAcceptsResource(b.type, STORED[resource.type]) && distance(b, resource) <= 12))
      continue
    const worker = workers
      .filter(w => distance(w, resource) <= 12)
      .sort((a, b) => distance(a, resource) - distance(b, resource))[0]
    const visited = new Set<string>([`${worker.i}:${worker.j}`])
    const queue: GridPoint[] = [worker]
    const lots: GridPoint[] = []
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]
      if (distance(p, resource) <= 6) lots.push(p)
      for (const [di, dj] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const next = { i: p.i + di, j: p.j + dj },
          key = `${next.i}:${next.j}`
        const cell = terrainAt(next),
          previous = terrainAt(p)
        if (
          visited.has(key) ||
          distance(worker, next) > 16 ||
          !cell ||
          cell.category === 'Water' ||
          cell.border ||
          cell.terrainHidden ||
          !isFree(next)
        )
          continue
        if ((cell.z ?? 0) !== (previous?.z ?? 0) && !cell.inclined && !previous?.inclined) continue
        visited.add(key)
        queue.push(next)
      }
    }
    if (
      ![
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([di, dj]) => visited.has(`${resource.i + di}:${resource.j + dj}`))
    )
      continue
    lots.sort((a, b) => distance(a, resource) - distance(b, resource) || a.i - b.i || a.j - b.j)
    for (const point of lots) {
      if (
        !isFootprintBuildable(
          point,
          1,
          p => {
            const cell = terrainAt(p)
            return (
              !!cell &&
              cell.category !== 'Water' &&
              !cell.border &&
              !cell.terrainHidden &&
              !cell.inclined &&
              !cell.waterBorder &&
              isFree(p)
            )
          },
          p => terrainAt(p)?.z
        )
      )
        continue
      if (!options.create(point)) continue
      for (const payment of payments) payment.resources.wood = (payment.resources.wood ?? 0) - payment.amount
      return true
    }
  }
  return false
}
