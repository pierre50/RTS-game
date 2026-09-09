import { canReachContact } from '../../lib/contact/contactGeometry'
import { tryStartAnimalContactApproach } from './AnimalContactApproach'
import { ACTION_TYPES, SHEET_TYPES, STEP_TIME } from '../../constants'
import {
  getInstanceClosestFreeCellPath,
  getInstanceDegree,
  getInstancePath,
  instanceContactInstance,
  instancesDistance,
} from '../../lib'
import {
  createReservedPassageCellLookup,
  findNearestPassageWaitingCell,
  shouldEntityAvoidPassageStop,
} from '../../lib/buildings/passageCells'
import { getCellSpaceId, getEntitySpaceMapLike, sameCellMapSpace, sameMapSpace } from '../../lib/mapSpaces'
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
    if ('has' in dest && !sameCellMapSpace(animal, dest)) return false
    if (!('has' in dest) && !sameMapSpace(animal, dest)) return false
    if (action === ACTION_TYPES.attack && 'family' in dest) return canReachContact(animal, dest)
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
    { forceRepath = false, allowPassageStop = false, movementSheet }: AnimalMoveOptions = {}
  ): void {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) return
    const runtimeMap = animal.context.map
    const map = getEntitySpaceMapLike(animal, runtimeMap)
    if (!map) {
      animal.stop()
      return
    }
    if (!dest) {
      animal.stopInterval()
      animal.stop()
      return
    }
    if (this.hasCurrentOrder(dest, action, forceRepath)) return
    animal.stopInterval()
    if (this.tryActAtDestination(map, dest, action)) return
    const passageLookup = createReservedPassageCellLookup(animal.context)
    if (this.routeToPassageWaitingCell(dest, action, passageLookup, allowPassageStop, movementSheet)) return
    if ('family' in dest && tryStartAnimalContactApproach(animal, dest, action)) return
    let path: RuntimeCell[] = []
    if (map.grid[dest.i]?.[dest.j]?.solid) {
      path = getInstanceClosestFreeCellPath<RuntimeCell>(animal, dest, map, {
        isCellAllowed: cell => !shouldEntityAvoidPassageStop(animal, cell, { passageLookup }),
      })
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

  private tryActAtDestination(
    map: NonNullable<ReturnType<typeof getEntitySpaceMapLike>>,
    dest: AnimalDestination,
    action: string | null
  ): boolean {
    const animal = this.animal
    const currentCell = map.grid[animal.i]?.[animal.j]
    if (
      currentCell &&
      this.isAnimalAtDest(action, dest) &&
      (!currentCell.solid || currentCell.has?.label === animal.label)
    ) {
      animal.setDest(dest)
      animal.action = action
      animal.degree = getInstanceDegree(animal, dest.x, dest.y)
      animal.getAction(action ?? '')
      return true
    }
    return false
  }

  private routeToPassageWaitingCell(
    dest: AnimalDestination,
    action: string | null,
    passageLookup: ReturnType<typeof createReservedPassageCellLookup>,
    allowPassageStop: boolean,
    movementSheet: string | undefined
  ): boolean {
    const animal = this.animal
    if ('has' in dest && !action && shouldEntityAvoidPassageStop(animal, dest, { allowPassageStop, passageLookup })) {
      const waitingCell = findNearestPassageWaitingCell(animal, dest, { passageLookup })
      if (waitingCell) {
        animal.setDest(waitingCell.cell)
        animal.action = action
        animal.setPath(waitingCell.path, resolveMovementSheet(animal, movementSheet))
        return true
      }
    }
    return false
  }

  private hasCurrentOrder(dest: AnimalDestination, action: string | null, forceRepath: boolean): boolean {
    const animal = this.animal
    return Boolean(
      !forceRepath &&
        dest &&
        animal.dest &&
        sameAnimalDestination(animal.dest, dest) &&
        animal.action === action &&
        (animal.path.length > 0 || this.isAnimalAtDest(action, dest))
    )
  }

  moveToPath(): void {
    moveAnimalToPath(this.animal)
  }
}

function sameAnimalDestination(a: AnimalDestination, b: AnimalDestination): boolean {
  if ('label' in a || 'label' in b) return Boolean('label' in a && 'label' in b && a.label === b.label)
  return a.i === b.i && a.j === b.j && getCellSpaceId(a) === getCellSpaceId(b)
}
