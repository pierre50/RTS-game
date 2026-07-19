import { FAMILY_TYPES, RELIEF_CLIMB_SPEED_MULTIPLIER, SHEET_TYPES, STEP_TIME } from '../../constants'
import {
  degreeToDirection,
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  getInstanceZIndex,
  instanceContactInstance,
  instancesDistance,
  moveTowardPoint,
  updateInstanceVisibility,
} from '../../lib'
import type { RuntimeCell } from '../../types/map'
import { isAirborne, resolveMovementSheet } from './locomotion'
import type { Animal, AnimalDestination, AnimalMoveOptions } from './index'

export class AnimalMovement {
  animal: Animal

  constructor(animal: Animal) {
    this.animal = animal
  }

  hasPath(): boolean {
    return this.animal.path.length > 0
  }

  setDest(dest: AnimalDestination | null): void {
    const animal = this.animal
    if (!dest) {
      animal.stop()
      return
    }
    animal.dest = dest
    animal.realDest = { i: dest.i, j: dest.j }
  }

  setPath(path: RuntimeCell[], sheet = SHEET_TYPES.walking): void {
    const animal = this.animal
    if (!path.length) {
      animal.stop()
      return
    }
    animal.movementSheet = sheet
    animal.setTextures(sheet)
    animal.inactif = false
    animal.path = path
    animal.startInterval(() => animal.step(), STEP_TIME, true, 'animal.step')
  }

  isAnimalAtDest(action: string | null, dest: AnimalDestination | null): boolean {
    const animal = this.animal
    if (!action || !dest) return false
    return instanceContactInstance(animal, dest)
  }

  destHasMoved(): boolean {
    const animal = this.animal
    if (!animal.dest || !animal.realDest) return false
    return (
      (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) &&
      instancesDistance(animal, animal.dest) <= animal.sight
    )
  }

  sendTo(
    dest: AnimalDestination | null,
    action: string | null,
    { forceRepath = false, movementSheet }: AnimalMoveOptions = {}
  ): void {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    animal.stopInterval()
    if (!dest) {
      animal.stop()
      return
    }
    if (
      !forceRepath &&
      dest &&
      animal.dest &&
      'label' in animal.dest &&
      'label' in dest &&
      animal.dest.label === dest.label &&
      animal.action === action &&
      (animal.path.length > 0 || this.isAnimalAtDest(action, dest))
    ) {
      return
    }
    if (
      this.isAnimalAtDest(action, dest) &&
      (!map.grid[animal.i][animal.j].solid ||
        (map.grid[animal.i][animal.j].solid && map.grid[animal.i][animal.j].has?.label === animal.label))
    ) {
      animal.setDest(dest)
      animal.action = action
      animal.degree = getInstanceDegree(animal, dest.x, dest.y)
      animal.getAction(action ?? '')
      return
    }
    let path: RuntimeCell[] = []
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath<RuntimeCell>(animal, dest, map)
    } else {
      path = getInstancePath<RuntimeCell>(animal, dest.i, dest.j, map)
    }
    if (path.length) {
      animal.setDest(dest)
      animal.action = action
      animal.setPath(path, resolveMovementSheet(animal, movementSheet))
    } else {
      animal.stop()
    }
  }

  moveToPath(): void {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    const next = animal.path[animal.path.length - 1]
    const nextCell = map.grid[next.i][next.j]
    if (animal.currentCell) {
      const totalDistance = instancesDistance(animal.currentCell, nextCell, false) || 1
      const remaining = instancesDistance(animal, nextCell, false)
      const progress = 1 - remaining / totalDistance
      animal.applyReliefLift(nextCell.z ?? 0, animal.currentCell.z ?? 0, progress)
    }
    if (!animal.dest || ('isDestroyed' in animal.dest && animal.dest.isDestroyed)) {
      animal.affectNewDest()
      return
    }
    if (
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
    ) {
      // An airborne animal hovers in place while it waits: freezing the
      // animation mid-air reads as a glitch, unlike a ground animal standing still.
      if (isAirborne(animal)) {
        if (!animal.sprite.playing) animal.sprite.play()
      } else {
        animal.sprite.stop()
      }
      return
    }
    if (nextCell.solid && animal.dest) {
      animal.sendTo(animal.dest, animal.action, { forceRepath: true })
      return
    }
    if (!animal.sprite.playing) {
      animal.sprite.play()
    }
    animal.zIndex = getInstanceZIndex(animal)
    if (instancesDistance(animal, nextCell, false) < animal.speed) {
      const oldI = animal.i,
        oldJ = animal.j
      animal.z = nextCell.z
      animal.i = nextCell.i
      animal.j = nextCell.j
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
      if (this.destHasMoved()) {
        animal.sendTo(animal.dest, animal.action ?? null, { forceRepath: true })
        return
      }
      if (this.isAnimalAtDest(animal.action ?? null, animal.dest)) {
        animal.path = []
        animal.stopInterval()
        animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y)
        animal.getAction(animal.action ?? '')
        return
      }
      if (!animal.path.length) {
        animal.stop()
      }
    } else {
      const oldDeg = animal.degree
      let speed = animal.speed
      if ((nextCell.z ?? 0) > (animal.currentCell?.z ?? 0)) speed *= RELIEF_CLIMB_SPEED_MULTIPLIER
      moveTowardPoint(animal, nextCell.x, nextCell.y, speed)
      if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
        animal.setTextures(animal.movementSheet ?? SHEET_TYPES.walking)
      }
    }
  }
}
