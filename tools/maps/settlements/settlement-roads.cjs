const { footprint } = require('./validate-settlements.cjs')
const { loadGenerationTs } = require('../load-generation-ts.cjs')
const { getBuildingInteriorEntryPosition } = loadGenerationTs('app/lib/buildings/interiors.ts')
const buildings = require('../../../public/assets/data/gameplay/buildings.json')
// Directions match the path atlas: NE, SE, SW, NW.
const DIRECTIONS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

class MinHeap {
  items = []
  push(value) {
    const a = this.items
    let i = a.length
    a.push(value)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].f <= value.f) break
      a[i] = a[p]
      i = p
    }
    a[i] = value
  }
  pop() {
    const a = this.items,
      first = a[0],
      last = a.pop()
    if (a.length) {
      let i = 0
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1
        if (c + 1 < a.length && a[c + 1].f < a[c].f) c++
        if (a[c].f >= last.f) break
        a[i] = a[c]
        i = c
      }
      a[i] = last
    }
    return first
  }
}

function roadTerrain(prepared, terrain) {
  const stride = terrain.length,
    count = stride * stride
  const blocked = new Uint8Array(count),
    forest = new Uint8Array(count)
  const index = p => p.i * stride + p.j
  const inside = (i, j) => i >= 0 && j >= 0 && i < stride && j < stride
  for (const r of prepared.resources ?? []) {
    if (r.isDestroyed) continue
    blocked[index(r)] = 1
    if (r.type !== 'Tree') continue
    // A soft margin encourages skirting groves, without sealing narrow passes.
    for (let di = -5; di <= 5; di++)
      for (let dj = -5; dj <= 5; dj++) {
        const distance = Math.hypot(di, dj)
        if (distance > 5 || !inside(r.i + di, r.j + dj)) continue
        const id = (r.i + di) * stride + r.j + dj
        forest[id] = Math.max(forest[id], Math.round((6 - distance) * 3))
      }
  }
  // Keep authored field rectangles clear, including gaps between their crops.
  const fields = new Map()
  for (const r of prepared.resources ?? []) {
    const match = r.label?.match(/^(start:.*:wheat:[^:]+):/)
    if (!match || r.isDestroyed) continue
    const box = fields.get(match[1]) ?? { minI: r.i, maxI: r.i, minJ: r.j, maxJ: r.j }
    box.minI = Math.min(box.minI, r.i)
    box.maxI = Math.max(box.maxI, r.i)
    box.minJ = Math.min(box.minJ, r.j)
    box.maxJ = Math.max(box.maxJ, r.j)
    fields.set(match[1], box)
  }
  for (const b of fields.values())
    for (let i = b.minI; i <= b.maxI; i++) for (let j = b.minJ; j <= b.maxJ; j++) blocked[i * stride + j] = 1
  for (const owner of prepared.players ?? [])
    for (const building of owner.buildings ?? [])
      for (const p of footprint(building)) if (inside(p.i, p.j)) blocked[index(p)] = 1
  const walkable = (i, j) => {
    const cell = terrain[i]?.[j]
    return Boolean(cell && cell.category !== 'Water' && !cell.border && !cell.waterBorder && !blocked[i * stride + j])
  }
  const step = (i, j, a, b) => walkable(a, b) && Math.abs((terrain[i][j].z ?? 0) - (terrain[a][b].z ?? 0)) <= 1
  return { stride, count, forest, walkable, step, index }
}

function settlementAccess(site, prepared, grid) {
  const owner = prepared.players.find(p => p.label === site.ownerLabel)
  const anchor = owner?.buildings?.find(b => b.type === (site.profile === 'city' ? 'TownCenter' : 'Granary'))
  if (!anchor) throw new Error(`${site.id}: no road anchor`)
  const entry = getBuildingInteriorEntryPosition({ ...buildings[anchor.type], ...anchor })
  if (!entry || !grid.walkable(entry.i, entry.j)) throw new Error(`${site.id}: blocked road access`)
  return { settlementId: site.id, profile: site.profile, civ: site.civ, i: entry.i, j: entry.j }
}

