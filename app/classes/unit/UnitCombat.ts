import {
  ACTION_TYPES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../../constants'
import {
  applyCombatHit,
  evaluateCombatMorale,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getInstanceDegree,
  instanceContactInstance,
  playAudibleSoundCue,
  BOW_SHOOT_RELEASE_FRAME,
  SLASH_IMPACT_FRAME,
  syncMovedActionTarget,
} from '../../lib'
import { Projectile } from '../Projectile'
import { getCombatXpBonus, XP_CATEGORIES } from '../../lib/units/unitExperience'
import { showAlertThenAggressionFeedback } from '../../lib/combat/combatFeedback'
import { canAutoAcquireTarget } from '../../lib/units/unitControl'
import { getUnitCombatRange, getUnitWorkEquipment } from '../../lib/equipment/equipmentStats'
import { runAttackLoopOnFrame } from '../../lib/combat/combatAttackLoop'
import { playReverseSlashRecovery } from '../../lib/entities/slashRecoveryAnimation'
import { markCombatAttack, shouldSuppressAggroDuringCombatRecovery } from '../../lib/combat/combatBehavior'
import { attachProjectileToMapSpace } from '../../lib/projectiles'
import { applyUnitActionFrameSequence, getUnitWorkActionSheet } from '../../lib/units/unitWorkAppearance'
import { setUnitVisualSheet } from '../../lib/units/unitVisualTransition'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isSlashingMeleeEquipment(item: string): boolean {
  return item === 'longsword' || item.startsWith('sword_') || item === 'axe' || item.startsWith('axe_')
}

function getMeleeImpactEquipment(unit: UnitEntity): string[] {
  if (Array.isArray(unit.equipment) && unit.equipment.length) return unit.equipment
  return unit.work && typeof getUnitWorkEquipment === 'function' ? getUnitWorkEquipment(unit.work, unit.owner?.age) : []
}

function getMeleeImpactSound(unit: UnitEntity, target: RuntimeEntity | null): CommandSound {
  if (target?.family === FAMILY_TYPES.unit && getMeleeImpactEquipment(unit).some(isSlashingMeleeEquipment)) {
    return SOUND_CUES?.unit?.swordAttack ?? unit.sounds?.hit
  }
  return unit.sounds?.hit
}

type AttackLoopVisualOptions = {
  playRecoveryAnimation?: (releaseFrame: number, onComplete: () => void) => boolean | void
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
  runAttackLoop(
    releaseFrame: number,
    onFire: (dest: RuntimeEntity | null) => boolean | void,
    visualOptions: AttackLoopVisualOptions = {}
  ) {
    const unit = this.unit
    runAttackLoopOnFrame(unit, {
      releaseFrame,
      prepareAttackSheet: () => {
        setUnitVisualSheet(unit, SHEET_TYPES.action, {
          clearCallbacks: ['onComplete', 'onFrameChange'],
          frame: 0,
          play: 'play',
          syncMountedHorse: true,
          syncShadow: false,
        })
      },
      prepareRecoverySheet: () => {
        setUnitVisualSheet(unit, SHEET_TYPES.standing, {
          clearCallbacks: false,
          invalidateAnimation: false,
          syncShadow: false,
        })
      },
      playRecoveryAnimation: visualOptions.playRecoveryAnimation,
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

  playReverseSlashRecovery(releaseFrame: number, onComplete: () => void): boolean {
    return playReverseSlashRecovery(this.unit, { onComplete, releaseFrame })
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
    if (!instance || instance.family !== FAMILY_TYPES.unit) return
    if (!unit.getActionCondition?.(instance, ACTION_TYPES.attack)) return

    const isVillager = unit.type === UNIT_TYPES.villager
    const isIdleCombatUnit = !isVillager && !unit.path?.length && !unit.dest
    const canInterruptCivilianTask = isVillager && unit.action !== ACTION_TYPES.attack

    if (isVillager && evaluateCombatMorale(unit, instance) === 'flee') {
      ;(unit as UnitEntity & { runaway?: (target: RuntimeEntity) => void }).runaway?.(instance)
      return
    }

    if (isIdleCombatUnit || canInterruptCivilianTask) {
      showAlertThenAggressionFeedback(unit, () => {
        if (unit.context?.editor || !canAutoAcquireTarget(unit)) return
        if (!unit.getActionCondition?.(instance, ACTION_TYPES.attack)) return
        if (unit.sendToAttack) {
          unit.sendToAttack(instance, { keepPrevious: isVillager })
          return
        }
        if (unit.path?.length || unit.dest) return
        unit.sendTo?.(instance, ACTION_TYPES.attack)
      })
    }
  }

  tryHunterTarget(action: string): boolean {
    const unit = this.unit
    const unitAsInstance = unit
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(unitAsInstance, instance =>
      Boolean(unit.getActionCondition?.(instance, action))
    )
    if (!targets.length) return false
    const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
    if (!target) return false
    if (unit.action !== action) {
      unit.action = action
      applyUnitActionFrameSequence(unit, unit.work, unit.action)
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

  handleAffectNewDestHunter(): boolean {
    return this.tryHunterTarget(ACTION_TYPES.takemeat) || this.tryHunterTarget(ACTION_TYPES.hunt)
  }

  syncMovingTargetDirection() {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    syncMovedActionTarget(unit, dest)
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
        playAudibleSoundCue(unit, unit.sounds?.attack, { profile: 'combat' })
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
        attachProjectileToMapSpace(projectile, map)
      })
    } else {
      this.runAttackLoop(
        SLASH_IMPACT_FRAME,
        dest => {
          playAudibleSoundCue(unit, getMeleeImpactSound(unit, dest), { profile: 'combat' })
          if (dest && (dest.hitPoints ?? 0) > 0) {
            const { killed } = applyCombatHit(unit, dest, {
              bonusDamage: getCombatXpBonus(unit, XP_CATEGORIES.melee),
              isMelee: true,
              menu,
              player,
              xpCategory: XP_CATEGORIES.melee,
              xpUnit: unit,
            })
            if (killed) {
              this.finishAttackAfterCurrentLoop()
              return false
            }
          }
        },
        {
          playRecoveryAnimation: (releaseFrame, onComplete) => this.playReverseSlashRecovery(releaseFrame, onComplete),
        }
      )
    }
  }
}
