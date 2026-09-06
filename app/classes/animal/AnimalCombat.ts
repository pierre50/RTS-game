import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../../constants'
import {
  applyCombatHit,
  evaluateCombatMorale,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getInstanceDegree,
  findReachableFleeCell,
  instanceContactInstance,
  isometricToCartesian,
  playAudibleSoundCue,
  prepareAutomaticParry,
  SLASH_IMPACT_FRAME,
} from '../../lib'
import { createReservedPassageCellLookup, shouldEntityAvoidPassageStop } from '../../lib/buildings/passageCells'
import { getEntitySpaceGrid } from '../../lib/mapSpaces'
import { runAttackLoopOnFrame } from '../../lib/combat/combatAttackLoop'
import {
  markCombatAttack,
  markCombatFlee,
  shouldSuppressAggroDuringCombatRecovery,
} from '../../lib/combat/combatBehavior'
import {
  showAggressionFeedback,
  showAlertFeedback,
  showAlertThenAggressionFeedback,
} from '../../lib/combat/combatFeedback'
import type { RuntimeEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { RuntimeCell } from '../../types/map'
import { FLYING_ALTITUDE, type AnimalControllerHost } from './AnimalTypes'
import { isAirborne, resolveMovementSheet } from './locomotion'

function getAnimalAttackImpactFrame(animal: AnimalControllerHost): number {
  const configuredFrame = animal.attackImpactFrame
  const fallbackFrame =
    typeof configuredFrame === 'number' && Number.isFinite(configuredFrame) && configuredFrame >= 0
      ? configuredFrame
      : SLASH_IMPACT_FRAME
  const frameCount = animal.sprite?.textures?.length ?? 0
  if (frameCount <= 0) return fallbackFrame
  return Math.min(fallbackFrame, frameCount - 1)
}

export class AnimalCombat {
  animal: AnimalControllerHost

  constructor(animal: AnimalControllerHost) {
    this.animal = animal
  }

  getAttackMovementSheet(): string {
    return this.animal.runningSheet ? SHEET_TYPES.running : SHEET_TYPES.walking
  }

  isRecoveringAttack(): boolean {
    return shouldSuppressAggroDuringCombatRecovery(this.animal)
  }

  getReaction(instance: RuntimeEntity, hitDirection?: Point): void {
    const animal = this.animal
    if (animal.strategy === 'runaway') {
      animal.runaway(instance, hitDirection)
    } else {
      if (!animal.getActionCondition(instance, ACTION_TYPES.attack)) return
      if (this.isRecoveringAttack()) {
        if (evaluateCombatMorale(animal, instance) === 'flee') {
          showAlertFeedback(animal)
          animal.runaway(instance, hitDirection)
        }
        return
      }
      if (evaluateCombatMorale(animal, instance) === 'flee') {
        showAlertFeedback(animal)
        animal.runaway(instance, hitDirection)
        return
      }
      showAggressionFeedback(animal)
      animal.sendTo(instance, ACTION_TYPES.attack, { movementSheet: this.getAttackMovementSheet() })
    }
  }

  detect(instance: RuntimeEntity): void {
    const animal = this.animal
    if (animal.context.editor) return
    if (this.isRecoveringAttack()) return
    if (
      animal.strategy &&
      instance &&
      instance.family === FAMILY_TYPES.unit &&
      !animal.isDead &&
      !animal.path.length &&
      !animal.dest &&
      // Still in the air (e.g. mid-landing): re-triggering a reaction now would
      // kill the landing interval via sendTo's stopInterval() and strand/reset
      // the animal's altitude mid-animation.
      !isAirborne(animal)
    ) {
      if (animal.strategy === 'runaway') {
        showAlertFeedback(animal)
        animal.runaway(instance)
      } else {
        showAlertThenAggressionFeedback(animal, () => {
          if (animal.isDead || animal.isDestroyed || animal.path.length || animal.dest) return
          if (!animal.getActionCondition(instance, ACTION_TYPES.attack)) return
          animal.sendTo(instance, ACTION_TYPES.attack, { movementSheet: this.getAttackMovementSheet() })
        })
      }
    }
  }

  isAttacked(instance: RuntimeEntity, hitDirection?: Point): void {
    const animal = this.animal
    if (animal.context.editor) return
    // Deliberately not gated on animal.dest: an ambient-walk destination shouldn't
    // suppress a reaction to being shot. Already-fleeing is still gated so every
    // arrow along the way doesn't re-route the escape mid-flight.
    if (!instance || animal.isDead || animal.isFleeing) return
    this.getReaction(instance, hitDirection)
  }

  affectNewDest(): void {
    const animal = this.animal
    if (this.isRecoveringAttack()) return
    animal.stopInterval()
    if (animal.strategy !== 'attack') {
      animal.stop()
      return
    }
    const targets = findInstancesInSight<AnimalControllerHost, RuntimeEntity>(
      animal,
      (instance: RuntimeEntity) => animal.getActionCondition(instance),
      { useInsightRange: true }
    )
    if (targets.length) {
      const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(animal, targets)
      if (target) {
        animal.setDest(target.instance)
        if (instanceContactInstance(animal, target.instance)) {
          animal.degree = getInstanceDegree(animal, target.instance.x, target.instance.y)
          animal.getAction(animal.action ?? '')
          return
        }
        animal.setPath(
          target.path,
          resolveMovementSheet(animal, animal.runningSheet ? SHEET_TYPES.running : SHEET_TYPES.walking)
        )
        return
      }
    }
    animal.stop()
  }

  // Converts the projectile's world-space travel vector into a grid-space direction and casts
  // it outward from the animal, taking the farthest open cell within sight — so a hit animal
  // bolts continuing the shot's line (away from the shooter) rather than away from wherever the
  // shooter happens to be standing at the moment of impact (see UnitMovement.runaway for the
  // instance-position equivalent of this raycast).
  getFleeCellAlongDirection(hitDirection?: Point): RuntimeCell | null {
    const animal = this.animal
    const grid = getEntitySpaceGrid(animal, animal.context?.map)
    if (!hitDirection) return null
    if (!grid) return null
    const passageLookup = createReservedPassageCellLookup(animal.context)
    const worldLen = Math.hypot(hitDirection.x, hitDirection.y)
    if (!worldLen) return null
    // Scale to a large magnitude before converting so isometricToCartesian's internal
    // rounding doesn't collapse a short-range shot's vector down to (0, 0).
    const scale = 1000 / worldLen
    const [di, dj] = isometricToCartesian(hitDirection.x * scale, hitDirection.y * scale)
    const gridLen = Math.hypot(di, dj)
    if (!gridLen) return null
    for (let dist = animal.sight ?? 0; dist >= 1; dist--) {
      const ti = Math.round(animal.i + (di / gridLen) * dist)
      const tj = Math.round(animal.j + (dj / gridLen) * dist)
      const cell = grid[ti]?.[tj]
      if (cell && !cell.solid && !shouldEntityAvoidPassageStop(animal, cell, { passageLookup })) return cell
    }
    return null
  }

  getBestFleeCell(instance: RuntimeEntity, preferredCell: RuntimeCell | null): RuntimeCell | null {
    const animal = this.animal
    return findReachableFleeCell<RuntimeCell>(animal, instance, animal.context.map, {
      isCellAllowed: cell => !cell.solid && cell.category !== 'Water' && !shouldEntityAvoidPassageStop(animal, cell),
      preferredCell,
      range: animal.sight ?? 0,
    })
  }

  runaway(instance: RuntimeEntity, hitDirection?: Point): void {
    const animal = this.animal
    const dest = this.getBestFleeCell(instance, this.getFleeCellAlongDirection(hitDirection))
    if (dest) {
      markCombatFlee(animal)
      animal.isFleeing = true
      const flying = Boolean(animal.flyingSheet)
      animal.sendTo(dest, null, {
        movementSheet: flying ? SHEET_TYPES.flying : animal.runningSheet ? SHEET_TYPES.running : SHEET_TYPES.walking,
      })
      // sendTo can synchronously abort the flee (no path to dest, or a
      // single-cell path consumed within this same tick) and call
      // animal.stop(), which resets isFleeing to false. Only lift off if
      // the flee is still actually in progress — otherwise the animal
      // pops into the air and then has to land again immediately.
      if (flying && animal.isFleeing) animal.setAltitude(animal.flyingAltitude ?? FLYING_ALTITUDE)
    } else {
      animal.stop()
    }
  }

  getAction(name: string): void {
    const animal = this.animal
    const {
      context: { menu, player },
    } = animal
    switch (name) {
      case ACTION_TYPES.attack: {
        markCombatAttack(animal)
        if (!animal.getActionCondition(animal.dest)) {
          animal.affectNewDest()
          return
        }
        runAttackLoopOnFrame(animal, {
          releaseFrame: getAnimalAttackImpactFrame(animal),
          prepareAttackSheet: () => {
            animal.setTextures(SHEET_TYPES.action)
            animal.sprite.gotoAndPlay(0)
            animal.syncShadow()
          },
          prepareRecoverySheet: () => {
            animal.setTextures(SHEET_TYPES.standing)
          },
          onAttackPrepared: target => prepareAutomaticParry?.(target),
          syncMovingTargetDirection: () => {
            const target = animal.dest && 'hitPoints' in animal.dest ? animal.dest : null
            if (!target || !animal.destHasMoved()) return
            animal.degree = getInstanceDegree(animal, target.x, target.y)
            animal.setTextures(SHEET_TYPES.action)
          },
          onOutOfRange: target => {
            if (!target) return
            animal.sendTo(target, ACTION_TYPES.attack, {
              forceRepath: true,
              movementSheet: this.getAttackMovementSheet(),
            })
          },
          onTargetUnavailable: target => {
            if (target && (target.hitPoints ?? 0) <= 0) {
              target.die?.()
            }
            animal.affectNewDest()
          },
          onReadyToAttack: target => {
            animal.sounds &&
              animal.sounds.hit &&
              animal.context.controls.instanceIsAudible(animal) &&
              playAudibleSoundCue(animal, animal.sounds.hit, { profile: 'combat' })
            const { killed } = applyCombatHit(animal, target, { isMelee: true, menu, player })
            if (killed) {
              animal.affectNewDest()
              return false
            }
          },
        })
        break
      }
      default:
        animal.stop()
    }
  }
}
