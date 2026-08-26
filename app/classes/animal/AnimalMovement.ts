import { SHEET_TYPES, STEP_TIME } from '../../constants'
import {
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  instanceContactInstance,
  instancesDistance
} from '../../lib'
import type { RuntimeCell } from '../../types/map'
import type { AnimalControllerHost, AnimalDestination, AnimalMoveOptions } from './AnimalTypes'
import { moveAnimalToPath } from './AnimalMovementStep'
import { resolveMovementSheet } from './locomotion'

export class AnimalMovement {
  animal: AnimalControllerHost

  constructor(animal: AnimalControllerHost) {
    this.animal = animal
  }

  hasPath(): boolean {
    return this.animal.path.length > 0
  }

  setDest(dest: AnimalDestination | null): void {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) return
    if (!dest) {
      animal.stop()
      return
    }
    animal.dest = dest
    animal.realDest = { i: dest.i, j: dest.j }
  }

  setPath(path: RuntimeCell[], sheet = SHEET_TYPES.walking): void {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) return
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
    if (animal.isDead || animal.isDestroyed) return
    const {
      context: { map },
    } = animal
    if (!dest) {
      animal.stopInterval()
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
      // Already heading to (or engaged with) this same dest/action: leave the
      // in-flight step/attack interval untouched. Stopping it here (as used to
      // happen unconditionally at the top of this method) would kill the
      // animal's movement while leaving its path and current animation sheet
      // in place, freezing it mid-run-animation on every redundant sendTo call
      // (e.g. every hit landed while it's already charging the same attacker).
      return
    }
    animal.stopInterval()
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
    moveAnimalToPath(this.animal)
  }
}
