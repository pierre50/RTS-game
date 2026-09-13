import { isometricToCartesian } from '../../../lib'
import { getEnergyMoveSpeedMultiplier } from '../../../lib/units/unitEnergy'
import { getReliefMovementDistance } from '../../../lib/terrain/reliefMovement'
import type { UnitEntity } from '../../../types/entities'
import type { DirectMoveAttempt } from './UnitDirectMovementTypes'

/** Shared by movement and its diagnostic preview. Does not mutate the unit. */
export function getDirectMoveCandidate(
  unit: UnitEntity,
  map: DirectMoveAttempt['map'],
  dirX: number,
  dirY: number,
  distance: number
) {
  const moveBudget = distance * getEnergyMoveSpeedMultiplier(unit)
  const effectiveDistance = getReliefMovementDistance(
    map,
    unit,
    { x: unit.x + dirX * moveBudget, y: unit.y + dirY * moveBudget },
    moveBudget,
    unit.currentCell
  )
  const candidateX = unit.x + dirX * effectiveDistance
  const candidateY = unit.y + dirY * effectiveDistance
  const [rawI, rawJ] = isometricToCartesian(candidateX, candidateY)
  const newI = Math.min(Math.max(rawI, 0), map.size)
  const newJ = Math.min(Math.max(rawJ, 0), map.size)
  const crossingCell = newI !== unit.i || newJ !== unit.j
  const targetCell = crossingCell ? map.grid[newI]?.[newJ] : unit.currentCell
  return { candidateX, candidateY, rawI, rawJ, newI, newJ, crossingCell, targetCell, effectiveDistance }
}
