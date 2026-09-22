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
    building.type === BUILDING_TYPES.forge
      ? JSON.stringify([
          manager.menu.context.player.age,
          building.isBuilt,
          getPlayerResourceTotals(manager.menu.context.player, { hero: manager.menu.context.controls.heroUnit }),
        ])
      : '',
    building.type === BUILDING_TYPES.market
      ? String(canHeroTradeAtMarket(building, manager.menu.context.controls.heroUnit))
      : '',
    building.queue?.join(',') || '',
    building.trainingQueue
      ?.map(entry => `${entry.type}:${entry.trainingStartedDay ?? ''}:${entry.trainingCompleteDay ?? ''}`)
      .join(',') || '',
    level.map(item => item.id || '').join(','),
    level.map(item => (item.hide?.() ? '1' : '0')).join(','),
    getHeroBuildingInteractiveInventorySignature(building, manager.menu.context.controls.heroUnit),
  ].join('|')
}
