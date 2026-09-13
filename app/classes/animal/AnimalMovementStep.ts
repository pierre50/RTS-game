import { canReachContact } from '../../lib/contact/contactGeometry'
import { tryStartAnimalContactApproach } from './AnimalContactApproach'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import {
  cartesianToIsometric,
  degreeToDirection,
  getInstanceDegree,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  moveTowardPoint,
  updateInstanceVisibility,
} from '../../lib'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import {
  drainEnergyAmount,
  getActionEnergyCost,
  getEnergyMoveSpeedMultiplier,
  updateUnitEnergy,
} from '../../lib/units/unitEnergy'
import { getReliefMovementDistance } from '../../lib/terrain/reliefMovement'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import { isAirborne } from './locomotion'
import type { AnimalControllerHost } from './AnimalTypes'

function getMovementSpeed(animal: AnimalControllerHost): number {
  if (animal.movementSheet === SHEET_TYPES.flying && typeof animal.flyingSpeed === 'number') return animal.flyingSpeed
  if (animal.movementSheet === SHEET_TYPES.running && typeof animal.runningSpeed === 'number')
    return animal.runningSpeed
  return animal.speed
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
  animal.currentCell = nextCell
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
    animal.sendTo(animal.dest, animal.action ?? null, {
      forceRepath: true,
      ...(animal.movementSheet ? { movementSheet: animal.movementSheet } : {}),
    })
    return true
  }
  const inRange =
    animal.dest &&
    (animal.action === ACTION_TYPES.attack && 'family' in animal.dest
      ? canReachContact(animal, animal.dest)
      : instanceContactInstance(animal, animal.dest))
  if (animal.action && animal.dest && inRange) {
    animal.path = []
    animal.stopInterval()
    animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y)
    animal.getAction(animal.action)
    return true
  }
  if (!animal.path.length) animal.stop()
  return false
}

function moveTowardNextCell(
  animal: AnimalControllerHost,
  nextFlatX: number,
  nextFlatY: number,
  moveSpeed: number
): void {
  const oldDeg = animal.degree
  moveTowardPoint(animal, nextFlatX, nextFlatY, moveSpeed)
  animal.zIndex = getInstanceZIndex(animal)
  const movementSheet = animal.movementSheet ?? SHEET_TYPES.walking
  if (animal.currentSheet !== movementSheet || degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
    animal.setTextures(movementSheet)
  }
}

export function moveAnimalToPath(animal: AnimalControllerHost): void {
  if (animal.isDead || animal.isDestroyed) return
  updateUnitEnergy(animal, STEP_TIME)
  const runtimeMap = animal.context.map
  const map = getEntitySpaceMapLike(animal, runtimeMap)
  if (!map) return
  const next = animal.path[animal.path.length - 1]
  const nextCell = next && map.grid[next.i]?.[next.j]
  if (!nextCell) {
    animal.path = []
    animal.stop()
    return
  }
  const [nextFlatX, nextFlatY] = cartesianToIsometric(nextCell.i, nextCell.j)
  const nextFlatPoint = { i: nextCell.i, j: nextCell.j, x: nextFlatX, y: nextFlatY }

  if (!canContinueAnimalStep(animal, nextCell)) return
  if (!animal.sprite.playing) animal.sprite.play()

  const isFastFlee = animal.isFleeing && [SHEET_TYPES.running, SHEET_TYPES.flying].includes(animal.movementSheet ?? '')
  // Fleeing energy is charged once per tick, including the final partial step.
  if (isFastFlee) drainEnergyAmount(animal, getActionEnergyCost(animal, ACTION_TYPES.flee) * (STEP_TIME / 1000))
  const budget = getMovementSpeed(animal) * getEnergyMoveSpeedMultiplier(animal)
  const remaining = Math.hypot(nextFlatX - animal.x, nextFlatY - animal.y)
  const moveSpeed = isAirborne(animal)
    ? Math.min(remaining, budget)
    : getReliefMovementDistance(map, animal, nextFlatPoint, budget, animal.currentCell)
  if (remaining > 0) moveTowardNextCell(animal, nextFlatX, nextFlatY, moveSpeed)
  const arrived = remaining <= moveSpeed + 1e-6
  if (arrived) settleOnNextCell(animal, nextCell)
  syncEntityRelief(map, animal)
  if (arrived) resolveArrivalAfterStep(animal)
}

function canContinueAnimalStep(animal: AnimalControllerHost, nextCell: AnimalControllerHost['currentCell']): boolean {
  if (!animal.dest || ('isDestroyed' in animal.dest && animal.dest.isDestroyed)) {
    animal.affectNewDest()
    return false
  }
  if ('family' in animal.dest && tryStartAnimalContactApproach(animal, animal.dest, animal.action ?? null)) return false
  if (isBlockedByMovingAnimal(animal, nextCell)) {
    pauseForBlockedAnimal(animal)
    return false
  }
  if ((nextCell.solid || nextCell.category === 'Water') && animal.dest) {
    animal.sendTo(animal.dest, animal.action, {
      forceRepath: true,
      ...(animal.movementSheet ? { movementSheet: animal.movementSheet } : {}),
    })
    return false
  }

  return true
}
