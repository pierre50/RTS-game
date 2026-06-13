import { findInstancePath } from '../../services/Pathfinding'
import { randomItem, instancesDistance, pointsDistance, getInstanceDegree } from '../maths'
import { getCellsAroundPoint } from './cells'

export function instanceContactInstance(a, b) {
  return Math.floor(instancesDistance(a, b)) <= (b.size - 1 || 1) && !b.isDestroyed
}

export function moveTowardPoint(instance, x, y, speed) {
  const dist = pointsDistance(x, y, instance.x, instance.y)
  if (dist === 0) return

  const tX = x - instance.x
  const tY = y - instance.y
  const velX = (tX / dist) * speed
  const velY = (tY / dist) * speed

  instance.degree = getInstanceDegree(instance, x, y)
  instance.x += velX
  instance.y += velY
}

export function getFreeCellAroundPoint(x, y, size, grid, condition, pickRandomItem = randomItem) {
  const maxDistance = 50

  for (let distance = size; distance < maxDistance; distance++) {
    const cells = getCellsAroundPoint(x, y, grid, distance, condition)
    if (cells.length > 0) return pickRandomItem(cells)
  }

  return null
}

export function getInstanceClosestFreeCellPath(instance, target, map) {
  const size = target.size || (target.has && target.has.size) || 1
  const distance = size === 3 ? 2 : 1

  const candidates = getCellsAroundPoint(target.i, target.j, map.grid, distance)
  candidates.sort(
    (a, b) =>
      Math.abs(a.i - instance.i) +
      Math.abs(a.j - instance.j) -
      (Math.abs(b.i - instance.i) + Math.abs(b.j - instance.j))
  )

  let best = []
  for (const cell of candidates) {
    if (best.length && Math.abs(cell.i - instance.i) + Math.abs(cell.j - instance.j) >= best.length) break
    const path = getInstancePath(instance, cell.i, cell.j, map)
    if (path.length && (!best.length || path.length < best.length)) best = path
  }
  return best
}

export function getInstancePath(instance, x, y, map) {
  return findInstancePath(instance, x, y, map)
}
