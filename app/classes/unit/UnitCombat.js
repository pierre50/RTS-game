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

export class UnitCombat {
  constructor(unit) {
    this.unit = unit
  }

  setStandingPose() {
    const unit = this.unit
    unit.sprite.loop = true
    unit.sprite.onComplete = null
    unit.setTextures(SHEET_TYPES.standing)
  }

  playSingleAttackAnimation(onFire) {
    const unit = this.unit

    unit.actionLocked = true
    unit.sprite.loop = false
    unit.sprite.onComplete = () => {
      unit.sprite.onComplete = null
      unit.actionLocked = false
      const hadPendingOrder = unit.flushPendingOrder()
      if (hadPendingOrder) {
        unit.sprite.loop = true
        return
      }
      if (!unit.isDead && unit.action === ACTION_TYPES.attack) {
        this.setStandingPose()
      } else {
        unit.sprite.loop = true
      }
    }
    unit.setTextures(SHEET_TYPES.action)
    onFire()
  }

  performRangedAttackCycle(launchProjectile) {
    const unit = this.unit

    if (!unit.getActionCondition(unit.dest)) {
      if (unit.dest && unit.dest.hitPoints <= 0) {
        unit.dest.die()
      }
      unit.affectNewDest()
      return
    }
    this.syncMovingTargetDirection()
    if (!unit.isUnitAtDest(unit.action, unit.dest)) {
      unit.sendToEvt(unit.dest, ACTION_TYPES.attack, { forceRepath: true })
      return
    }
    this.playSingleAttackAnimation(() => launchProjectile())
  }

  detect(instance) {
    const unit = this.unit
    if (unit.context.editor) return
    if (
      unit.work === WORK_TYPES.attacker &&
      instance &&
      instance.family === FAMILY_TYPES.unit &&
      !unit.path.length &&
      !unit.dest &&
      unit.getActionCondition(instance, ACTION_TYPES.attack)
    ) {
      unit.sendTo(instance, ACTION_TYPES.attack)
    }
  }

  handleAffectNewDestHunter() {
    const unit = this.unit
    const firstTargets = findInstancesInSight(unit, instance =>
      unit.getActionCondition(instance, ACTION_TYPES.takemeat)
    )
    if (firstTargets.length) {
      const target = getClosestInstanceWithPath(unit, firstTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.takemeat) {
          unit.action = ACTION_TYPES.takemeat
          if (unit.allAssets[unit.work]) {
            unit.actionSheet = Assets.cache.get(unit.allAssets[unit.work].harvestSheet)
          }
        }
        unit.setDest(target.instance)
        if (instanceContactInstance(unit, target.instance)) {
          unit.degree = getInstanceDegree(unit, target.instance.x, target.instance.y)
          unit.getAction(unit.action)
          return true
        }
        unit.setPath(target.path)
        return true
      }
    }
    const secondTargets = findInstancesInSight(unit, instance => unit.getActionCondition(instance, ACTION_TYPES.hunt))
    if (secondTargets.length) {
      const target = getClosestInstanceWithPath(unit, secondTargets)
      if (target) {
        if (unit.action !== ACTION_TYPES.hunt) {
          unit.action = ACTION_TYPES.hunt
          if (unit.allAssets[unit.work]) {
            unit.actionSheet = Assets.cache.get(unit.allAssets[unit.work].actionSheet)
          }
        }
        unit.setDest(target.instance)
        if (instanceContactInstance(unit, target.instance)) {
          unit.degree = getInstanceDegree(unit, target.instance.x, target.instance.y)
          unit.getAction(unit.action)
          return true
        }
        unit.setPath(target.path)
        return true
      }
    }
    return false
  }

  syncMovingTargetDirection() {
    const unit = this.unit
    if (unit.destHasMoved()) {
      unit.realDest.i = unit.dest.i
      unit.realDest.j = unit.dest.j
      unit.realDest.x = unit.dest.x
      unit.realDest.y = unit.dest.y
      const oldDeg = unit.degree
      unit.degree = getInstanceDegree(unit, unit.dest.x, unit.dest.y)
      if (degreeToDirection(oldDeg) !== degreeToDirection(unit.degree)) {
        unit.setTextures(SHEET_TYPES.action)
      }
    }
  }

  handleAttackAction() {
    const unit = this.unit
    const {
      context: { map, menu, player },
    } = unit

    if (!unit.getActionCondition(unit.dest)) {
      unit.affectNewDest()
      return
    }
    if (unit.range && unit.type !== UNIT_TYPES.villager) {
      this.setStandingPose()
      const launchProjectile = () => {
        if (!unit.getActionCondition(unit.dest) || !unit.realDest) return
        playAudibleSoundCue(unit, unit.sounds?.attack)
        const projectile = new Projectile(
          {
            owner: unit,
            target: unit.dest,
            type: unit.projectile,
            destination: unit.realDest,
          },
          unit.context
        )
        map.addChild(projectile)
      }
      this.performRangedAttackCycle(launchProjectile)
      unit.startInterval(
        () => this.performRangedAttackCycle(launchProjectile),
        unit.rateOfFire * 1000,
        false,
        'unit.rangedAttack'
      )
    } else {
      unit.sprite.loop = true
      unit.sprite.onComplete = null
      unit.setTextures(SHEET_TYPES.action)
      unit.startInterval(
        () => {
          if (!unit.getActionCondition(unit.dest)) {
            if (unit.dest && unit.dest.hitPoints <= 0) {
              unit.dest.die()
            }
            unit.affectNewDest()
            return
          }
          this.syncMovingTargetDirection()
          if (!unit.isUnitAtDest(unit.action, unit.dest)) {
            unit.sendToEvt(unit.dest, ACTION_TYPES.attack, { forceRepath: true })
            return
          }
          if (unit.sounds && unit.sounds.hit) {
            playAudibleSoundCue(unit, unit.sounds.hit)
          }
          if (unit.dest.hitPoints > 0) {
            unit.dest.hitPoints = getHitPointsWithDamage(unit, unit.dest)
            if (unit.dest.selected) {
              unit.dest.drawHealthBar()
              if (
                player.selectedUnit === unit.dest ||
                player.selectedBuilding === unit.dest ||
                player.selectedOther === unit.dest
              ) {
                menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints)
              }
            }
            unit.dest.isAttacked(unit)
            if (unit.dest.hitPoints <= 0) {
              unit.dest.die()
              unit.affectNewDest()
            }
          }
        },
        unit.rateOfFire * 1000,
        false,
        'unit.meleeAttack'
      )
    }
  }
}
