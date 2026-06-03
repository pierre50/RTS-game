import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { getActionCondition, instancesDistance } from '../../lib'
import { Projectile } from '../projectile'

export class BuildingCombat {
  constructor(building) {
    this.building = building
  }

  attackAction(target) {
    const building = this.building
    const {
      context: { map },
    } = building
    building.startAttackInterval(() => {
      if (
        getActionCondition(building, target, ACTION_TYPES.attack) &&
        instancesDistance(building, target) <= building.range
      ) {
        const projectile = new Projectile({ owner: building, type: building.projectile, target }, building.context)
        map.addChild(projectile)
      } else {
        building.stopAttackInterval()
      }
    }, building.rateOfFire)
  }

  detect(instance) {
    const building = this.building
    if (
      building.range &&
      instance.family !== FAMILY_TYPES.animal &&
      !building.attackIntervalId &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building, instance) <= building.range
    ) {
      this.attackAction(instance)
    }
  }

  isAttacked(instance) {
    const building = this.building
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    if (
      building.range &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building, instance) <= building.range
    ) {
      this.attackAction(instance)
    }
    building.updateHitPoints(ACTION_TYPES.attack)
  }
}
