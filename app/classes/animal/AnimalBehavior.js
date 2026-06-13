import { FAMILY_TYPES, UNIT_TYPES } from '../../constants'
import { findInstancesInSight, getCellsAroundPoint, instancesDistance } from '../../lib'

const BEHAVIOR_CHECK_INTERVAL = 250
const AMBIENT_WALK_DELAY_MIN = 4000
const AMBIENT_WALK_DELAY_MAX = 9000
const AMBIENT_WALK_RANGE = 2

export class AnimalBehavior {
  constructor(animal) {
    this.animal = animal
    this.taskId = null
    this.nextAmbientWalkAt = 0
  }

  start() {
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
    this.taskId = animal.context.scheduler.add(() => this.update(), BEHAVIOR_CHECK_INTERVAL)
  }

  stop() {
    if (this.taskId == null) return
    this.animal.context.scheduler.remove(this.taskId)
    this.taskId = null
  }

  scheduleAmbientWalk() {
    const {
      context: { map, scheduler },
    } = this.animal
    this.nextAmbientWalkAt = scheduler.elapsedMs + map.randomRange(AMBIENT_WALK_DELAY_MIN, AMBIENT_WALK_DELAY_MAX)
  }

  findNearbyVillager() {
    const animal = this.animal
    const villagers = findInstancesInSight(
      animal,
      instance =>
        instance.family === FAMILY_TYPES.unit &&
        instance.type === UNIT_TYPES.villager &&
        !instance.isDead &&
        !instance.isDestroyed
    )
    return villagers.reduce(
      (closest, villager) =>
        !closest || instancesDistance(animal, villager) < instancesDistance(animal, closest) ? villager : closest,
      null
    )
  }

  update() {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) {
      this.stop()
      return
    }

    const villager = this.findNearbyVillager()
    if (villager && !animal.isFleeing) {
      animal.runaway(villager)
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

  walkNearby() {
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