function findRoute(start, end, terrain, grid, existing) {
  const { stride, forest, step, index } = grid
  const target = index(end),
    origin = index(start)
  // Restrict ordinary searches locally, but retry across the full map when needed.
  for (const padding of [32, 128, stride]) {
    const minI = Math.max(0, Math.min(start.i, end.i) - padding)
    const maxI = Math.min(stride - 1, Math.max(start.i, end.i) + padding)
    const minJ = Math.max(0, Math.min(start.j, end.j) - padding)
    const maxJ = Math.min(stride - 1, Math.max(start.j, end.j) + padding)
    const heap = new MinHeap(),
      scores = new Map([[origin, 0]]),
      parents = new Map()
    const heuristic = (i, j) => 0.65 * (Math.abs(i - end.i) + Math.abs(j - end.j))
    heap.push({ id: origin, g: 0, f: heuristic(start.i, start.j) })
    while (heap.items.length) {
      const current = heap.pop()
      if (current.g !== scores.get(current.id)) continue
      if (current.id === target) {
        const cells = [target]
        while (cells[cells.length - 1] !== origin) cells.push(parents.get(cells[cells.length - 1]))
        return cells.reverse()
      }
      const i = Math.floor(current.id / stride),
        j = current.id % stride
      for (const [di, dj] of DIRECTIONS) {
        const a = i + di,
          b = j + dj
        if (a < minI || a > maxI || b < minJ || b > maxJ || !step(i, j, a, b)) continue
        const id = a * stride + b,
          cell = terrain[a][b]
        const height = Math.abs((cell.z ?? 0) - (terrain[i][j].z ?? 0))
        const cost = existing.has(id)
          ? 0.65
          : 1 + forest[id] * 0.35 + (['Jungle', 'DarkForest'].includes(cell.type) ? 1.5 : 0)
        const g = current.g + cost + height * 5 + (cell.inclined ? 0.6 : 0)
        if (g >= (scores.get(id) ?? Infinity)) continue
        scores.set(id, g)
        parents.set(id, current.id)
        heap.push({ id, g, f: g + heuristic(a, b) })
      }
    }
  }
  return null
}

function prepareSettlementRoads(prepared, terrain) {
  const sites = prepared.settlements.filter(s => ['city', 'village'].includes(s.profile))
  const grid = roadTerrain(prepared, terrain)
  const anchors = sites.map(s => settlementAccess(s, prepared, grid))
  // Label reachable land once: disconnected islands must never cause repeated full-map searches.
  const components = new Uint32Array(grid.count)
  let component = 0
  for (const anchor of anchors) {
    const start = grid.index(anchor)
    if (components[start]) continue
    component++
    const queue = [start]
    components[start] = component
    for (let q = 0; q < queue.length; q++) {
      const id = queue[q],
        i = Math.floor(id / grid.stride),
        j = id % grid.stride
      for (const [di, dj] of DIRECTIONS) {
        const a = i + di,
          b = j + dj,
          next = a * grid.stride + b
        if (!grid.step(i, j, a, b) || components[next]) continue
        components[next] = component
        queue.push(next)
      }
    }
  }
  const groups = Array.from({ length: component }, (_, c) =>
    anchors.filter(a => components[grid.index(a)] === c + 1).map(a => a.settlementId)
  )
  const candidates = []
  for (let a = 0; a < anchors.length; a++)
    for (let b = a + 1; b < anchors.length; b++) {
      if (components[grid.index(anchors[a])] !== components[grid.index(anchors[b])]) continue
      candidates.push({ a, b, distance: Math.hypot(anchors[a].i - anchors[b].i, anchors[a].j - anchors[b].j) })
    }
  candidates.sort((a, b) => a.distance - b.distance || a.a - b.a || a.b - b.b)
  const roots = anchors.map((_, i) => i),
    root = i => (roots[i] === i ? i : (roots[i] = root(roots[i])))
  const occupied = new Set(),
    routes = []
  for (const { a, b } of candidates) {
    if (root(a) === root(b)) continue
    const cells = findRoute(anchors[a], anchors[b], terrain, grid, occupied)
    if (!cells)
      throw new Error(
        `Road routing failed inside connected land: ${anchors[a].settlementId} / ${anchors[b].settlementId}`
      )
    roots[root(b)] = root(a)
    for (const id of cells) occupied.add(id)
    routes.push({ from: anchors[a].settlementId, to: anchors[b].settlementId, cells })
  }
  // Only actual traversed edges connect: adjacent parallel stretches must not
  // turn into a ladder of spurious junctions when choosing atlas sprites.
  const masks = new Map([...occupied].map(id => [id, 0]))
  for (const route of routes)
    for (let k = 1; k < route.cells.length; k++) {
      const from = route.cells[k - 1],
        to = route.cells[k]
      const di = Math.floor(to / grid.stride) - Math.floor(from / grid.stride)
      const dj = (to % grid.stride) - (from % grid.stride)
      const direction = DIRECTIONS.findIndex(([a, b]) => di === a && dj === b)
      if (direction < 0) throw new Error('Non-contiguous road route')
      masks.set(from, masks.get(from) | (1 << direction))
      masks.set(to, masks.get(to) | (1 << (direction + 2) % 4))
    }
  const cells = [...masks].sort((a, b) => a[0] - b[0])
  return {
    version: 1,
    type: 'dirt',
    stride: grid.stride,
    encoding: 'grid-index',
    directions: ['NE', 'SE', 'SW', 'NW'],
    anchors,
    routes,
    cells,
    components: groups,
    summary: { settlements: anchors.length, routes: routes.length, cells: cells.length, components: groups.length },
  }
}
module.exports = { prepareSettlementRoads, roadTerrain }
