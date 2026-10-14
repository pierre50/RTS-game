import { planVillagerArrivals } from '../../lib/population/villagerArrivals'
import { getBaseTerritory } from '../../lib/territory/baseTerritory'
import {
  getHouseholdUnits,
  getHouseResidents,
  getVacantHomes,
  getFreeHouseBedLabels,
  householdTown,
} from '../../lib/housing/households'
import { getPopulationCapacityFromBuildings } from '../../lib/buildings/buildingOccupancy'
import { isStaticSettlement } from '../../config/world/settlementProfiles'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

/** Read-only: opening the report never assigns homes or changes the economy. */
export function villageReportData(player: PlayerLike, town: BuildingEntity) {
  const buildings = (player.buildings ?? []).filter(
    building => !building.isDead && !building.isDestroyed && getBaseTerritory(building, [player])?.center === town
  )
  const residents = getHouseholdUnits(player).filter(unit => {
    if (unit.isDead || unit.isDestroyed || unit.type === 'Hero' || unit.controlMode === 'hero') return false
    const home = player.buildings?.find(building => building.label === unit.homeHouseLabel)
    return householdTown(player, unit.villageHome ?? home ?? unit) === town
  })
  const houses = buildings.filter(building => building.type === 'House' && building.isBuilt)
  const vacant = getVacantHomes(player, town).reduce(
    (sum, house) => sum + getFreeHouseBedLabels(player, house).length,
    0
  )
  const occupied = houses.filter(house => getHouseResidents(player, house).length > 0).length
  const capacity = getPopulationCapacityFromBuildings(buildings, player)
  const plan = planVillagerArrivals(player).find(plan =>
    plan.centers.some(center => center === town || center.label === town.label)
  )
  const arrival = !vacant
    ? 'villageReportNoHousing'
    : isStaticSettlement(player)
      ? 'villageReportNoArrivals'
      : (plan?.reason ?? 'villageReportNoArrivals')
  // Keep full entity references so ownership checks and unloaded interior stocks still work.
  const localPlayer = { ...player, buildings }
  return { buildings, residents, houses: houses.length, vacant, occupied, capacity, arrival, localPlayer }
}
