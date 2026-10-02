import { refreshPopulationCapacity } from '../../lib/buildings/buildingOccupancy'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { expelBuildingInteriorOccupants } from '../../services/BuildingInteriorSpaceSystem'
import { getBuildingTrainingLoad } from '../../lib/buildings/buildingTraining'
import { getBuildingConfigForLevel, getBuildingLevel } from '../../lib/buildings/buildingLevel'
import { nextBuildingUpgrade } from '../../lib/buildings/buildingUpgrade'
import { heroCanCommand } from '../../lib/chief'
import { isHeroInteractionTargetReachable } from '../../lib/hero/heroActionRange'
import { createConstructionMaterials } from '../../lib/economy/constructionMaterials'
import { notifyVillageWorkChanged } from '../../lib/units/villageWorkEvents'
import { notifyVillageStateChanged } from '../../lib/units/villageStateEvents'

export function canStartBuildingUpgrade(building: BuildingEntity, hero?: UnitEntity | null): boolean {
  return Boolean(
    building.owner &&
      hero &&
      hero.owner === building.owner &&
      heroCanCommand(hero) &&
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      !building.indestructible &&
      !building.buildingUpgrade &&
      getBuildingTrainingLoad(building) === 0 &&
      !building.trainingRequests?.length &&
      nextBuildingUpgrade(building.owner.config.buildings[building.type], getBuildingLevel(building)) != null &&
      isHeroInteractionTargetReachable(hero, null, building)
  )
}

export function startBuildingUpgrade(building: BuildingEntity, hero?: UnitEntity | null): boolean {
  if (!building.owner || !canStartBuildingUpgrade(building, hero)) return false
  const targetLevel = nextBuildingUpgrade(building.owner.config.buildings[building.type], getBuildingLevel(building))!
  const config = getBuildingConfigForLevel(building.owner.config.buildings[building.type], targetLevel)
  building.buildingUpgrade = {
    targetLevel,
    hitPoints: 1,
    totalHitPoints: config.totalHitPoints ?? 1,
    constructionTime: config.constructionTime ?? 1,
  }
  building.constructionMaterials = createConstructionMaterials(config.cost)
  if (building.context) expelBuildingInteriorOccupants(building.context, building, { unitsOnly: true })
  refreshPopulationCapacity(building.owner)
  building.context?.menu?.updateTopbar?.()
  building.updateHitPoints?.('build')
  notifyVillageWorkChanged(building.owner)
  notifyVillageStateChanged(building.owner)
  return true
}
