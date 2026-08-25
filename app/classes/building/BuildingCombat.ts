import { ACTION_TYPES, BUILDING_TYPES, FAMILY_TYPES } from '../../constants'
import { findInstancesInSight, getActionCondition, instancesDistance } from '../../lib'
import { Projectile } from '../Projectile'
import type { RuntimeEntity } from '../../types/entities'
import type { BuildingControllerHost } from './BuildingTypes'

type BuildingCombatRangeByAge = Partial<Record<number, number>>

const BUILDING_RANGED_ATTACK_RANGES_BY_AGE: Record<string, BuildingCombatRangeByAge> = {
  [BUILDING_TYPES.watchTower]: {
    1: 6,
  },
}

function getBuildingCombatRange(building: BuildingControllerHost): number | undefined {
  const map = BUILDING_RANGED_ATTACK_RANGES_BY_AGE[building.type]
  if (!map) return building.range

  const ownerAge = building.owner?.age ?? 0
  for (let currentAge = ownerAge; currentAge >= 0; currentAge--) {
    const ageRange = map[currentAge]
    if (typeof ageRange === 'number') return ageRange
  }
  return building.range
}

export class BuildingCombat {
  building: BuildingControllerHost

  constructor(building: BuildingControllerHost) {
    this.building = building
  }

  attackAction(target: RuntimeEntity): void {
    const building = this.building
    const range = getBuildingCombatRange(building)
    if (!building.isBuilt || building.isDead || !range || !building.projectile) return
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
    const range = getBuildingCombatRange(building)
    if (!range) return

    const actionOk = getActionCondition(building, instance, ACTION_TYPES.attack)
    const dist = instancesDistance(building, instance)
    console.debug(
      `[TowerDetect] ${building.type}#${building.label} <- ${instance.type ?? instance.family}#${instance.label}`,
      {
        isBuilt: building.isBuilt,
        isAnimal: instance.family === FAMILY_TYPES.animal,
        alreadyAttacking: Boolean(building.attackIntervalId),
        actionOk,
        dist: Number(dist.toFixed(1)),
        range,
        inRange: dist <= range,
        targetOwner: instance.owner?.label,
        targetHitPoints: instance.hitPoints,
      }
    )

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

  // Vision-driven aggro (see FogOfWar.updateVisibility) only fires when a mover's own sight
  // newly reveals this building, so a tower that just came into existence surrounded by
  // already-stationary enemies would otherwise never take its first shot. Scan once here.
  // Called both from the gradual-construction path (BuildingLifecycle.updateTexture) and the
  // instant-build path (constructed directly with isBuilt: true, e.g. map generation).
  scanForInitialTarget(): void {
    const building = this.building
    const range = getBuildingCombatRange(building)
    if (!range || !building.projectile) return
    const candidates = findInstancesInSight<BuildingControllerHost, RuntimeEntity>(
      building,
      candidate => getActionCondition(building, candidate, ACTION_TYPES.attack),
      { range, useInsightRange: true }
    )
    console.debug(
      `[TowerBuilt] ${building.type}#${building.label} range=${range}: ${candidates.length} hostile candidate(s)`,
      candidates.map(c => ({
        type: c.type ?? c.family,
        label: c.label,
        owner: c.owner?.label,
        dist: Number(instancesDistance(building, c).toFixed(1)),
      }))
    )
    const target = candidates[0]
    if (target) building.detect(target)
  }

  isAttacked(instance: RuntimeEntity): void {
    const building = this.building
    if (building.context.editor) return
    const range = getBuildingCombatRange(building)
    if (building.isDead || !getActionCondition(building, instance, ACTION_TYPES.attack)) return
    building.owner.reportThreat?.(building, instance)
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
