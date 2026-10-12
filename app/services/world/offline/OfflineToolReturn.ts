import { npcNeedsSupplies } from '../../../lib/units/supplies/npcSupplyStatus'
import { supplyTownArrows } from '../../../lib/units/supplies/townArrowSupply'
import { supplyTownWeapons } from '../../../lib/units/supplies/townToolSupply'
import { getBaseTerritory } from '../../../lib/territory/baseTerritory'
import { supplyTownTool } from '../../../lib/units/supplies/townToolSupply'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'
import type { UnitConfig } from '../../../types/config'
import { distance, entityKey, isLiving, type OfflineWorldSpatial } from './OfflineWorldSpatial'
import { stopOfflineTask, travelMs } from '../work/OfflineWorkResources'

/** Returning consumes simulated travel time; the saved budget survives short catch-up windows. */
export function returnOfflineWorkerForTool(
  player: SavePlayerState,
  unit: SaveEntityState,
  milliseconds: number,
  config: UnitConfig,
  spatial: OfflineWorldSpatial
): void {
  if (!npcNeedsSupplies(unit)) return
  const home = unit.villageHome ?? unit.collectiveHome
  const homeTown = home && getBaseTerritory(home, [player])?.center
  const anchors = (player.buildings ?? [])
    .filter(
      building =>
        ['TownCenter', 'FireCamp'].includes(building.type) &&
        building.isBuilt &&
        isLiving(building) &&
        (building.spaceId ?? 'outside') === (unit.spaceId ?? 'outside') &&
        (!homeTown || getBaseTerritory(building, [player])?.center === homeTown) &&
        spatial.reachable(unit, building)
    )
    .sort(
      (a, b) => Number(b.type === 'FireCamp') - Number(a.type === 'FireCamp') || distance(unit, a) - distance(unit, b)
    )
  const anchor = anchors[0]
  if (!anchor) return
  if (distance(unit, anchor) <= 6) {
    delete unit.offlineWork
    supplyTownTool(unit, player)
    supplyTownWeapons(unit, player)
    supplyTownArrows(unit, player, { hunting: unit.work === 'hunter' })
    return
  }
  const point = spatial.findNear(anchor, 6, unit)
  if (!point) return
  const target = `tool-return:${entityKey(anchor)}`
  const budget = milliseconds + (unit.offlineWork?.target === target ? unit.offlineWork.milliseconds : 0)
  if (budget < travelMs(unit, point, config)) {
    unit.offlineWork = { target, milliseconds: budget }
    return
  }
  spatial.move(unit, point)
  delete unit.offlineWork
  stopOfflineTask(unit)
  supplyTownTool(unit, player)
  supplyTownWeapons(unit, player)
  supplyTownArrows(unit, player, { hunting: unit.work === 'hunter' })
}
