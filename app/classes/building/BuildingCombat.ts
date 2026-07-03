import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { getActionCondition, instancesDistance } from '../../lib'
import { Projectile } from '../projectile'

type AnyRecord = Record<string, any>

export class BuildingCombat {
  building: AnyRecord

  constructor(building: AnyRecord) {
    this.building = building
  }

  attackAction(target: AnyRecord): void {
    const building = this.building
    if (!building.isBuilt || building.isDead) return
    const {
      context: { map },
    } = building
    building.startAttackInterval(() => {
      if (
        building.isBuilt &&
        getActionCondition(building, target, ACTION_TYPES.attack) &&
        instancesDistance(building as any, target as any) <= building.range
      ) {
        const projectile = new Projectile({ owner: building, type: building.projectile, target }, building.context)
        map.addChild(projectile)
      } else {
        building.stopAttackInterval()
      }
    }, building.rateOfFire)
  }

  detect(instance: AnyRecord): void {
    const building = this.building
    if (building.context.editor) return
    if (
      building.isBuilt &&
      building.range &&
      instance.family !== FAMILY_TYPES.animal &&
      !building.attackIntervalId &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building as any, instance as any) <= building.range
    ) {
      this.attackAction(instance)
    }
  }

  isAttacked(instance: AnyRecord): void {
    const building = this.building
    if (building.context.editor) return
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    building.owner.reportThreat?.(building, instance)
    if (
      building.isBuilt &&
      building.range &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building as any, instance as any) <= building.range
    ) {
      this.attackAction(instance)
    }
    building.updateHitPoints(ACTION_TYPES.attack)
  }
}
