import { Assets } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, MENU_INFO_IDS, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  degreeToDirection,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getHitPointsWithDamage,
  getInstanceDegree,
  instanceContactInstance,
  playAudibleSoundCue,
} from '../../lib'
import { Projectile } from '../projectile'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export class UnitCombat {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  setStandingPose() {
    const unit = this.unit
    const sprite = unit.sprite as unknown as { loop: boolean; onComplete: (() => void) | null }
    sprite.loop = true
    sprite.onComplete = null
    unit.setTextures?.(SHEET_TYPES.standing)
  }

  playSingleAttackAnimation(onFire: () => void) {
    const unit = this.unit
    const sprite = unit.sprite as unknown as { loop: boolean; onComplete: (() => void) | null }

    unit.actionLocked = true
    sprite.loop = false
    sprite.onComplete = () => {
      sprite.onComplete = null
      unit.actionLocked = false
      const hadPendingOrder = unit.flushPendingOrder?.()
      if (hadPendingOrder) {
        sprite.loop = true
        return
      }
      if (!unit.isDead && unit.action === ACTION_TYPES.attack) {
        this.setStandingPose()
      } else {
        sprite.loop = true
      }
    }
    unit.setTextures?.(SHEET_TYPES.action)
    onFire()
  }

  performRangedAttackCycle(launchProjectile: () => void) {
    const unit = this.unit

    if (!unit.getActionCondition?.(unit.dest)) {
      const dest = unit.dest as RuntimeEntity | null | undefined
      if (dest && (dest.hitPoints ?? 0) <= 0) {
        dest.die?.()
      }
      unit.affectNewDest?.()
      return
    }
    this.syncMovingTargetDirection()
    if (!unit.isUnitAtDest?.(unit.action, unit.dest)) {
      unit.sendToEvt?.(unit.dest ?? null, ACTION_TYPES.attack, { forceRepath: true })
      return
    }
    this.playSingleAttackAnimation(() => launchProjectile())
  }

  detect(instance: RuntimeEntity | null) {
    const unit = this.unit
    if (unit.context?.editor) return
    if (
      unit.work === WORK_TYPES.attacker &&
      instance &&
      instance.family === FAMILY_TYPES.unit &&
      !unit.path?.length &&
      !unit.dest &&
      unit.getActionCondition?.(instance, ACTION_TYPES.attack)
    ) {
      unit.sendTo?.(instance, ACTION_TYPES.attack)
    }
  }

  handleAffectNewDestHunter(): boolean {
    const unit = this.unit
    const unitAsInstance = unit as unknown as Parameters<typeof findInstancesInSight>[0]
    const firstTargets = findInstancesInSight(unitAsInstance, instance =>
      Boolean(unit.getActionCondition?.(instance as unknown as RuntimeEntity, ACTION_TYPES.takemeat))
    )
    if (firstTargets.length) {
      const target = getClosestInstanceWithPath(unitAsInstance, firstTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.takemeat) {
          unit.action = ACTION_TYPES.takemeat
          const workAssets = unit.work ? unit.allAssets?.[unit.work] : undefined
          if (workAssets) {
            unit.actionSheet = Assets.cache.get(workAssets.harvestSheet)
          }
        }
        unit.setDest?.(target.instance as unknown as RuntimeEntity)
        if (instanceContactInstance(unitAsInstance, target.instance)) {
          unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
          unit.getAction?.(unit.action)
          return true
        }
        unit.setPath?.(target.path as unknown as Parameters<NonNullable<UnitEntity['setPath']>>[0])
        return true
      }
    }
    const secondTargets = findInstancesInSight(unitAsInstance, instance =>
      Boolean(unit.getActionCondition?.(instance as unknown as RuntimeEntity, ACTION_TYPES.hunt))
    )
    if (secondTargets.length) {
      const target = getClosestInstanceWithPath(unitAsInstance, secondTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.hunt) {
          unit.action = ACTION_TYPES.hunt
          const workAssets = unit.work ? unit.allAssets?.[unit.work] : undefined
          if (workAssets) {
            unit.actionSheet = Assets.cache.get(workAssets.actionSheet)
          }
        }
        unit.setDest?.(target.instance as unknown as RuntimeEntity)
        if (instanceContactInstance(unitAsInstance, target.instance)) {
          unit.degree = getInstanceDegree(unitAsInstance, target.instance.x, target.instance.y)
          unit.getAction?.(unit.action)
          return true
        }
        unit.setPath?.(target.path as unknown as Parameters<NonNullable<UnitEntity['setPath']>>[0])
        return true
      }
    }
    return false
  }

  syncMovingTargetDirection() {
    const unit = this.unit
    const dest = unit.dest as RuntimeEntity | null | undefined
    if (unit.destHasMoved?.() && dest && unit.realDest) {
      unit.realDest.i = dest.i
      unit.realDest.j = dest.j
      unit.realDest.x = dest.x
      unit.realDest.y = dest.y
      const oldDeg = unit.degree
      unit.degree = getInstanceDegree(unit as unknown as Parameters<typeof getInstanceDegree>[0], dest.x, dest.y)
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

    if (!unit.getActionCondition?.(unit.dest)) {
      unit.affectNewDest?.()
      return
    }
    if (unit.range && unit.type !== UNIT_TYPES.villager) {
      this.setStandingPose()
      const launchProjectile = () => {
        const dest = unit.dest as RuntimeEntity | null | undefined
        if (!dest || !unit.getActionCondition?.(dest) || !unit.realDest || !map) return
        playAudibleSoundCue(unit as unknown as Parameters<typeof playAudibleSoundCue>[0], unit.sounds?.attack)
        const projectile = new Projectile(
          {
            owner: unit,
            target: dest,
            type: unit.projectile || '',
            destination: unit.realDest,
          },
          unit.context!
        )
        map.addChild(projectile)
      }
      this.performRangedAttackCycle(launchProjectile)
      unit.startInterval?.(
        () => this.performRangedAttackCycle(launchProjectile),
        (unit.rateOfFire ?? 1) * 1000,
        false,
        'unit.rangedAttack'
      )
    } else {
      const sprite = unit.sprite as unknown as { loop: boolean; onComplete: (() => void) | null }
      sprite.loop = true
      sprite.onComplete = null
      unit.setTextures?.(SHEET_TYPES.action)
      unit.startInterval?.(
        () => {
          const dest = unit.dest as RuntimeEntity | null | undefined
          if (!unit.getActionCondition?.(dest)) {
            if (dest && (dest.hitPoints ?? 0) <= 0) {
              dest.die?.()
            }
            unit.affectNewDest?.()
            return
          }
          this.syncMovingTargetDirection()
          if (!unit.isUnitAtDest?.(unit.action, dest)) {
            unit.sendToEvt?.(dest ?? null, ACTION_TYPES.attack, { forceRepath: true })
            return
          }
          if (unit.sounds && unit.sounds.hit) {
            playAudibleSoundCue(unit as unknown as Parameters<typeof playAudibleSoundCue>[0], unit.sounds.hit)
          }
          if (dest && (dest.hitPoints ?? 0) > 0) {
            dest.hitPoints = getHitPointsWithDamage(
              unit as unknown as Parameters<typeof getHitPointsWithDamage>[0],
              dest as unknown as Parameters<typeof getHitPointsWithDamage>[1]
            )
            if (dest.selected) {
              dest.drawHealthBar?.()
              const playerLike = player as unknown as { selectedUnit?: unknown; selectedBuilding?: unknown; selectedOther?: unknown }
              if (
                playerLike.selectedUnit === dest ||
                playerLike.selectedBuilding === dest ||
                playerLike.selectedOther === dest
              ) {
                menu?.updateInfo?.(MENU_INFO_IDS.hitPoints, dest.hitPoints + '/' + dest.totalHitPoints)
              }
            }
            dest.isAttacked?.(unit)
            if ((dest.hitPoints ?? 0) <= 0) {
              dest.die?.()
              unit.affectNewDest?.()
            }
          }
        },
        (unit.rateOfFire ?? 1) * 1000,
        false,
        'unit.meleeAttack'
      )
    }
  }
}
