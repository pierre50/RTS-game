import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { AmbientMovementController, findInstancesInSight, getCellsAroundPoint, instancesDistance } from '../../lib'
import {
  canEntityUseCellAsIdleDestination,
  createReservedPassageCellLookup,
  routeEntityAwayFromPassageCell,
} from '../../lib/buildings/passageCells'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { showAlertFeedback } from '../../lib/combat/combatFeedback'
import { updateUnitEnergy } from '../../lib/units/unitEnergy'
import { isAirborne } from './locomotion'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { AnimalControllerHost } from './AnimalTypes'

type AnimalThreat = UnitEntity | BuildingEntity

const BEHAVIOR_CHECK_INTERVAL = 250
const AMBIENT_WALK_DELAY_MIN = 4000
const AMBIENT_WALK_DELAY_MAX = 9000
const AMBIENT_WALK_RANGE = 2

export class AnimalBehavior {
  animal: AnimalControllerHost
  ambientMovement: AmbientMovementController<AnimalControllerHost>

  constructor(animal: AnimalControllerHost) {
    this.animal = animal
    this.ambientMovement = new AmbientMovementController(animal, {
      delayMaxMs: target => target.ambientWalkDelayMax ?? AMBIENT_WALK_DELAY_MAX,
      delayMinMs: target => target.ambientWalkDelayMin ?? AMBIENT_WALK_DELAY_MIN,
      move: (target, destination) => target.sendTo(destination),
      pickDestination: target => this.findAmbientDestination(target),
      taskName: 'animal.behavior',
    })
  }

  get nextAmbientWalkAt(): number {
    return this.ambientMovement.nextMoveAt
  }

  set nextAmbientWalkAt(value: number) {
    this.ambientMovement.nextMoveAt = value
  }

  start(): void {
    const animal = this.animal
    if (
      !animal.ambientMovement ||
      animal.isDead ||
      animal.isDestroyed ||
      animal.context.editor ||
      this.ambientMovement.taskId != null
    ) {
      return
    }
    this.ambientMovement.start(BEHAVIOR_CHECK_INTERVAL, () => this.update())
  }

  stop(): void {
    this.ambientMovement.stop()
  }

  // Runaway animals spook at any human-owned presence: units of any kind
  // (villagers, hero, military) and buildings (a camp encroaching on their territory).
  findNearbyThreat(): AnimalThreat | null {
    const animal = this.animal
    const threats = findInstancesInSight<AnimalControllerHost, AnimalThreat>(
      animal,
      (instance: AnimalThreat) =>
        !instance.isDead &&
        !instance.isDestroyed &&
        (instance.family === FAMILY_TYPES.unit ||
          (animal.strategy === 'runaway' && instance.family === FAMILY_TYPES.building)),
      { useInsightRange: true }
    )
    return threats.reduce(
      (closest: AnimalThreat | null, threat: AnimalThreat) =>
        !closest || instancesDistance(animal, threat) < instancesDistance(animal, closest) ? threat : closest,
      null
    )
  }

  update(): void {
    const animal = this.animal
    if (animal.isDead || animal.isDestroyed) {
      this.stop()
      return
    }
    updateUnitEnergy(animal, BEHAVIOR_CHECK_INTERVAL)

    const threat = this.findNearbyThreat()
    if (threat && !animal.isFleeing && animal.strategy === 'runaway') {
      showAlertFeedback(animal)
      animal.getReaction(threat)
      return
    }

    // Backstop for non-runaway (e.g. attack) strategies: the one-shot vision-reveal
    // trigger (FogOfWar -> Animal.detect) can be missed entirely if the animal is
    // mid ambient-walk at the exact tick vision reaches it. Gated on the action
    // (not path/dest) so it still interrupts an ambient walk, but doesn't re-fire
    // every 250ms while already charging/engaged with a target.
    if (threat && animal.strategy && animal.strategy !== 'runaway' && animal.action !== ACTION_TYPES.attack) {
      animal.getReaction(threat)
      return
    }

    if (
      threat ||
      animal.isFleeing ||
      animal.path.length ||
      animal.dest ||
      // Still in the air (e.g. mid-landing): starting an ambient walk now would
      // kill the landing interval and strand the animal at a partial altitude.
      isAirborne(animal) ||
      !this.ambientMovement.ready
    ) {
      return
    }

    if (routeEntityAwayFromPassageCell(animal)) return
    this.ambientMovement.tryMove()
  }

  findAmbientDestination(animal: AnimalControllerHost): RuntimeCell | null {
    const map = getEntitySpaceMapLike(animal, animal.context.map)
    if (!map) return null
    const passageLookup = createReservedPassageCellLookup(animal.context)
    const cells = getCellsAroundPoint(
      animal.i,
      animal.j,
      map.grid,
      animal.ambientWalkRange ?? AMBIENT_WALK_RANGE,
      cell =>
        canEntityUseCellAsIdleDestination(animal, cell, { passageLookup }) &&
        (cell.i !== animal.i || cell.j !== animal.j)
    )
    return cells.length ? animal.context.map.randomItem(cells) : null
  }
}
