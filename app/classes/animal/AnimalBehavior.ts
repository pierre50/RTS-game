import { FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import { findInstancesInSight, getCellsAroundPoint, instancesDistance } from '../../lib'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { Animal } from './index'

const BEHAVIOR_CHECK_INTERVAL = 250
const AMBIENT_WALK_DELAY_MIN = 4000
const AMBIENT_WALK_DELAY_MAX = 9000
const AMBIENT_WALK_RANGE = 2

export class AnimalBehavior {
  animal: Animal
  taskId: unknown
  nextAmbientWalkAt: number

  constructor(animal: Animal) {
    this.animal = animal
    this.taskId = null
    this.nextAmbientWalkAt = 0
  }

  start(): void {
    const animal = this.animal
    if (
      !animal.ambientMovement ||
      animal.isDead ||
      animal.isDestroyed ||
      animal.context.editor ||
      this.taskId != null
    ) {
      return
    }
    this.scheduleAmbientWalk()
    this.taskId = animal.context.scheduler.add(() => this.update(), BEHAVIOR_CHECK_INTERVAL, 'animal.behavior')
  }

  stop(): void {
    if (this.taskId == null) return
    this.animal.context.scheduler.remove(this.taskId)
    this.taskId = null
  }

  scheduleAmbientWalk(): void {
    const {
      context: { map, scheduler },
    } = this.animal
    this.nextAmbientWalkAt = scheduler.elapsedMs + map.randomRange(AMBIENT_WALK_DELAY_MIN, AMBIENT_WALK_DELAY_MAX)
  }

  findNearbyVillager(): UnitEntity | null {
    const animal = this.animal
    const villagers = findInstancesInSight<Animal, UnitEntity>(
      animal,
      (instance: UnitEntity) =>
        instance.family === FAMILY_TYPES.unit &&
        instance.type === UNIT_TYPES.villager &&
        !instance.isDead &&
        !instance.isDestroyed
    )
    return villagers.reduce(
      (closest: UnitEntity | null, villager: UnitEntity) =>
        !closest || instancesDistance(animal, villager) < instancesDistance(animal, closest) ? villager : closest,
      null
    )
  }

  update(): void {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) {
      this.stop()
      return
    }

    const villager = this.findNearbyVillager()
    if (villager && !animal.isFleeing) {
      animal.runaway(villager as RuntimeEntity)
      return
    }

    if (
      villager ||
      animal.isFleeing ||
      animal.path.length ||
      animal.dest ||
      animal.context.scheduler.elapsedMs < this.nextAmbientWalkAt
    ) {
      return
    }

    this.walkNearby()
    this.scheduleAmbientWalk()
  }

  walkNearby(): void {
    const animal = this.animal
    const {
      context: { map },
    } = animal
    const cells = getCellsAroundPoint(
      animal.i,
      animal.j,
      map.grid,
      animal.ambientWalkRange ?? AMBIENT_WALK_RANGE,
      cell => !cell.solid && (cell.i !== animal.i || cell.j !== animal.j)
    )
    const destination = map.randomItem(cells)
    if (destination) animal.sendTo(destination)
  }
}
