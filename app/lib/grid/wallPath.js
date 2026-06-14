const CARDINAL_DIRECTIONS = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
]

function keyOf(cell) {
  return `${cell.i}:${cell.j}`
}

function distance(a, b) {
  return Math.abs(a.i - b.i) + Math.abs(a.j - b.j)
}

function rebuildPath(cameFrom, end) {
  const path = [end]
  let current = end
  while (cameFrom.has(keyOf(current))) {
    current = cameFrom.get(keyOf(current))
    path.push(current)
  }
  return path.reverse()
}

export function findWallPath(grid, start, end, canUseCell) {
  if (!start || !end) return []
  if (start === end) return [start]

  const open = [start]
  const openKeys = new Set([keyOf(start)])
  const closed = new Set()
  const cameFrom = new Map()
  const scores = new Map([[keyOf(start), 0]])

  while (open.length) {
    let bestIndex = 0
    let bestScore = Infinity
    for (let index = 0; index < open.length; index++) {
      const cell = open[index]
      const score = (scores.get(keyOf(cell)) ?? Infinity) + distance(cell, end)
      if (score < bestScore) {
        bestIndex = index
        bestScore = score
      }
    }

    const current = open.splice(bestIndex, 1)[0]
    const currentKey = keyOf(current)
    openKeys.delete(currentKey)
    if (current === end) return rebuildPath(cameFrom, end)
    closed.add(currentKey)

    for (const [di, dj] of CARDINAL_DIRECTIONS) {
      const neighbour = grid[current.i + di]?.[current.j + dj]
      if (!neighbour) continue
      const neighbourKey = keyOf(neighbour)
      if (closed.has(neighbourKey) || !canUseCell(neighbour, neighbour === end)) continue

      const nextScore = (scores.get(currentKey) ?? Infinity) + 1
      if (nextScore >= (scores.get(neighbourKey) ?? Infinity)) continue
      cameFrom.set(neighbourKey, current)
      scores.set(neighbourKey, nextScore)
      if (!openKeys.has(neighbourKey)) {
        open.push(neighbour)
        openKeys.add(neighbourKey)
      }
    }
  }

  return []
}

export function getWallFrame(hasNorthSouth, hasEastWest, isEndpoint = false) {
  if (isEndpoint || (hasNorthSouth && hasEastWest)) return 2
  return hasNorthSouth ? 1 : 0
}
