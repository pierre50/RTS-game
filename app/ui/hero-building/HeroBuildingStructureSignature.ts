import { settlementDepotPolicy } from '../../lib/economy/collectiveTasks'
import { BUILDING_TYPES } from '../../constants'
import { getPlayerResourceTotals } from '../../lib/resources/playerResourceTotals'
import type { HeroBuildingMenuManager } from '../HeroBuildingMenuManager'
import { getHeroBuildingInteractiveInventorySignature } from './HeroBuildingInventorySignature'
import { canHeroTradeAtMarket } from './HeroMarketBody'
export function heroBuildingStructureSignature(manager: HeroBuildingMenuManager): string {
  const building = manager.building
  if (!building) return ''
  const level = manager.stack[manager.stack.length - 1] || []
  return [
    building.buildingLevel,
    building.isBuilt,
    building.buildingUpgrade ? JSON.stringify(building.buildingUpgrade) : '',
    JSON.stringify(building.constructionMaterials),
    ['StoragePit', 'Granary'].includes(building.type) && building.owner
      ? JSON.stringify(settlementDepotPolicy(building.owner, building))
      : '',
    [BUILDING_TYPES.forge, BUILDING_TYPES.fireCamp, BUILDING_TYPES.townCenter].includes(building.type)
      ? JSON.stringify([
          manager.menu.context.player.forgeUpgrades,
          building.owner?.label,
          manager.menu.context.controls.heroUnit?.isChief,
          building.isBuilt,
          getPlayerResourceTotals(manager.menu.context.player, { includeHero: false }),
          getPlayerResourceTotals(manager.menu.context.player, { hero: manager.menu.context.controls.heroUnit }),
        ])
      : '',
    building.type === BUILDING_TYPES.market
      ? String(canHeroTradeAtMarket(building, manager.menu.context.controls.heroUnit))
      : '',
    building.queue?.join(',') || '',
    JSON.stringify(building.trainingRequests ?? []),
    building.trainingQueue
      ?.map(
        entry =>
          `${entry.trainee.label}:${entry.type}:${entry.trainingStartedDay ?? ''}:${entry.trainingCompleteDay ?? ''}`
      )
      .join(',') || '',
    level.map(item => item.id || '').join(','),
    level.map(item => (item.hide?.() ? '1' : '0')).join(','),
    getHeroBuildingInteractiveInventorySignature(building, manager.menu.context.controls.heroUnit),
  ].join('|')
}
