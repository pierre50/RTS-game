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

type AnyRecord = Record<string, any>

export class AnimalMovement {
  animal: AnyRecord

  constructor(animal: AnyRecord) {
    this.animal = animal
  }

  hasPath(): boolean {
    return this.animal.path.length > 0
  }

  setDest(dest: AnyRecord): void {
    const animal = this.animal
    if (!dest) {
      animal.stop()
      return
    }
    animal.dest = dest
    animal.realDest = { i: dest.i, j: dest.j }
  }

  setPath(path: AnyRecord[], sheet = SHEET_TYPES.walking): void {
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

  isAnimalAtDest(action: any, dest: AnyRecord): boolean {
    const animal = this.animal
    if (!action || !dest) return false
    return instanceContactInstance(animal as any, dest as any)
  }

  destHasMoved(): boolean {
    const animal = this.animal
    return (
      (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) &&
      instancesDistance(animal as any, animal.dest as any) <= animal.sight
    )
  }

  sendTo(dest: AnyRecord, action: any, { forceRepath = false, movementSheet = SHEET_TYPES.walking }: AnyRecord = {}): void {
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
      animal.degree = getInstanceDegree(animal as any, dest.x, dest.y)
      animal.getAction(action)
      return
    }
    let path: AnyRecord[] = []
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(animal as any, dest as any, map)
    } else {
      path = getInstancePath(animal as any, dest.i, dest.j, map)
    }
    if (path.length) {
      animal.setDest(dest)
      animal.action = action
      animal.setPath(path, movementSheet)
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
    if (!animal.dest || animal.dest.isDestroyed) {
      animal.affectNewDest()
      return
    }
    if (
      nextCell.has &&
      nextCell.has.family === FAMILY_TYPES.animal &&
      nextCell.has.label !== animal.label &&
      nextCell.has.hasPath() &&
      instancesDistance(animal as any, nextCell.has as any) <= 1 &&
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
    animal.zIndex = getInstanceZIndex(animal as any)
    if (instancesDistance(animal as any, nextCell as any, false) < animal.speed) {
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
      updateInstanceVisibility(animal as any)
      animal.path.pop()
      if (this.destHasMoved()) {
        animal.sendTo(animal.dest, animal.action, { forceRepath: true })
        return
      }
      if (this.isAnimalAtDest(animal.action, animal.dest)) {
        animal.path = []
        animal.stopInterval()
        animal.degree = getInstanceDegree(animal as any, animal.dest.x, animal.dest.y)
        animal.getAction(animal.action)
        return
      }
      if (!animal.path.length) {
        animal.stop()
      }
    } else {
      const oldDeg = animal.degree
      moveTowardPoint(animal as any, nextCell.x, nextCell.y, animal.speed)
      if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
        animal.setTextures(animal.movementSheet ?? SHEET_TYPES.walking)
      }
    }
  }
}
