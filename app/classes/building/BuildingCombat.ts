import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { getActionCondition, instancesDistance } from '../../lib'
import { Projectile } from '../projectile'
import type { LooseRecord } from '../../types/common'
import type { RuntimeEntity } from '../../types/entities'
import type { Building } from './index'

export class BuildingCombat {
  building: Building & LooseRecord

  constructor(building: Building & LooseRecord) {
    this.building = building
  }

  attackAction(target: RuntimeEntity & LooseRecord): void {
    const building = this.building as LooseRecord
    if (!building.isBuilt || building.isDead) return
    const {
      context: { map },
    } = building
    building.startAttackInterval(() => {
      if (
        building.isBuilt &&
        getActionCondition(building, target, ACTION_TYPES.attack) &&
        instancesDistance(
          building as unknown as Parameters<typeof instancesDistance>[0],
          target as unknown as Parameters<typeof instancesDistance>[1]
        ) <= building.range
      ) {
        const projectile = new Projectile({ owner: building as unknown as RuntimeEntity, type: building.projectile, target }, building.context)
        map.addChild(projectile)
      } else {
        building.stopAttackInterval()
      }
    }, building.rateOfFire)
  }

  detect(instance: RuntimeEntity & LooseRecord): void {
    const building = this.building as LooseRecord
    if (building.context.editor) return
    if (
      building.isBuilt &&
      building.range &&
      instance.family !== FAMILY_TYPES.animal &&
      !building.attackIntervalId &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(
        building as unknown as Parameters<typeof instancesDistance>[0],
        instance as unknown as Parameters<typeof instancesDistance>[1]
      ) <= building.range
    ) {
      this.attackAction(instance)
    }
  }

  isAttacked(instance: RuntimeEntity & LooseRecord): void {
    const building = this.building as LooseRecord
    if (building.context.editor) return
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    building.owner.reportThreat?.(building, instance)
    if (
      building.isBuilt &&
      building.range &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(
        building as unknown as Parameters<typeof instancesDistance>[0],
        instance as unknown as Parameters<typeof instancesDistance>[1]
      ) <= building.range
    ) {
      this.attackAction(instance)
    }
    building.updateHitPoints(ACTION_TYPES.attack)
  }
}
