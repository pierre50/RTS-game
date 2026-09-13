import { CELL_DEPTH, RELIEF_MOVEMENT_SAMPLE_DISTANCE, RELIEF_SLOPE_WALK_SPEED } from '../../constants/relief'
import { getReliefLevelAtPoint } from './reliefSurface'

type ReliefMap = Parameters<typeof getReliefLevelAtPoint>[0]
type ReliefCell = Parameters<typeof getReliefLevelAtPoint>[2]
type Point = { x: number; y: number }

function segmentCost(distance: number, dx: number, dy: number, rise: number): number {
  if (distance === 0) return 0
  const steepness = Math.min(1, Math.abs(rise) / distance)
  const speedFactor = 1 - (1 - RELIEF_SLOPE_WALK_SPEED) * steepness
  return Math.max(distance, Math.hypot(dx * distance, dy * distance - rise)) / speedFactor
}

/** Spend a movement budget along the projected feet trajectory. Keep the flat
 * distance as a minimum cost so foreshortened back faces never accelerate units.
 * Return a flat distance for the existing pathing and collision code to use.
 */
export function getReliefMovementDistance(
  map: ReliefMap,
  from: Point,
  to: Point,
  budget: number,
  fallback?: ReliefCell
): number {
  const total = Math.hypot(to.x - from.x, to.y - from.y)
  if (total === 0 || budget <= 0) return 0
  const limit = Math.min(total, budget)
  const dx = (to.x - from.x) / total
  const dy = (to.y - from.y) / total
  const heightAt = (distance: number): number =>
    getReliefLevelAtPoint(map, { x: from.x + dx * distance, y: from.y + dy * distance }, fallback) * CELL_DEPTH
  let distance = 0
  let height = heightAt(0)
  let remaining = budget
  // Integrate short pieces: equal endpoint heights can hide a ridge in between.
  while (distance < limit) {
    const step = Math.min(RELIEF_MOVEMENT_SAMPLE_DISTANCE, limit - distance)
    const nextHeight = heightAt(distance + step)
    const cost = segmentCost(step, dx, dy, nextHeight - height)
    if (cost > remaining + 1e-9) {
      // Resolve the last partial piece against the actual curved height profile.
      let low = 0
      let high = step
      for (let iteration = 0; iteration < 12; iteration++) {
        const mid = (low + high) / 2
        const midHeight = heightAt(distance + mid)
        const midCost = segmentCost(mid, dx, dy, midHeight - height)
        if (midCost <= remaining) low = mid
        else high = mid
      }
      return distance + low
    }
    distance += step
    height = nextHeight
    remaining -= cost
  }
  return distance
}
