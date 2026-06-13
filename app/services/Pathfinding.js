import { cellIsDiag, instancesDistance } from '../lib/maths'

let pathStamp = 0

function getNeighbourCells(startX, startY, grid, dist, callback) {
  const result = []
  const startCell = grid[startX]?.[startY]
  if (dist === 0) {
    if (startCell && (!callback || callback(startCell))) result.push(startCell)
    return result
  }

  for (let dx = -dist; dx <= dist; dx++) {
    const x = startX + dx
    const row = grid[x]
    if (!row) continue

    for (let dy = -dist; dy <= dist; dy++) {
      if (dx === 0 && dy === 0) continue
      const y = startY + dy
      const cell = row[y]
      if (!cell) continue

      if (!callback || callback(cell)) result.push(cell)
    }
  }

  return result
}

function heapPush(heapData, f, node) {
  heapData.push([f, node])
  let i = heapData.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heapData[parent][0] <= heapData[i][0]) break
    ;[heapData[parent], heapData[i]] = [heapData[i], heapData[parent]]
    i = parent
  }
}

function heapPop(heapData) {
  const top = heapData[0]
  const last = heapData.pop()
  if (heapData.length > 0) {
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

const _heapData = []
const _openSet = new Set()
const _closedSet = new Set()

export function findInstancePath(instance, x, y, map) {
  const maxZone = 10
  const end = map.grid[x][y]
  const start = map.grid[instance.i][instance.j]
  const minX = Math.max(Math.min(start.i, end.i) - maxZone, 0)
  const maxX = Math.min(Math.max(start.i, end.i) + maxZone, map.size)
  const minY = Math.max(Math.min(start.j, end.j) - maxZone, 0)
  const maxY = Math.min(Math.max(start.j, end.j) + maxZone, map.size)

  const stamp = ++pathStamp
  _heapData.length = 0
  _openSet.clear()
  _closedSet.clear()

  function initCell(cell) {
    if (cell._ps !== stamp) {
      cell._ps = stamp
      cell._g = Infinity
      cell._h = 0
      cell._f = Infinity
      cell._prev = null
    }
    return cell
  }

  function isCellReachable(cell) {
    if (cell.solid) return false
    const allowWaterCellCategory = instance.category === 'Boat'
    return allowWaterCellCategory ? cell.category === 'Water' : cell.category !== 'Water'
  }

  const startCell = initCell(start)
  const endCell = initCell(end)

  startCell._g = 0
  startCell._h = instancesDistance(startCell, endCell)
  startCell._f = startCell._h
  heapPush(_heapData, startCell._f, startCell)
  _openSet.add(startCell)

  let path = []

  while (_heapData.length > 0) {
    const [pushedF, current] = heapPop(_heapData)
    if (pushedF !== current._f || _closedSet.has(current)) continue

    if (current === endCell) {
      path = [endCell]
      let temp = current
      while (temp._prev) {
        path.push(temp._prev)
        temp = temp._prev
      }
      break
    }

    _openSet.delete(current)
    _closedSet.add(current)

    getNeighbourCells(current.i, current.j, map.grid, 1, neighbour => {
      if (neighbour.i < minX || neighbour.i > maxX || neighbour.j < minY || neighbour.j > maxY) return
      initCell(neighbour)
      const validDiag =
        !cellIsDiag(current, neighbour) ||
        (isCellReachable(map.grid[current.i][neighbour.j]) && isCellReachable(map.grid[neighbour.i][current.j]))
      if (!_closedSet.has(neighbour) && isCellReachable(neighbour) && validDiag) {
        const tempG = current._g + instancesDistance(neighbour, current)
        if (!_openSet.has(neighbour)) {
          neighbour._g = tempG
          neighbour._h = instancesDistance(neighbour, endCell)
          neighbour._f = neighbour._g + neighbour._h
          neighbour._prev = current
          _openSet.add(neighbour)
          heapPush(_heapData, neighbour._f, neighbour)
        } else if (tempG < neighbour._g) {
          neighbour._g = tempG
          neighbour._f = neighbour._g + neighbour._h
          neighbour._prev = current
          heapPush(_heapData, neighbour._f, neighbour)
        }
      }
    })
  }

  path.pop()
  return [...path]
}
