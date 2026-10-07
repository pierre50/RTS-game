import { cellIsDiag, instancesDistance } from '../lib/maths'
import { getSquareCellsAroundPoint } from '../lib/grid/cells'

type PathCell = {
  _f?: number
  _g?: number
  _h?: number
  _prev?: PathCell | null
  _ps?: number
  category?: string
  has?: { label?: string } | null
  i: number
  j: number
  solid?: boolean
  waterBorder?: boolean
}

type PathGrid<TCell extends PathCell = PathCell> = Array<Array<TCell | undefined> | undefined>
type SearchNode = { cell: PathCell; g: number; f: number; prev: SearchNode | null }
type HeapEntry = [number, SearchNode]

function getNeighbourCells(
  startX: number,
  startY: number,
  grid: PathGrid,
  dist: number,
  callback?: (cell: PathCell) => boolean | void
): PathCell[] {
  return getSquareCellsAroundPoint(startX, startY, grid, dist, callback, dist === 0)
}

function heapPush(heapData: HeapEntry[], f: number, node: SearchNode): void {
  heapData.push([f, node])
  let i = heapData.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heapData[parent][0] <= heapData[i][0]) break
    ;[heapData[parent], heapData[i]] = [heapData[i], heapData[parent]]
    i = parent
  }
}

function heapPop(heapData: HeapEntry[]): HeapEntry {
  const top = heapData[0]
  const last = heapData.pop()
  if (heapData.length > 0 && last) {
    heapData[0] = last
    let i = 0
    while (true) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let s = i
      if (l < heapData.length && heapData[l][0] < heapData[s][0]) s = l
      if (r < heapData.length && heapData[r][0] < heapData[s][0]) s = r
      if (s === i) break
      ;[heapData[s], heapData[i]] = [heapData[i], heapData[s]]
      i = s
    }
  }
  return top
}

type PathInstance = {
  i: number
  j: number
  label?: string
}

type PathMap<TCell extends PathCell = PathCell> = {
  context?: {
    performance?: {
      record: (name: string, duration: number) => void
    } | null
  }
  grid: PathGrid<TCell>
  size?: number
}

export type PathfindingOptions<TCell extends PathCell = PathCell> = {
  canPassThroughSolidCell?: (cell: TCell) => boolean
}

/** Each search owns its state, so yielding cannot corrupt another unit's route. */
export function* searchInstancePath<TCell extends PathCell>(
  instance: PathInstance,
  x: number,
  y: number,
  map: PathMap<TCell>,
  options: PathfindingOptions<TCell> = {}
): Generator<void, TCell[], void> {
  const end = map.grid[x]?.[y]
  const start = map.grid[instance.i]?.[instance.j]
  if (!start || !end || !isReachable(instance, end, options)) return []
  const mapSize = map.size ?? map.grid.length - 1
  const minX = Math.max(Math.min(start.i, end.i) - 10, 0)
  const maxX = Math.min(Math.max(start.i, end.i) + 10, mapSize)
  const minY = Math.max(Math.min(start.j, end.j) - 10, 0)
  const maxY = Math.min(Math.max(start.j, end.j) + 10, mapSize)
  const heap: HeapEntry[] = []
  const nodes = new Map<PathCell, SearchNode>()
  const closed = new Set<PathCell>()
  const first: SearchNode = { cell: start, g: 0, f: instancesDistance(start, end), prev: null }
  nodes.set(start, first)
  heapPush(heap, first.f, first)
  let processed = 0
  let startedAt = performance.now()
  while (heap.length) {
    // A bounded batch also bounds stale heap entries, not only visited cells.
    if (++processed > 64) {
      map.context?.performance?.record('pathfinding.slice', performance.now() - startedAt)
      yield
      startedAt = performance.now()
      processed = 1
    }
    const [pushedF, current] = heapPop(heap)
    if (pushedF !== current.f || closed.has(current.cell)) continue
    if (current.cell === end) {
      const path: TCell[] = []
      let node = current
      while (node.prev) {
        path.push(node.cell as TCell)
        node = node.prev
      }
      map.context?.performance?.record('pathfinding.slice', performance.now() - startedAt)
      return path
    }
    closed.add(current.cell)
    getNeighbourCells(current.cell.i, current.cell.j, map.grid, 1, neighbour => {
      if (neighbour.i < minX || neighbour.i > maxX || neighbour.j < minY || neighbour.j > maxY) return
      if (closed.has(neighbour) || !isReachable(instance, neighbour as TCell, options)) return
      if (
        cellIsDiag(current.cell, neighbour) &&
        (!isReachable(instance, map.grid[current.cell.i]?.[neighbour.j], options) ||
          !isReachable(instance, map.grid[neighbour.i]?.[current.cell.j], options))
      )
        return
      const g = current.g + instancesDistance(neighbour, current.cell)
      let node = nodes.get(neighbour)
      if (node && g >= node.g) return
      if (!node) {
        node = { cell: neighbour, g, f: 0, prev: current }
        nodes.set(neighbour, node)
      }
      node.g = g
      node.f = g + instancesDistance(neighbour, end)
      node.prev = current
      heapPush(heap, node.f, node)
    })
  }
  map.context?.performance?.record('pathfinding.slice', performance.now() - startedAt)
  return []
}

function isReachable<TCell extends PathCell>(
  instance: PathInstance,
  cell: TCell | undefined,
  options: PathfindingOptions<TCell>
): boolean {
  return Boolean(
    cell &&
      cell.category !== 'Water' &&
      (!cell.solid || (instance.label && cell.has?.label === instance.label) || options.canPassThroughSolidCell?.(cell))
  )
}

export type PreparedPath<TCell extends PathCell = PathCell> = {
  start: TCell
  path: TCell[]
}

let preparedPaths: PreparedPath[] = []

/** Only expose a decision's routes while committing that decision, never as a global cache. */
export function withPreparedPaths<T>(paths: PreparedPath[], commit: () => T): T {
  const previous = preparedPaths
  preparedPaths = paths
  try {
    return commit()
  } finally {
    preparedPaths = previous
  }
}

export function findInstancePath<TCell extends PathCell>(
  instance: PathInstance,
  x: number,
  y: number,
  map: PathMap<TCell>,
  options: PathfindingOptions<TCell> = {}
): TCell[] {
  const start = map.grid[instance.i]?.[instance.j]
  const end = map.grid[x]?.[y]
  for (const prepared of preparedPaths) {
    if (prepared.start !== start || prepared.path[0] !== end) continue
    if (isPreparedPathValid(instance, prepared, map, options)) return [...prepared.path] as TCell[]
  }
  const startedAt = performance.now()
  const search = searchInstancePath(instance, x, y, { grid: map.grid, size: map.size }, options)
  let step = search.next()
  while (!step.done) step = search.next()
  map.context?.performance?.record('pathfinding', performance.now() - startedAt)
  return step.value
}

export function isPreparedPathValid<TCell extends PathCell>(
  instance: PathInstance,
  prepared: PreparedPath,
  map: PathMap<TCell>,
  options: PathfindingOptions<TCell> = {}
): boolean {
  let previous = prepared.start
  for (let index = prepared.path.length - 1; index >= 0; index--) {
    const cell = prepared.path[index] as TCell
    if (map.grid[cell.i]?.[cell.j] !== cell || !isReachable(instance, cell, options)) return false
    if (
      cellIsDiag(previous, cell) &&
      (!isReachable(instance, map.grid[previous.i]?.[cell.j], options) ||
        !isReachable(instance, map.grid[cell.i]?.[previous.j], options))
    )
      return false
    previous = cell
  }
  return true
}
