import { ACTION_TYPES, FAMILY_TYPES } from '../../constants'
import { findInstancesInSight, getActionCondition, instancesDistance } from '../../lib'
import { attachProjectileToMapSpace } from '../../lib/projectiles'
import { Projectile } from '../Projectile'
import type { RuntimeEntity } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'

export class BuildingCombat {
  building: BuildingControllerHost

  constructor(building: BuildingControllerHost) {
    this.building = building
  }

  attackAction(target: RuntimeEntity): void {
    const building = this.building
    const map = building.context.map
    const range = building.range
    if (!building.isBuilt || building.isDead || !range || !building.projectile) return
    const projectileType = building.projectile
    building.startAttackInterval(() => {
      if (
        building.isBuilt &&
        getActionCondition(building, target, ACTION_TYPES.attack) &&
        instancesDistance(building, target) <= range
      ) {
        const projectile = new Projectile({ owner: building, type: projectileType, target }, building.context)
        attachProjectileToMapSpace(projectile, map)
      } else {
        building.stopAttackInterval()
      }
    }, building.rateOfFire)
  }

  detect(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    const range = building.range
    if (!range) return

    const actionOk = getActionCondition(building, instance, ACTION_TYPES.attack)
    const dist = instancesDistance(building, instance)

    if (
      building.isBuilt &&
      instance.family !== FAMILY_TYPES.animal &&
      !building.attackIntervalId &&
      actionOk &&
      dist <= range
    ) {
      this.attackAction(instance)
    }
  }

  // Vision-driven aggro (see UnitPerception.updateVisibility) only fires when a mover's own sight
  // newly reveals this building, so a tower that just came into existence surrounded by
  // already-stationary enemies would otherwise never take its first shot. Scan once here.
  // Called both from the gradual-construction path (BuildingLifecycle.updateTexture) and the
  // instant-build path (constructed directly with isBuilt: true, e.g. map generation).
  scanForInitialTarget(): void {
    const building = this.building
    const range = building.range
    if (!range || !building.projectile) return
    const candidates = findInstancesInSight<BuildingControllerHost, RuntimeEntity>(
      building,
      candidate => getActionCondition(building, candidate, ACTION_TYPES.attack),
      { range, useInsightRange: true }
    )

    const target = candidates[0]
    if (target) building.detect(target)
  }

  isAttacked(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    const range = building.range
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    building.owner.reportThreat?.(building, instance)
    building.context.unitRest?.handleShelterAttack?.(building, instance)
    if (
      building.isBuilt &&
      range &&
      getActionCondition(building, instance, ACTION_TYPES.attack) &&
      instancesDistance(building, instance) <= range
    ) {
      this.attackAction(instance)
    }
    building.updateHitPoints(ACTION_TYPES.attack)
  }
}
