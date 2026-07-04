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
import type { LooseRecord, UnknownRecord } from '../../types/common'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { Animal } from './index'

export class AnimalMovement {
  animal: Animal & LooseRecord

  constructor(animal: Animal & LooseRecord) {
    this.animal = animal
  }

  hasPath(): boolean {
    return this.animal.path.length > 0
  }

  setDest(dest: LooseRecord | null): void {
    const animal = this.animal
    if (!dest) {
      animal.stop()
      return
    }
    animal.dest = dest
    animal.realDest = { i: dest.i, j: dest.j }
  }

  setPath(path: LooseRecord[], sheet = SHEET_TYPES.walking): void {
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

  isAnimalAtDest(action: string | null, dest: LooseRecord | null): boolean {
    const animal = this.animal
    if (!action || !dest) return false
    return instanceContactInstance(
      animal as unknown as Parameters<typeof instanceContactInstance>[0],
      dest as unknown as Parameters<typeof instanceContactInstance>[1]
    )
  }

  destHasMoved(): boolean {
    const animal = this.animal
    if (!animal.dest || !animal.realDest) return false
    return (
      (animal.dest.i !== animal.realDest.i || animal.dest.j !== animal.realDest.j) &&
      instancesDistance(
        animal as unknown as Parameters<typeof instancesDistance>[0],
        animal.dest as unknown as Parameters<typeof instancesDistance>[1]
      ) <= animal.sight
    )
  }

  sendTo(
    dest: LooseRecord | null,
    action: string | null,
    { forceRepath = false, movementSheet = SHEET_TYPES.walking }: UnknownRecord = {}
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
      animal.degree = getInstanceDegree(animal as unknown as Parameters<typeof getInstanceDegree>[0], dest.x, dest.y)
      animal.getAction(action ?? '')
      return
    }
    let path: LooseRecord[] = []
    if (map.grid[dest.i] && map.grid[dest.i][dest.j] && map.grid[dest.i][dest.j].solid) {
      path = getInstanceClosestFreeCellPath(
        animal as unknown as Parameters<typeof getInstanceClosestFreeCellPath>[0],
        dest as unknown as Parameters<typeof getInstanceClosestFreeCellPath>[1],
        map
      ) as LooseRecord[]
    } else {
      path = getInstancePath(animal as unknown as Parameters<typeof getInstancePath>[0], dest.i, dest.j, map) as LooseRecord[]
    }
    if (path.length) {
      animal.setDest(dest)
      animal.action = action
      animal.setPath(path, movementSheet as string)
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
      (nextCell.has as LooseRecord).hasPath() &&
      instancesDistance(
        animal as unknown as Parameters<typeof instancesDistance>[0],
        nextCell.has as unknown as Parameters<typeof instancesDistance>[1]
      ) <= 1 &&
      (nextCell.has.sprite as LooseRecord)?.playing
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
    animal.zIndex = getInstanceZIndex(animal as unknown as Parameters<typeof getInstanceZIndex>[0])
    if (
      instancesDistance(
        animal as unknown as Parameters<typeof instancesDistance>[0],
        nextCell as unknown as Parameters<typeof instancesDistance>[1],
        false
      ) < animal.speed
    ) {
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
      updateInstanceVisibility(animal as unknown as Parameters<typeof updateInstanceVisibility>[0])
      animal.path.pop()
      if (this.destHasMoved()) {
        animal.sendTo(animal.dest, animal.action ?? null, { forceRepath: true })
        return
      }
      if (this.isAnimalAtDest(animal.action ?? null, animal.dest)) {
        animal.path = []
        animal.stopInterval()
        animal.degree = getInstanceDegree(animal as unknown as Parameters<typeof getInstanceDegree>[0], animal.dest.x, animal.dest.y)
        animal.getAction(animal.action ?? '')
        return
      }
      if (!animal.path.length) {
        animal.stop()
      }
    } else {
      const oldDeg = animal.degree
      moveTowardPoint(animal as unknown as Parameters<typeof moveTowardPoint>[0], nextCell.x, nextCell.y, animal.speed)
      if (degreeToDirection(oldDeg) !== degreeToDirection(animal.degree)) {
        animal.setTextures(animal.movementSheet ?? SHEET_TYPES.walking)
      }
    }
  }
}
