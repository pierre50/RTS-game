import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { HERO_STEALTH_ANIMAL_DETECTION_FACTOR } from '../../constants/heroControls'
import { AmbientMovementController, findInstancesInSight, getCellsAroundPoint, instancesDistance } from '../../lib'
import { showAlertFeedback } from '../../lib/combatFeedback'
import { updateUnitEnergy } from '../../lib/unitEnergy'
import { isAirborne } from './locomotion'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import type { Animal } from './index'

type AnimalThreat = UnitEntity | BuildingEntity

const BEHAVIOR_CHECK_INTERVAL = 250
const AMBIENT_WALK_DELAY_MIN = 4000
const AMBIENT_WALK_DELAY_MAX = 9000
const AMBIENT_WALK_RANGE = 2

export class AnimalBehavior {
  animal: Animal
  ambientMovement: AmbientMovementController<Animal>

  constructor(animal: Animal) {
    this.animal = animal
    this.ambientMovement = new AmbientMovementController(animal, {
      delayMaxMs: target => target.ambientWalkDelayMax ?? AMBIENT_WALK_DELAY_MAX,
      delayMinMs: target => target.ambientWalkDelayMin ?? AMBIENT_WALK_DELAY_MIN,
      move: (target, destination) => target.sendTo(destination),
      pickDestination: target => this.findAmbientDestination(target),
      taskName: 'animal.behavior',
    })
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
    const controls = animal.context.controls
    const controlsHeroUnit = controls?.heroUnit
    const isStealthMode = Boolean(controlsHeroUnit && controls?.isHeroStealthMode?.())
    const stealthRangeSq =
      isStealthMode && animal.sight ? (animal.sight * HERO_STEALTH_ANIMAL_DETECTION_FACTOR) ** 2 : Number.POSITIVE_INFINITY
    const threats = findInstancesInSight<Animal, AnimalThreat>(
      animal,
      (instance: AnimalThreat) =>
        !instance.isDead &&
        !instance.isDestroyed &&
        (instance.family === FAMILY_TYPES.unit || instance.family === FAMILY_TYPES.building) &&
        (isStealthMode && instance === controlsHeroUnit
          ? (instance.i - animal.i) ** 2 + (instance.j - animal.j) ** 2 <= stealthRangeSq
          : true)
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

    this.ambientMovement.tryMove()
  }

  findAmbientDestination(animal: Animal): RuntimeCell | null {
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
    return cells.length ? map.randomItem(cells) : null
  }
}
