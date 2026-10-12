import { calculateVillagerArrivals } from '../buildings/townCenter'
import { getBuildingLevel } from '../buildings/buildingLevel'
import { TOWN_CENTER_SHARED_ARRIVAL_RADIUS } from '../../config/townCenter'
import { DAILY_CONSUMPTION_PER_VILLAGER, VILLAGER_ARRIVAL_CONFIG } from '../../constants/consumption'
import {
  getHouseholdUnits,
  getVacantHomes,
  getFreeHouseBedLabels,
  householdTown,
  type HouseholdOwner,
  type HouseholdBuilding,
} from '../housing/households'
import { getPlayerResourceTotals } from '../resources/playerResourceTotals'
import { sameMapSpace } from '../mapSpaces'

type Center = HouseholdBuilding & { buildingLevel?: number; assetLevel?: unknown }
type Owner = HouseholdOwner & { population?: number; populationMax?: number }
export { calculateVillagerArrivals } from '../buildings/townCenter'

/** One allowance for nearby centers, using only local residents, homes and communal provisions. */
export function planVillagerArrivals(owner: Owner) {
  const centers = (owner.buildings ?? []).filter(
    b => b.type === 'TownCenter' && b.isBuilt && !b.isDead && !b.isDestroyed
  ) as Center[]
  const pending = [...centers]
  const plans = []
  let freeHousing = Math.max(0, (owner.populationMax ?? 0) - (owner.population ?? 0))
  while (pending.length) {
    const first = pending.shift()!
    const group = [first]
    for (let member = 0; member < group.length; member++) {
      const anchor = group[member]!
      for (let i = pending.length - 1; i >= 0; i--) {
        const other = pending[i]!
        if (
          sameMapSpace(anchor, other) &&
          Math.hypot((anchor.i ?? 0) - (other.i ?? 0), (anchor.j ?? 0) - (other.j ?? 0)) <=
            TOWN_CENTER_SHARED_ARRIVAL_RADIUS
        )
          group.push(...pending.splice(i, 1))
      }
    }
    const inGroup = (point: Parameters<typeof householdTown>[1]) => {
      const town = householdTown(owner, point)
      return group.some(center => center === town || (center.label && center.label === town?.label))
    }
    const allUnits = getHouseholdUnits(owner)
    const units = allUnits.filter(
      unit =>
        !unit.isDead && !unit.isDestroyed && unit.type !== 'Hero' && unit.controlMode !== 'hero' && !unit.followingHero
    )
    const population = allUnits.length
      ? units.filter(unit => {
          const home = owner.buildings?.find(b => b.label === unit.homeHouseLabel)
          return inGroup(unit.villageHome ?? home ?? unit)
        }).length
      : centers.length === group.length
        ? (owner.population ?? 0)
        : 0
    const level = Math.max(...group.map(getBuildingLevel))
    const homes = group.flatMap(center =>
      getVacantHomes(owner, center).flatMap(home =>
        getFreeHouseBedLabels(owner, home).map(bed => ({ center, home, bed }))
      )
    )
    const food = group.reduce(
      (sum, center) =>
        sum +
        getPlayerResourceTotals(owner as Parameters<typeof getPlayerResourceTotals>[0], {
          includeHero: false,
          settlement: { i: center.i ?? 0, j: center.j ?? 0, spaceId: center.spaceId ?? 'outside' },
        }).food,
      0
    )
    const daily = DAILY_CONSUMPTION_PER_VILLAGER.food ?? 0
    const foodCapacity =
      daily > 0
        ? Math.max(
            0,
            Math.floor(
              (food - population * daily * VILLAGER_ARRIVAL_CONFIG.currentPopulationReserveDays) /
                (daily * VILLAGER_ARRIVAL_CONFIG.newVillagerReserveDays)
            )
          )
        : Infinity
    const demand = calculateVillagerArrivals({
      population,
      populationMax: population + freeHousing,
      buildingLevel: level,
    })
    const count = Math.min(demand, homes.length, foodCapacity)
    const reason =
      population <= 0
        ? 'villageReportNoArrivals'
        : !homes.length
          ? 'villageReportNoHousing'
          : freeHousing <= 0
            ? 'villageReportCapacityFull'
            : foodCapacity <= 0
              ? 'villageReportNoFood'
              : 'villageReportArrivalsReady'
    plans.push({ centers: group, homes, population, level, food, count, reason })
    freeHousing -= count
  }
  return plans
}
