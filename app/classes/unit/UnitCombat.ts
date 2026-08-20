import { ACTION_TYPES, CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  applyCombatHit,
  degreeToDirection,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getInstanceDegree,
  instanceContactInstance,
  playAudibleSoundCue,
  BOW_SHOOT_RELEASE_FRAME,
  SLASH_IMPACT_FRAME,
} from '../../lib'
import { Projectile } from '../Projectile'
import { getCombatXpBonus, XP_CATEGORIES } from '../../lib/unitExperience'
import { showAlertThenAggressionFeedback } from '../../lib/combatFeedback'
import { canAutoAcquireTarget } from '../../lib/unitControl'
import { getUnitCombatRange } from '../../lib/equipmentStats'
import { runAttackLoopOnFrame } from '../../lib/combatAttackLoop'
import { markCombatAttack, shouldSuppressAggroDuringCombatRecovery } from '../../lib/combatBehavior'
import { getUnitWorkActionSheet } from '../../lib/unitWorkAppearance'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

export class UnitCombat {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  // Loops the current action sheet indefinitely (like the Hero's own swings, which just play at
  // their fixed baked speed) and fires once per pass at releaseFrame — attack cadence is however
  // fast that animation naturally runs, not a separate rateOfFire-driven timer. Shared by melee
  // and ranged; onFire receives the current target so each caller only supplies its own effect
  // (apply a hit, launch a projectile).
  runAttackLoop(releaseFrame: number, onFire: (dest: RuntimeEntity | null) => void) {
    const unit = this.unit
    runAttackLoopOnFrame(unit, {
      releaseFrame,
      prepareAttackSheet: () => {
        unit.setTextures?.(SHEET_TYPES.action)
        unit.syncMountedHorseSprite?.()
      },
      onOutOfRange: dest => {
        unit.sendToEvt?.(dest, ACTION_TYPES.attack, { forceRepath: true })
      },
      onTargetUnavailable: (dest, phase) => {
        if (dest && (dest.hitPoints ?? 0) <= 0) {
          dest.die?.()
        }
        if (phase === 'preflight') {
          unit.affectNewDest?.()
          return
        }
        this.finishAttackAfterCurrentLoop()
      },
      onReadyToAttack: target => onFire(target),
    })
  }

  finishAttackAfterCurrentLoop() {
    const unit = this.unit
    const sprite = unit.sprite
    if (!sprite) {
      unit.affectNewDest?.()
      return
    }

    unit.actionLocked = true
    sprite.onFrameChange = undefined
    sprite.onLoop = () => {
      sprite.onLoop = undefined
      unit.actionLocked = false
      const hadPendingOrder = unit.flushPendingOrder?.()
      if (!hadPendingOrder) unit.affectNewDest?.()
    }
  }

  detect(instance: RuntimeEntity | null) {
    const unit = this.unit
    if (unit.context?.editor) return
    if (!canAutoAcquireTarget(unit)) return
    if (shouldSuppressAggroDuringCombatRecovery(unit)) return
    if (
      unit.work === WORK_TYPES.attacker &&
      instance &&
      instance.family === FAMILY_TYPES.unit &&
      !unit.path?.length &&
      !unit.dest &&
      unit.getActionCondition?.(instance, ACTION_TYPES.attack)
    ) {
      showAlertThenAggressionFeedback(unit, () => {
        if (unit.context?.editor || !canAutoAcquireTarget(unit)) return
        if (unit.path?.length || unit.dest || !unit.getActionCondition?.(instance, ACTION_TYPES.attack)) return
        unit.sendTo?.(instance, ACTION_TYPES.attack)
      })
    }
  }

  handleAffectNewDestHunter(): boolean {
    const unit = this.unit
    const unitAsInstance = unit
    const firstTargets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
      Boolean(unit.getActionCondition?.(instance, ACTION_TYPES.takemeat))
    )
    if (firstTargets.length) {
      const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, firstTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.takemeat) {
          unit.action = ACTION_TYPES.takemeat
          unit.actionSheet = getUnitWorkActionSheet(unit, unit.work, unit.action)
        }
        unit.setDest?.(target.instance)
        if (instanceContactInstance(unitAsInstance, target.instance)) {
          unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
          unit.getAction?.(unit.action)
          return true
        }
        unit.setPath?.(target.path)
        return true
      }
    }
    const secondTargets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
      Boolean(unit.getActionCondition?.(instance, ACTION_TYPES.hunt))
    )
    if (secondTargets.length) {
      const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, secondTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.hunt) {
          unit.action = ACTION_TYPES.hunt
          unit.actionSheet = getUnitWorkActionSheet(unit, unit.work, unit.action)
        }
        unit.setDest?.(target.instance)
        if (instanceContactInstance(unitAsInstance, target.instance)) {
          unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
          unit.getAction?.(unit.action)
          return true
        }
        unit.setPath?.(target.path)
        return true
      }
    }
    return false
  }

  syncMovingTargetDirection() {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (unit.destHasMoved?.() && dest && unit.realDest) {
      unit.realDest.i = dest.i
      unit.realDest.j = dest.j
      unit.realDest.x = dest.x
      unit.realDest.y = dest.y
      const oldDeg = unit.degree
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      if (degreeToDirection(oldDeg ?? 0) !== degreeToDirection(unit.degree ?? 0)) {
        unit.setTextures?.(SHEET_TYPES.action)
      }
    }
  }

  handleAttackAction() {
    const unit = this.unit
    const map = unit.context?.map
    const menu = unit.context?.menu
    const player = unit.owner
    const rangedAttackRange = getUnitCombatRange(unit)
    markCombatAttack(unit)

    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    if (rangedAttackRange && unit.projectile && unit.type !== UNIT_TYPES.villager) {
      this.runAttackLoop(BOW_SHOOT_RELEASE_FRAME, dest => {
        if (!dest || !unit.realDest || !map) return
        playAudibleSoundCue(unit, unit.sounds?.attack)
        const projectile = new Projectile(
          {
            owner: unit,
            target: dest,
            type: unit.projectile || '',
            destination: unit.realDest,
            maxDistance: rangedAttackRange * PROJECTILE_CELL_DISTANCE,
          },
          unit.context!
        )
        map.addChild(projectile)
      })
    } else {
      this.runAttackLoop(SLASH_IMPACT_FRAME, dest => {
        if (unit.sounds?.hit) {
          playAudibleSoundCue(unit, unit.sounds.hit)
        }
        if (dest && (dest.hitPoints ?? 0) > 0) {
          const { killed } = applyCombatHit(unit, dest, {
            bonusDamage: getCombatXpBonus(unit, XP_CATEGORIES.melee),
            isMelee: true,
            menu,
            player,
            xpCategory: XP_CATEGORIES.melee,
            xpUnit: unit,
          })
          if (killed) this.finishAttackAfterCurrentLoop()
        }
      })
    }
  }
}
