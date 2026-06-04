import { sound } from '@pixi/sound'
import { Assets } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, MENU_INFO_IDS, SHEET_TYPES, UNIT_TYPES, WORK_TYPES } from '../../constants'
import {
  degreeToDirection,
  findInstancesInSight,
  getClosestInstanceWithPath,
  getHitPointsWithDamage,
  getInstanceDegree,
  instanceContactInstance,
  onSpriteLoopAtFrame,
  randomItem,
} from '../../lib'
import { Projectile } from '../projectile'

export class UnitCombat {
  constructor(unit) {
    this.unit = unit
  }

  detect(instance) {
    const unit = this.unit
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
        if (instanceContactInstance(unit, target)) {
          unit.degree = getInstanceDegree(unit, target.x, target.y)
          unit.getAction(unit.action)
          return true
        }
        unit.setDest(target.instance)
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
        if (instanceContactInstance(unit, target)) {
          unit.degree = getInstanceDegree(unit, target.x, target.y)
          unit.getAction(unit.action)
          return true
        }
        unit.setDest(target.instance)
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
    unit.setTextures(SHEET_TYPES.action)
    if (unit.range && unit.type !== UNIT_TYPES.villager) {
      unit.sprite.onLoop = () => {
        if (!unit.getActionCondition(unit.dest)) {
          if (unit.dest && unit.dest.hitPoints <= 0) {
            unit.dest.die()
          }
          unit.affectNewDest()
          return
        }
        if (!unit.isUnitAtDest(unit.action, unit.dest)) {
          unit.stop()
          return
        }
        this.syncMovingTargetDirection()
      }
      onSpriteLoopAtFrame(unit.sprite, 6, () => {
        if (!unit.getActionCondition(unit.dest) || !unit.realDest) return
        if (unit.sounds?.attack && unit.context.controls.instanceIsAudible(unit)) {
          sound.play(Array.isArray(unit.sounds.attack) ? randomItem(unit.sounds.attack) : unit.sounds.attack)
        }
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
      })
    } else {
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
            unit.sendTo(unit.dest, ACTION_TYPES.attack)
            return
          }
          if (unit.sounds && unit.sounds.hit) {
            unit.context.controls.instanceIsAudible(unit) &&
              sound.play(Array.isArray(unit.sounds.hit) ? randomItem(unit.sounds.hit) : unit.sounds.hit)
          }
          if (unit.dest.hitPoints > 0) {
            unit.dest.hitPoints = getHitPointsWithDamage(unit, unit.dest)
            if (
              unit.dest.selected &&
              (player.selectedUnit === unit.dest ||
                player.selectedBuilding === unit.dest ||
                player.selectedOther === unit.dest)
            ) {
              menu.updateInfo(MENU_INFO_IDS.hitPoints, unit.dest.hitPoints + '/' + unit.dest.totalHitPoints)
            }
            unit.dest.isAttacked(unit)
            if (unit.dest.hitPoints <= 0) {
              unit.dest.die()
              unit.affectNewDest()
            }
          }
        },
        unit.rateOfFire * 1000,
        false
      )
    }
  }
}
