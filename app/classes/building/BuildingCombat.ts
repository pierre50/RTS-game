import { TOWN_CENTER_DEFENSE } from '../../config/townCenter'
import { getBuildingAttackRange, getBuildingCombatProfile } from '../../lib/buildings/towerCombat'
import { sameMapSpace } from '../../lib/mapSpaces'
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
    if (
      !building.isBuilt ||
      building.isDead ||
      building.isDestroyed ||
      !getBuildingAttackRange(building) ||
      !building.projectile ||
      building.attackIntervalId != null
    )
      return
    const projectileType = building.projectile
    building.startAttackInterval(
      () => {
        if (!building.isBuilt || building.isDead || building.isDestroyed) {
          building.stopAttackInterval()
          return
        }
        const range = getBuildingAttackRange(building)!
        const profile = getBuildingCombatProfile(building)
        const valid = (candidate: RuntimeEntity) =>
          !candidate.isDead &&
          !candidate.isDestroyed &&
          candidate.family !== FAMILY_TYPES.animal &&
          sameMapSpace(building, candidate) &&
          getActionCondition(building, candidate, ACTION_TYPES.attack) &&
          instancesDistance(building, candidate) <= range
        const targets: RuntimeEntity[] = valid(target) ? [target] : []
        const limit = profile?.targets ?? 1
        if (targets.length < limit) {
          const candidates = findInstancesInSight<BuildingControllerHost, RuntimeEntity>(building, valid, {
            range,
            useInsightRange: true,
          })
            .filter(valid)
            .sort((a, b) => instancesDistance(building, a) - instancesDistance(building, b))
          for (const candidate of candidates) {
            if (targets.includes(candidate)) continue
            targets.push(candidate)
            if (targets.length >= limit) break
          }
        }
        if (!targets.length) {
          building.stopAttackInterval()
          return
        }
        target = targets[0]!
        for (const enemy of targets) {
          const projectile = new Projectile(
            {
              owner: building,
              type: projectileType,
              target: enemy,
              ...(profile ? { weaponPower: profile.power } : {}),
            },
            building.context
          )
          attachProjectileToMapSpace(projectile, map)
        }
      },
      building.type === 'TownCenter' ? TOWN_CENTER_DEFENSE.rateOfFire : building.rateOfFire
    )
  }

  detect(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    const range = getBuildingAttackRange(building)
    if (!range) return

    const actionOk = getActionCondition(building, instance, ACTION_TYPES.attack)
    const dist = instancesDistance(building, instance)

    if (
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      instance.family !== FAMILY_TYPES.animal &&
      building.attackIntervalId == null &&
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
    const range = getBuildingAttackRange(building)
    if (!range || !building.projectile) return
    const candidates = findInstancesInSight<BuildingControllerHost, RuntimeEntity>(
      building,
      candidate =>
        !candidate.isDead &&
        !candidate.isDestroyed &&
        candidate.family !== FAMILY_TYPES.animal &&
        sameMapSpace(building, candidate) &&
        getActionCondition(building, candidate, ACTION_TYPES.attack),
      { range, useInsightRange: true }
    )

    const target = candidates[0]
    if (target) building.detect(target)
  }

  isAttacked(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    const range = getBuildingAttackRange(building)
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
