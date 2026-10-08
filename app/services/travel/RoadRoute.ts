import { searchInstancePath } from '../Pathfinding'
import type { RoadLayer } from '../../lib/terrain/roadLayer'
import type { RuntimeMap, RuntimeCell } from '../../types/map'

export type RoadPoint = { i: number; j: number }
type Traveller = RoadPoint & { label?: string }
const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const
const cache = new WeakMap<RoadLayer, Map<number, number>>()
const distance = (a: RoadPoint, b: RoadPoint) => Math.hypot(a.i - b.i, a.j - b.j)

function* localPath(start: Traveller, end: RoadPoint, map: RuntimeMap): Generator<void, RoadPoint[] | null> {
  if (start.i === end.i && start.j === end.j) return []
  const search = searchInstancePath(start, end.i, end.j, map, { searchMargin: 64 })
  // Even inaccessible connectors have a finite search budget, spread across frames.
  for (let slice = 0; slice < 1024; slice++) {
    const step = search.next()
    if (step.done) return step.value.length ? step.value.reverse().map(({ i, j }) => ({ i, j })) : null
    yield
  }
  return null
}

function walkable(cell: RuntimeCell | undefined, unit: Traveller): boolean {
  return Boolean(cell && cell.category !== 'Water' && (!cell.solid || cell.has?.label === unit.label))
}

export function townArrivalCells(unit: Traveller, town: RoadPoint & { size?: number }, map: RuntimeMap): RuntimeCell[] {
  const arrivals: RuntimeCell[] = []
  const radius = Math.ceil((town.size ?? 3) / 2) + 1
  for (let di = -radius; di <= radius; di++)
    for (let dj = -radius; dj <= radius; dj++) {
      const cell = map.grid[town.i + di]?.[town.j + dj]
      if (walkable(cell, unit)) arrivals.push(cell!)
    }
  return arrivals.sort((a, b) => distance(a, unit) - distance(b, unit))
}

/** One search reaches any free side of the town, including around wide terrain obstacles. */
export function* planTownApproach(
  unit: Traveller,
  town: RoadPoint & { size?: number },
  map: RuntimeMap
): Generator<void, RoadPoint[] | null> {
  const arrivals = townArrivalCells(unit, town, map)
  if (!arrivals.length) return null
  for (const margin of [16, 64, 256]) {
    const search = searchInstancePath(unit, arrivals[0].i, arrivals[0].j, map, {
      searchMargin: margin,
      alternativeGoals: arrivals,
    })
    for (let slice = 0; slice < 4096; slice++) {
      const step = search.next()
      if (step.done) {
        if (step.value.length || arrivals.some(cell => cell.i === unit.i && cell.j === unit.j))
          return step.value.reverse().map(({ i, j }) => ({ i, j }))
        break
      }
      yield
    }
  }
  return null
}

/** Routes only inspect terrain for the short access legs, not along the whole continent. */
export function* planRoadRoute(
  unit: Traveller,
  town: RoadPoint & { size?: number },
  map: RuntimeMap
): Generator<void, RoadPoint[] | null> {
  const roads = map.roads
  if (!roads?.cells.length) return null
  let graph = cache.get(roads)
  if (!graph) {
    graph = new Map()
    for (let n = 0; n < roads.cells.length; n++) {
      const [id, mask] = roads.cells[n]
      graph.set(id, mask)
      if (n % 64 === 0) yield
    }
    cache.set(roads, graph)
  }
  const point = (id: number): RoadPoint => ({ i: Math.floor(id / roads.stride), j: id % roads.stride })
  const starts: number[] = [],
    ends: number[] = []
  const nearest = (list: number[], id: number, anchor: RoadPoint) => {
    list.push(id)
    list.sort((a, b) => distance(point(a), anchor) - distance(point(b), anchor))
    if (list.length > 8) list.pop()
  }
  let inspected = 0
  for (const id of graph.keys()) {
    nearest(starts, id, unit)
    nearest(ends, id, town)
    if (++inspected % 64 === 0) yield
  }
  const arrivals = townArrivalCells(unit, town, map)
  const exits = new Map<number, RoadPoint[]>()
  for (const id of ends) {
    const end = point(id)
    for (const arrival of [...arrivals].sort((a, b) => distance(a, end) - distance(b, end)).slice(0, 4)) {
      const path = yield* localPath({ ...end, label: unit.label }, arrival, map)
      if (path) {
        exits.set(id, path)
        break
      }
    }
  }
  if (!exits.size) return null
  for (const startId of starts) {
    const access = yield* localPath(unit, point(startId), map)
    if (!access) continue
    const queue = [startId],
      parents = new Map<number, number | null>([[startId, null]])
    for (let head = 0; head < queue.length; head++) {
      const id = queue[head]
      if (exits.has(id)) {
        const route: RoadPoint[] = []
        let cursor: number | null = id
        while (cursor !== null) {
          route.push(point(cursor))
          cursor = parents.get(cursor) ?? null
        }
        return [...access, ...route.reverse().slice(1), ...exits.get(id)!]
      }
      const current = point(id),
        mask = graph.get(id) ?? 0
      for (let bit = 0; bit < DIRECTIONS.length; bit++) {
        if (!(mask & (1 << bit))) continue
        const [di, dj] = DIRECTIONS[bit]
        const next = (current.i + di) * roads.stride + current.j + dj
        if (!graph.has(next) || parents.has(next)) continue
        parents.set(next, id)
        queue.push(next)
      }
      if (head % 64 === 0) yield
    }
  }
  return null
}
