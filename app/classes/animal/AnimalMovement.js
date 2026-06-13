import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
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

export class AnimalMovement {
  constructor(animal) {
    this.animal = animal
  }

  hasPath() {
    return this.animal.path.length > 0
  }

  setDest(dest) {
    const animal = this.animal
    if (!dest) {
      animal.stop()
      return
    }
    animal.dest = dest
    animal.realDest = { i: dest.i, j: dest.j }
  }

  setPath(path, sheet = SHEET_TYPES.walking) {
    const animal = this.animal
    if (!path.length) {
      animal.stop()
      return
    }
    animal.movementSheet = sheet
    animal.setTextures(sheet)
    animal.inactif = false
    animal.path = path
    animal.startInterval(() => animal.step(), STEP_TIME, true)
  }

  isAnimalAtDest(action, dest) {
    const animal = this.animal
    if (!action || !dest) return false
    return instanceContactInstance(animal, dest)
  }

  destHasMoved() {
    const animal = this.animal
    return (
      (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) &&
      instancesDistance(animal, animal.dest) <= animal.sight
    )
  }

  sendTo(dest, action, { forceRepath = false, movementSheet = SHEET_TYPES.walking } = {}) {
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
      animal.dest?.label === dest.label &&
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
      animal.getAction(action)
      return
    }
    let path = []
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(animal, dest, map)
    } else {
      path = getInstancePath(animal, dest.i, dest.j, map)
    }
    if (path.length) {
      animal.setDest(dest)
      animal.action = action
      animal.setPath(path, movementSheet)
    } else {
      animal.stop()
    }
  }

  moveToPath() {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    const next = animal.path[animal.path.length - 1]
    const nextCell = map.grid[next.i][next.j]
    if (!animal.dest || animal.dest.isDestroyed) {
      animal.affectNewDest()
      return
    }
    if (
      nextCell.has &&
      nextCell.has.family === FAMILY_TYPES.animal &&
      nextCell.has.label !== animal.label &&
      nextCell.has.hasPath() &&
      instancesDistance(animal, nextCell.has) <= 1 &&
      nextCell.has.sprite.playing
    ) {
      animal.sprite.stop()
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
        animal.sendTo(animal.dest, animal.action, { forceRepath: true })
        return
      }
      if (this.isAnimalAtDest(animal.action, animal.dest)) {
        animal.path = []
        animal.stopInterval()
        animal.degree = getInstanceDegree(animal, animal.dest.x, animal.dest.y)
        animal.getAction(animal.action)
        return
      }
      if (!animal.path.length) {
        animal.stop()
      }
    } else {
      const oldDeg = animal.degree
      moveTowardPoint(animal, nextCell.x, nextCell.y, animal.speed)
      if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
        animal.setTextures(animal.movementSheet ?? SHEET_TYPES.walking)
      }
    }
  }
}
