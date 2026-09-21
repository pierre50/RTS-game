import type { RuntimeCell, RuntimeMap } from '../../types/map'

const NEIGHBORS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const

function isOpen(cell: RuntimeCell | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.terrainHidden && cell.category !== 'Water')
}

/** Keep the existing floor component connected, including access around furniture. */
export function preservesInteriorPassages(grid: RuntimeMap['grid'], candidate: RuntimeCell): boolean {
  const neighbors = NEIGHBORS.map(([di, dj]) => grid[candidate.i + di]?.[candidate.j + dj]).filter(isOpen)
  if (neighbors.length < 2) return true
  const visited = new Set<RuntimeCell>([neighbors[0]])
  const queue = [neighbors[0]]
  for (let index = 0; index < queue.length; index++) {
    const cell = queue[index]
    for (const [di, dj] of NEIGHBORS) {
      const next = grid[cell.i + di]?.[cell.j + dj]
      if (next === candidate || !isOpen(next) || visited.has(next)) continue
      visited.add(next)
      queue.push(next)
    }
  }
  return neighbors.every(cell => visited.has(cell))
}

export function isNearInteriorDoor(
  cell: RuntimeCell,
  doors: Array<Pick<RuntimeCell, 'i' | 'j'> | null | undefined>
): boolean {
  return doors.some(door => door && Math.max(Math.abs(cell.i - door.i), Math.abs(cell.j - door.j)) <= 1)
}

export function getInteriorRoomCenter(space: {
  walkableCells: RuntimeCell[]
  sleepCells: RuntimeCell[]
  size: number
}): { i: number; j: number } {
  const cells = space.walkableCells.length ? space.walkableCells : space.sleepCells
  const first = cells[0]
  if (!first) return { i: Math.round(space.size / 2), j: Math.round(space.size / 2) }
  const total = cells.reduce(
    (sum, cell) => ({
      i: sum.i + cell.i,
      j: sum.j + cell.j,
    }),
    { i: 0, j: 0 }
  )
  const center = {
    i: total.i / cells.length,
    j: total.j / cells.length,
  }
  const nearest = cells.reduce((best, cell) => {
    const bestDistance = (best.i - center.i) ** 2 + (best.j - center.j) ** 2
    const cellDistance = (cell.i - center.i) ** 2 + (cell.j - center.j) ** 2
    return cellDistance < bestDistance ? cell : best
  }, first)
  return { i: nearest.i, j: nearest.j }
}
