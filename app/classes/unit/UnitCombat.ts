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
  BOW_SHOOT_RELEASE_FRAME,
  findInstancesInSight,
  getClosestInstanceWithPath,
  playAudibleSoundCue,
  prepareAutomaticParry,
  SLASH_IMPACT_FRAME,
  syncMovedActionTarget,
} from '../../lib'
import { getActionAnimationReleaseFrame } from '../../lib/animations/actionFrameSequences'
import { canUnitEnterBuildingInteriorForAssault } from '../../lib/buildings/interiorAccess'
import { runAttackLoopOnFrame } from '../../lib/combat/combatAttackLoop'
import { markCombatAttack } from '../../lib/combat/combatBehavior'
import { getUnitMeleeWeapon, usesMeleeAttack } from '../../lib/combat/unitMelee'
import { showContactDebug } from '../../lib/contact/contactDebug'
import { getContactAimDegree, isContactTouching } from '../../lib/contact/contactGeometry'
import { definedProperties } from '../../lib/definedProperties'
import { playReverseSlashRecovery } from '../../lib/entities/slashRecoveryAnimation'
import { getUnitAnimation } from '../../rendering/UnitAnimation'
import { isBrokenCombatWeapon } from '../../lib/equipment/equipmentCondition'
import {
  getConfiguredEntityEquipment,
  getEntityWeaponPower,
  getUnitCombatRange,
} from '../../lib/equipment/equipmentStats'
import { wearEquippedWeapon } from '../../lib/equipment/equipmentWear'
import { attachProjectileToMapSpace } from '../../lib/projectiles'
import { isVillagerWorkTargetRejected } from '../../lib/units/autonomy/villagerAutonomyTargeting'
import { canVillagerAutonomouslyHunt } from '../../lib/units/autonomy/villagerHunting'
import { getNpcWeaponChoice, hasNpcWeaponInventory, sameNpcWeapon } from '../../lib/units/combat/npcWeapons'
import { consumeRangedAmmunition } from '../../lib/units/combat/rangedShot'
import { hasUnitArrow, npcArrowCapacity, usesArcherDagger } from '../../lib/units/combat/unitArrows'
import { takeSprintAttackMultiplier } from '../../lib/units/movement/unitSprint'
import { getCombatXpBonus, XP_CATEGORIES } from '../../lib/units/unitExperience'
import { applyUnitActivitySpritesheets } from '../../lib/units/visuals/unitSpriteAssets'
import { setUnitVisualSheet } from '../../lib/units/visuals/unitVisualTransition'
import {
  ensureRuntimeBuildingInteriorSpace,
  routeUnitIntoBuildingInteriorSpace,
} from '../../services/BuildingInteriorSpaceSystem'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { Projectile } from '../Projectile'
import { detectCombatThreat } from './UnitCombatDetection'
import { getMeleeImpactSound } from './UnitCombatSounds'

const PROJECTILE_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

type AttackLoopVisualOptions = {
  trackTargetOnRelease?: boolean
  onAttackPrepared?: (target: RuntimeEntity) => void
  playRecoveryAnimation?: (releaseFrame: number, onComplete: () => void) => boolean | void
}

