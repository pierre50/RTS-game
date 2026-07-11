import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { getActionCondition, instancesDistance } from '../../lib'
import { Projectile } from '../Projectile'
import type { RuntimeEntity } from '../../types/entities'
import type { Building } from './index'

export class BuildingCombat {
  building: Building

  constructor(building: Building) {
    this.building = building
  }

  attackAction(target: RuntimeEntity): void {
    const building = this.building
    if (!building.isBuilt || building.isDead || !building.range || !building.projectile) return
    const range = building.range
    const projectileType = building.projectile
    const {
      context: { map },
    } = building
    building.startAttackInterval(() => {
      if (
        building.isBuilt &&
        getActionCondition(building, target, ACTION_TYPES.attack) &&
        instancesDistance(building, target) <= range
      ) {
        const projectile = new Projectile({ owner: building, type: projectileType, target }, building.context)
        map.addChild(projectile)
      } else {
        building.stopAttackInterval()
      }
    }, building.rateOfFire)
  }

  detect(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    if (
      building.isBuilt &&
      building.range &&
      instance.family !== FAMILY_TYPES.animal &&
      !building.attackIntervalId &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building, instance) <= building.range
    ) {
      this.attackAction(instance)
    }
  }

  isAttacked(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    building.owner.reportThreat?.(building, instance)
    if (
      building.isBuilt &&
      building.range &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building, instance) <= building.range
    ) {
      this.attackAction(instance)
    }
    building.updateHitPoints(ACTION_TYPES.attack)
  }
}
