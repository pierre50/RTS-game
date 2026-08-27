import { ACTION_TYPES, FAMILY_TYPES, RELIEF_CLIMB_SPEED_MULTIPLIER, SHEET_TYPES, STEP_TIME } from '../../constants'
import {
  cartesianToIsometric,
  degreeToDirection,
  getGroundReliefLevel,
  getInstanceDegree,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  moveTowardPoint,
  updateInstanceVisibility,
} from '../../lib'
import {
  drainEnergyAmount,
  getActionEnergyCost,
  getEnergyMoveSpeedMultiplier,
  updateUnitEnergy,
} from '../../lib/units/unitEnergy'
import { isAirborne } from './locomotion'
import type { AnimalControllerHost } from './AnimalTypes'

function getMovementSpeed(animal: AnimalControllerHost): number {
  if (animal.movementSheet === SHEET_TYPES.flying && typeof animal.flyingSpeed === 'number') return animal.flyingSpeed
  if (animal.movementSheet === SHEET_TYPES.running && typeof animal.runningSpeed === 'number') return animal.runningSpeed
  return animal.speed
}

function syncReliefLiftTowardNextCell(animal: AnimalControllerHost, nextFlatPoint: { i: number; j: number; x: number; y: number }): void {
  if (!animal.currentCell) return
  const nextCell = animal.context.map.grid[nextFlatPoint.i][nextFlatPoint.j]
  const from = getGroundReliefLevel(animal.currentCell)
  const to = getGroundReliefLevel(nextCell)
  const total = instancesDistance(animal.currentCell, nextCell, false) || 1
  const remaining = Math.min(instancesDistance(animal, nextFlatPoint, false), total)
  animal.applyReliefLift(to + (from - to) * (remaining / total))
}

function isBlockedByMovingAnimal(animal: AnimalControllerHost, nextCell: AnimalControllerHost['currentCell']): boolean {
  return Boolean(
    nextCell.has &&
      nextCell.has.family === FAMILY_TYPES.animal &&
      nextCell.has.label !== animal.label &&
      'hasPath' in nextCell.has &&
      typeof nextCell.has.hasPath === 'function' &&
      nextCell.has.hasPath() &&
      instancesDistance(animal, nextCell.has) <= 1 &&
      nextCell.has.sprite instanceof Object &&
      'playing' in nextCell.has.sprite &&
      nextCell.has.sprite.playing
  )
}

function pauseForBlockedAnimal(animal: AnimalControllerHost): void {
  if (isAirborne(animal)) {
    if (!animal.sprite.playing) animal.sprite.play()
  } else {
    animal.sprite.stop()
  }
}

function settleOnNextCell(animal: AnimalControllerHost, nextCell: AnimalControllerHost['currentCell']): void {
  const map = animal.context.map
  const oldI = animal.i
  const oldJ = animal.j
  animal.z = nextCell.z
  animal.i = nextCell.i
  animal.j = nextCell.j
  animal.zIndex = getInstanceZIndex(animal)
  if (animal.currentCell.has === animal) {
    animal.currentCell.has = null
    animal.currentCell.solid = false
  }
  animal.currentCell = map.grid[animal.i][animal.j]
  if (animal.currentCell.has === null) {
    animal.currentCell.place(animal)
    animal.currentCell.solid = true
  }
  map.updateInstanceBucket(animal, oldI, oldJ)
  updateInstanceVisibility(animal)
  animal.path.pop()
}

function destHasMoved(animal: AnimalControllerHost): boolean {
  if (!animal.dest || !animal.realDest) return false
  return (
    (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) &&
    instancesDistance(animal, animal.dest) <= animal.sight
  )
}

function resolveArrivalAfterStep(animal: AnimalControllerHost): boolean {
  if (destHasMoved(animal)) {
    animal.sendTo(animal.dest, animal.action ?? null, { forceRepath: true, movementSheet: animal.movementSheet })
    return true
  }
  if (animal.action && animal.dest && instanceContactInstance(animal, animal.dest)) {
    animal.path = []
    animal.stopInterval()
    animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y)
    animal.getAction(animal.action)
    return true
  }
  if (!animal.path.length) animal.stop()
  return false
}

function moveTowardNextCell(animal: AnimalControllerHost, nextFlatX: number, nextFlatY: number, moveSpeed: number): void {
  const oldDeg = animal.degree
  const isFastFlee = animal.isFleeing && [SHEET_TYPES.running, SHEET_TYPES.flying].includes(animal.movementSheet ?? '')
  if (isFastFlee) drainEnergyAmount(animal, getActionEnergyCost(animal, ACTION_TYPES.flee))
  let speed = moveSpeed * getEnergyMoveSpeedMultiplier(animal)
  const nextCell = animal.context.map.grid[animal.path[animal.path.length - 1].i][animal.path[animal.path.length - 1].j]
  if (nextCell.inclined || (nextCell.z ?? 0) > (animal.currentCell?.z ?? 0)) speed *= RELIEF_CLIMB_SPEED_MULTIPLIER
  moveTowardPoint(animal, nextFlatX, nextFlatY, speed)
  if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
    animal.setTextures(animal.movementSheet ?? SHEET_TYPES.walking)
  }
}

export function moveAnimalToPath(animal: AnimalControllerHost): void {
  if (animal.isDead || animal.isDestroyed) return
  updateUnitEnergy(animal, STEP_TIME)
  const {
    context: { map },
  } = animal
  const next = animal.path[animal.path.length - 1]
  const nextCell = map.grid[next.i][next.j]
  const [nextFlatX, nextFlatY] = cartesianToIsometric(nextCell.i, nextCell.j)
  const nextFlatPoint = { i: nextCell.i, j: nextCell.j, x: nextFlatX, y: nextFlatY }
  syncReliefLiftTowardNextCell(animal, nextFlatPoint)

  if (!animal.dest || ('isDestroyed' in animal.dest && animal.dest.isDestroyed)) {
    animal.affectNewDest()
    return
  }
  if (isBlockedByMovingAnimal(animal, nextCell)) {
    pauseForBlockedAnimal(animal)
    return
  }
  if ((nextCell.solid || nextCell.category === 'Water') && animal.dest) {
    animal.sendTo(animal.dest, animal.action, { forceRepath: true, movementSheet: animal.movementSheet })
    return
  }
  if (!animal.sprite.playing) animal.sprite.play()

  const moveSpeed = getMovementSpeed(animal)
  if (instancesDistance(animal, nextFlatPoint, false) < moveSpeed) {
    settleOnNextCell(animal, nextCell)
    resolveArrivalAfterStep(animal)
    return
  }
  moveTowardNextCell(animal, nextFlatX, nextFlatY, moveSpeed)
}
