import { cellIsDiag, instancesDistance } from '../lib/maths'
import { getSquareCellsAroundPoint } from '../lib/grid/cells'

let pathStamp = 0

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
type HeapEntry = [number, PathCell]

function getNeighbourCells(
  startX: number,
  startY: number,
  grid: PathGrid,
  dist: number,
  callback?: (cell: PathCell) => boolean | void
): PathCell[] {
  return getSquareCellsAroundPoint(startX, startY, grid, dist, callback, dist === 0)
}

function heapPush(heapData: HeapEntry[], f: number, node: PathCell): void {
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

const _heapData: HeapEntry[] = []
const _openSet = new Set<PathCell>()
const _closedSet = new Set<PathCell>()

type PathInstance = {
  i: number
  j: number
  label?: string
}

type PathMap<TCell extends PathCell = PathCell> = {
  context?: {
    performance?: {
      record: (name: string, duration: number) => void
    }
  }
  grid: PathGrid<TCell>
  size?: number
}

export function findInstancePath<TCell extends PathCell>(
  instance: PathInstance,
  x: number,
  y: number,
  map: PathMap<TCell>
): TCell[] {
  const startedAt = performance.now()
  const maxZone = 10
  const end = map.grid[x]?.[y]
  const start = map.grid[instance.i]?.[instance.j]
  if (!start || !end) return []
  const mapSize = map.size ?? map.grid.length - 1
  const minX = Math.max(Math.min(start.i, end.i) - maxZone, 0)
  const maxX = Math.min(Math.max(start.i, end.i) + maxZone, mapSize)
  const minY = Math.max(Math.min(start.j, end.j) - maxZone, 0)
  const maxY = Math.min(Math.max(start.j, end.j) + maxZone, mapSize)

  const stamp = ++pathStamp
  _heapData.length = 0
  _openSet.clear()
  _closedSet.clear()

  function initCell(cell: PathCell): PathCell {
    if (cell._ps !== stamp) {
      cell._ps = stamp
      cell._g = Infinity
      cell._h = 0
      cell._f = Infinity
      cell._prev = null
    }
    return cell
  }

  function isCellOccupiedByPathingInstance(cell?: PathCell): boolean {
    return Boolean(instance.label && cell?.has?.label === instance.label)
  }

  function isCellReachable(cell?: PathCell): boolean {
    if (!cell) return false
    if (cell.solid && !isCellOccupiedByPathingInstance(cell)) return false
    return cell.category !== 'Water' && !cell.waterBorder
  }

  const startCell = initCell(start)
  const endCell = initCell(end)

  startCell._g = 0
  startCell._h = instancesDistance(startCell, endCell)
  startCell._f = startCell._h
  heapPush(_heapData, startCell._f, startCell)
  _openSet.add(startCell)

  let path: TCell[] = []

  while (_heapData.length > 0) {
    const [pushedF, current] = heapPop(_heapData)
    if (pushedF !== current._f || _closedSet.has(current)) continue

    if (current === endCell) {
      path = [endCell as TCell]
      let temp = current
      while (temp._prev) {
        path.push(temp._prev as TCell)
        temp = temp._prev
      }
      break
    }

    _openSet.delete(current)
    _closedSet.add(current)

    getNeighbourCells(current.i, current.j, map.grid, 1, (neighbour: PathCell) => {
      if (neighbour.i < minX || neighbour.i > maxX || neighbour.j < minY || neighbour.j > maxY) return
      initCell(neighbour)
      const validDiag =
        !cellIsDiag(current, neighbour) ||
        (isCellReachable(map.grid[current.i]?.[neighbour.j]) && isCellReachable(map.grid[neighbour.i]?.[current.j]))
      if (!_closedSet.has(neighbour) && isCellReachable(neighbour) && validDiag) {
        const tempG = (current._g ?? Infinity) + instancesDistance(neighbour, current)
        if (!_openSet.has(neighbour)) {
          neighbour._g = tempG
          neighbour._h = instancesDistance(neighbour, endCell)
          neighbour._f = neighbour._g + neighbour._h
          neighbour._prev = current
          _openSet.add(neighbour)
          heapPush(_heapData, neighbour._f, neighbour)
        } else if (tempG < (neighbour._g ?? Infinity)) {
          neighbour._g = tempG
          neighbour._f = neighbour._g + (neighbour._h ?? 0)
          neighbour._prev = current
          heapPush(_heapData, neighbour._f, neighbour)
        }
      }
    })
  }

  path.pop()
  map.context?.performance?.record('pathfinding', performance.now() - startedAt)
  return [...path]
}