export class UnitCombat {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  // One impact per animation, followed by recovery; re-evaluate carried weapons
  // before each windup and release so inventory changes cannot fire stale attacks.
  runAttackLoop(
    releaseFrame: number,
    onFire: (dest: RuntimeEntity | null) => boolean | void,
    visualOptions: AttackLoopVisualOptions = {}
  ) {
    const unit = this.unit
    const initialWeapon = hasNpcWeaponInventory(unit) ? getNpcWeaponChoice(unit) : null
    runAttackLoopOnFrame(
      unit,
      definedProperties({
        releaseFrame,
        validateAttack: initialWeapon
          ? () => {
              const next = getNpcWeaponChoice(unit)
              if (sameNpcWeapon(next, initialWeapon)) return true
              unit.sendToEvt?.(unit.dest ?? null, ACTION_TYPES.attack, { forceRepath: true })
              return false
            }
          : undefined,
        trackTargetOnRelease: visualOptions.trackTargetOnRelease,
        syncMovingTargetDirection: () => this.syncMovingTargetDirection(),
        prepareAttackSheet: () => {
          applyUnitActivitySpritesheets(unit)
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
        onAttackPrepared: visualOptions.onAttackPrepared,
        playRecoveryAnimation: visualOptions.playRecoveryAnimation,
        onOutOfRange: (dest: RuntimeEntity | null) => {
          unit.sendToEvt?.(dest, ACTION_TYPES.attack, { forceRepath: true })
        },
        onTargetUnavailable: (dest: RuntimeEntity | null, phase: 'preflight' | 'release') => {
          if (dest && (dest.hitPoints ?? 0) <= 0) {
            dest.die?.()
          }
          if (phase === 'preflight') {
            if (this.tryEnterBuildingInteriorAssault(dest)) return
            unit.affectNewDest?.()
            return
          }
          this.finishAttackAfterCurrentLoop()
        },
        onReadyToAttack: (target: RuntimeEntity) => onFire(target),
      })
    )
  }

  playReverseSlashRecovery(releaseFrame: number, onComplete: () => void): boolean {
    return playReverseSlashRecovery(this.unit, { onComplete, releaseFrame })
  }

  tryEnterBuildingInteriorAssault(target: RuntimeEntity | null): boolean {
    const unit = this.unit
    if (!target || target.family !== FAMILY_TYPES.building || !unit.context) return false
    if (!canUnitEnterBuildingInteriorForAssault(unit, target)) return false
    const space = ensureRuntimeBuildingInteriorSpace(unit.context, target)
    if (!space) return false
    return routeUnitIntoBuildingInteriorSpace(unit.context, unit, space)
  }

  finishAttackAfterCurrentLoop() {
    const unit = this.unit
    if (unit.isDead || unit.isDestroyed) return
    const animation = getUnitAnimation(unit)
    if (!animation) {
      unit.affectNewDest?.()
      return
    }

    unit.actionLocked = true
    animation.clearFrameCallback()
    const token = unit.visualAnimationToken
    const action = unit.action
    const dest = unit.dest
    animation.onLoop(() => {
      if (
        unit.isDead ||
        unit.isDestroyed ||
        unit.visualAnimationToken !== token ||
        unit.action !== action ||
        unit.dest !== dest
      )
        return
      animation.clearLoopCallback()
      unit.actionLocked = false
      const hadPendingOrder = unit.flushPendingOrder?.()
      if (!hadPendingOrder) unit.affectNewDest?.()
    })
  }

  detect(instance: RuntimeEntity | null) {
    detectCombatThreat(this.unit, instance)
  }

  tryHunterTarget(action: string): boolean {
    const unit = this.unit
    const unitAsInstance = unit
    const targets = findInstancesInSight<UnitEntity, RuntimeEntity>(
      unitAsInstance,
      instance =>
        Boolean(unit.getActionCondition?.(instance, action)) &&
        !isVillagerWorkTargetRejected(unit, instance) &&
        (unit.autonomousJob !== 'food' || action !== ACTION_TYPES.hunt || canVillagerAutonomouslyHunt(unit, instance))
    )
    if (!targets.length) return false
    const target = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(unitAsInstance, targets)
    if (!target) return false
    // Use the same precise contact approach as normal work orders, including carcasses.
    // Grid adjacency alone does not guarantee that the hunter can reach the loot.
    unit.sendToEvt?.(target.instance, action, { forceRepath: true, preserveAutonomy: true })
    return true
  }

  handleAffectNewDestHunter(): boolean {
    return this.tryHunterTarget(ACTION_TYPES.takemeat) || this.tryHunterTarget(ACTION_TYPES.hunt)
  }

  syncMovingTargetDirection() {
    const unit = this.unit
    const dest = isRuntimeEntity(unit.dest) ? unit.dest : null
    if (dest && usesMeleeAttack(unit)) {
      unit.degree = getContactAimDegree(unit, dest)
      return
    }
    syncMovedActionTarget(unit, dest)
  }

  handleAttackAction() {
    const unit = this.unit
    const map = unit.context?.map
    const menu = unit.context?.menu
    const player = unit.owner
    const inventoryCombat = hasNpcWeaponInventory(unit)
    const rangedAttackRange = getUnitCombatRange(unit)
    if (
      !inventoryCombat &&
      npcArrowCapacity(unit) &&
      unit.type !== UNIT_TYPES.villager &&
      !hasUnitArrow(unit) &&
      !usesArcherDagger(unit)
    ) {
      unit.stop?.()
      return
    }
    markCombatAttack(unit)
    applyUnitActivitySpritesheets(unit)
    if (!inventoryCombat && getConfiguredEntityEquipment(unit).some(isBrokenCombatWeapon)) {
      unit.stop?.()
      return
    }

    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    if (rangedAttackRange && (inventoryCombat || (unit.projectile && unit.type !== UNIT_TYPES.villager))) {
      this.runAttackLoop(BOW_SHOOT_RELEASE_FRAME, dest => {
        if (!dest || !unit.realDest || !map) return
        const weaponPower = getEntityWeaponPower(unit)
        const firedWeapon = inventoryCombat ? getNpcWeaponChoice(unit) : null
        if (firedWeapon && firedWeapon.kind !== 'ranged') {
          applyUnitActivitySpritesheets(unit)
          unit.sendToEvt?.(dest, ACTION_TYPES.attack, { forceRepath: true })
          return false
        }
        const projectileType = inventoryCombat || npcArrowCapacity(unit) ? consumeRangedAmmunition(unit) : null
        if ((inventoryCombat || npcArrowCapacity(unit)) && !projectileType) {
          if (inventoryCombat || usesArcherDagger(unit)) {
            applyUnitActivitySpritesheets(unit)
            unit.sendToEvt?.(dest, ACTION_TYPES.attack, { forceRepath: true })
          } else unit.stop?.()
          return
        }
        playAudibleSoundCue(unit, unit.sounds?.attack, { profile: 'combat' })
        const projectile = new Projectile(
          {
            owner: unit,
            weaponPower,
            target: dest,
            type: projectileType ?? unit.projectile ?? '',
            destination: unit.realDest,
            maxDistance: (firedWeapon?.range ?? rangedAttackRange) * PROJECTILE_CELL_DISTANCE,
          },
          unit.context!
        )
        attachProjectileToMapSpace(projectile, map)
        wearEquippedWeapon(
          unit,
          'ranged',
          firedWeapon?.weapon ? unit.inventory?.equipment?.indexOf(firedWeapon.weapon) : undefined
        )
        if (
          (inventoryCombat && firedWeapon && !sameNpcWeapon(getNpcWeaponChoice(unit), firedWeapon)) ||
          (!inventoryCombat && usesArcherDagger(unit))
        ) {
          // The last arrow still flies; resume the order with melee range and art.
          applyUnitActivitySpritesheets(unit)
          unit.sendToEvt?.(dest, ACTION_TYPES.attack, { forceRepath: true })
          return false
        }
      })
    } else {
      let sprintMultiplier = 1
      this.runAttackLoop(
        getActionAnimationReleaseFrame(unit, ACTION_TYPES.attack, SLASH_IMPACT_FRAME),
        dest => {
          const attackSprintMultiplier = sprintMultiplier
          sprintMultiplier = 1
          showContactDebug(unit, dest ? [dest] : [], getUnitMeleeWeapon(unit))
          if (!dest || !isContactTouching(unit, dest, getUnitMeleeWeapon(unit))) {
            playAudibleSoundCue(unit, SOUND_CUES.hero.meleeWhiff, { profile: 'combat' })
            return
          }
          playAudibleSoundCue(unit, getMeleeImpactSound(unit, dest), { profile: 'combat' })
          if (dest && (dest.hitPoints ?? 0) > 0) {
            const { killed } = applyCombatHit(unit, dest, {
              ...(attackSprintMultiplier > 1
                ? { defaultDamage: getEntityWeaponPower(unit) * attackSprintMultiplier }
                : {}),
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
          trackTargetOnRelease: false,
          onAttackPrepared: target => {
            sprintMultiplier = takeSprintAttackMultiplier(unit)
            prepareAutomaticParry?.(target)
          },
          playRecoveryAnimation: (releaseFrame, onComplete) => this.playReverseSlashRecovery(releaseFrame, onComplete),
        }
      )
    }
  }
}
