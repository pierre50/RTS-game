import { BUILDING_TYPES, FOOD_RESOURCE_NAMES, RESOURCE_STORAGE_NAMES } from '../../constants'
import { factionIdForCivilization } from '../campaign/playerRoster'
import { getStorageCapacity } from '../resources/storagePolicy'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { RegionEconomySave } from '../../types/save'

type RegionAlertType = 'populationCapped' | 'storageFull' | 'workersIdle'

type RegionSummary = RegionEconomySave['summaries'][string]

const FOOD_RESOURCE_SET = new Set<string>(FOOD_RESOURCE_NAMES)
const NON_FOOD_RESOURCE_NAMES = RESOURCE_STORAGE_NAMES.filter(resource => !FOOD_RESOURCE_SET.has(resource))

function sumResources(stocks: ResourceAmount, keys: readonly string[]): number {
  return keys.reduce((sum, key) => sum + Math.max(0, Math.floor(stocks[key as keyof ResourceAmount] ?? 0)), 0)
}

// Only dedicated depots provide capacity for new village deliveries.
function storageCapacityFor(buildings: Record<string, number>, dedicatedType: string): number {
  return (buildings[dedicatedType] ?? 0) * getStorageCapacity(dedicatedType)
}

function getRegionAlerts(summary: RegionSummary): RegionAlertType[] {
  const alerts: RegionAlertType[] = []
  if (summary.populationMax > 0 && summary.population >= summary.populationMax) alerts.push('populationCapped')

  const foodStock = sumResources(summary.stocks, FOOD_RESOURCE_NAMES)

  const foodCapacity = storageCapacityFor(summary.buildings, BUILDING_TYPES.granary)
  const nonFoodCapacity = storageCapacityFor(summary.buildings, BUILDING_TYPES.storagePit)
  const nonFoodStock = sumResources(summary.stocks, NON_FOOD_RESOURCE_NAMES)
  if ((foodCapacity > 0 && foodStock >= foodCapacity) || (nonFoodCapacity > 0 && nonFoodStock >= nonFoodCapacity))
    alerts.push('storageFull')

  if (summary.idleWorkers > 0) alerts.push('workersIdle')

  return alerts
}

export type ActiveRegionAlert = { regionId: string; type: RegionAlertType }

// The live player's own `.factionId` is often unset — every screen that needs it falls back to
// deriving it from `.civ` the same way AI factions get theirs.
function getOwnFactionId(context: GameContextLike): string | null {
  const player = context.player
  return player?.factionId || (player?.civ ? factionIdForCivilization(player.civ) : null)
}

/** Every alert currently active across the player's own colonies (current map and offline). */
export function getActiveColonyAlerts(context: GameContextLike): ActiveRegionAlert[] {
  const economy = context.getCampaignEconomy?.()
  const ownFactionId = getOwnFactionId(context)
  if (!economy || !ownFactionId) return []
  const alerts: ActiveRegionAlert[] = []
  for (const region of Object.values(economy.regions)) {
    const summary = region.summaries[ownFactionId]
    if (!summary) continue
    for (const type of getRegionAlerts(summary)) alerts.push({ regionId: region.regionId, type })
  }
  return alerts
}
