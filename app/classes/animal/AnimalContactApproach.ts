import { getReliefMovementDistance } from '../../lib/terrain/reliefMovement'
import { syncEntityRelief } from '../../lib/terrain/reliefSurface'
import { isAirborne } from './locomotion'
import { ACTION_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import { CONTACT_APPROACH } from '../../config/contactProfiles'
import { startContactApproach } from '../../lib/contact/contactApproach'
import { sampleContactApproach, getContactTargetShape } from '../../lib/contact/contactGeometry'
import type { ContactApproachSample } from '../../lib/contact/contactTypes'
import { pointIsInsidePolygon } from '../../lib/geometry/polygon'
import { getEntitySpaceMapLike, sameMapSpace } from '../../lib/mapSpaces'
import { degreeToDirection, getInstanceZIndex, isometricToCartesian } from '../../lib/maths'
import { updateInstanceVisibility } from '../../lib/grid/visibility'
import { getEnergyMoveSpeedMultiplier, updateUnitEnergy } from '../../lib/units/unitEnergy'
import type { RuntimeEntity } from '../../types/entities'
import type { AnimalControllerHost } from './AnimalTypes'

function moveCloser(animal: AnimalControllerHost, target: RuntimeEntity, sample: ContactApproachSample): boolean {
  const map = getEntitySpaceMapLike(animal, animal.context.map)
  if (!map) return false
  const aim = sample.point
  const dx = aim.x - animal.x
  const dy = aim.y - animal.y
  const distance = Math.hypot(dx, dy)
  if (!distance) return false
  const speed = animal.movementSheet === SHEET_TYPES.running ? (animal.runningSpeed ?? animal.speed) : animal.speed
  const budget = Math.min(CONTACT_APPROACH.maxStep, speed * getEnergyMoveSpeedMultiplier(animal), distance)
  const step = isAirborne(animal) ? budget : getReliefMovementDistance(map, animal, aim, budget, animal.currentCell)
  if (step <= 0) return false
  const point = { x: animal.x + (dx / distance) * step, y: animal.y + (dy / distance) * step }
  const [i, j] = isometricToCartesian(point.x, point.y)
  const cell = map.grid[i]?.[j]
  if (!cell || cell.category === 'Water' || cell.border || ((cell.solid || cell.has) && cell.has !== animal))
    return false
  if (approachPointBlocked(animal, target, map, i, j, point)) return false
  commitContactStep(animal, sample, point, cell)
  return true
}

function approachPointBlocked(
  animal: AnimalControllerHost,
  target: RuntimeEntity,
  map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>,
  i: number,
  j: number,
  point: { x: number; y: number }
): boolean {
  // Do not cross the visible ground footprint of nearby entities, even inside
  // the animal's own cell. Cell occupancy alone cannot protect that last step.
  const candidates = new Set<RuntimeEntity>([target])
  for (let row = Math.max(0, i - 1); row <= i + 1; row++) {
    for (let column = Math.max(0, j - 1); column <= j + 1; column++) {
      const occupant = map.grid[row]?.[column]?.has
      if (occupant && occupant !== animal && !occupant.isDestroyed) candidates.add(occupant)
    }
  }
  return [...candidates].some(entity => pointIsInsidePolygon(getContactTargetShape(entity), point))
}

function commitContactStep(
  animal: AnimalControllerHost,
  sample: ContactApproachSample,
  point: { x: number; y: number },
  cell: AnimalControllerHost['currentCell']
): void {
  const oldI = animal.i
  const oldJ = animal.j
  animal.x = point.x
  animal.y = point.y
  if (cell !== animal.currentCell) {
    if (animal.currentCell.has === animal) {
      animal.currentCell.has = null
      animal.currentCell.solid = false
    }
    animal.currentCell = cell
    animal.i = cell.i
    animal.j = cell.j
    animal.z = cell.z
    cell.place(animal)
    cell.solid = true
    animal.context.map.updateInstanceBucket(animal, oldI, oldJ)
  }
  const oldDegree = animal.degree
  animal.degree = sample.degree
  animal.zIndex = getInstanceZIndex(animal)
  syncEntityRelief(getEntitySpaceMapLike(animal, animal.context.map), animal, cell)
  const sheet = animal.movementSheet ?? SHEET_TYPES.walking
  if (animal.currentSheet !== sheet || degreeToDirection(oldDegree) !== degreeToDirection(animal.degree)) {
    animal.setTextures(sheet)
  }
  if (!animal.sprite.playing) animal.sprite.play()
  updateInstanceVisibility(animal)
}

export function tryStartAnimalContactApproach(
  animal: AnimalControllerHost,
  target: RuntimeEntity,
  action: string | null
): boolean {
  if (action !== ACTION_TYPES.attack) return false
  let scheduledInterval = animal.interval
  return startContactApproach({
    actor: animal,
    isTargetValid: () => sameMapSpace(animal, target) && animal.getActionCondition(target, action),
    isCurrent: () => animal.dest === target && animal.action === action,
    sample: () => sampleContactApproach(animal, target),
    move: sample => moveCloser(animal, target, sample),
    begin: () => {
      animal.setDest(target)
      animal.action = action
      animal.path = []
    },
    arrive: ({ degree }) => {
      animal.degree = degree
      animal.getAction(action)
    },
    schedule: callback => {
      animal.startInterval(callback, STEP_TIME, false, 'animal.contactApproach')
      scheduledInterval = animal.interval
    },
    stop: () => {
      if (animal.interval === scheduledInterval) animal.stopInterval()
    },
    retry: () =>
      animal.sendTo(target, action, { forceRepath: true, movementSheet: animal.movementSheet ?? SHEET_TYPES.walking }),
    tick: () => updateUnitEnergy(animal, STEP_TIME),
  })
}
