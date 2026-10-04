import { createHeroDepotReservesBody } from './HeroDepotReservesBody'
import { createHeroTrainingBody } from './HeroTrainingBody'
import { createHeroBuildingContainerBody } from './HeroBuildingContainerBody'
import { HeroCampfireBody } from './HeroCampfireBody'
import { HeroForgeBody } from './HeroForgeBody'
import { createHeroMarketBody } from './HeroMarketBody'
import { BUILDING_TYPES } from '../../constants'
import type { BuildingEntity } from '../../types/entities'
import type { HeroBuildingMenuManager } from '../HeroBuildingMenuManager'

export function renderHeroBuildingBody(host: HeroBuildingMenuManager, building: BuildingEntity): boolean {
  const reserves = createHeroDepotReservesBody(building, host.menu, () => host.render())
  if (reserves) {
    host.transferPanel = null
    host.body.appendChild(reserves)
    return true
  }
  const training = createHeroTrainingBody(building, host.menu, () => host.refresh())
  if (training) {
    host.transferPanel = null
    host.body.appendChild(training)
    return true
  }
  if (building.type === BUILDING_TYPES.fireCamp && building.isBuilt) {
    host.transferPanel = null
    host.body.appendChild(new HeroCampfireBody(host.menu, building).craftPanel)
    return false
  }
  if (building.type === BUILDING_TYPES.forge && building.isBuilt) {
    host.transferPanel = null
    host.body.appendChild(new HeroForgeBody(host.menu, building).craftPanel)
    return true
  }

  if (building.type === BUILDING_TYPES.market) {
    if (!host.marketOpen) return false
    const marketBody = createHeroMarketBody(building, host.menu, () => {
      host.structureSignature = host.getStructureSignature()
      host.render()
    })
    if (!marketBody) return false
    host.transferPanel = null
    host.body.appendChild(marketBody)
    return true
  }

  host.transferPanel = createHeroBuildingContainerBody(building, host.menu, () => {
    host.structureSignature = host.getStructureSignature()
    host.renderInfo()
  })
  if (!host.transferPanel) return false
  host.body.appendChild(host.transferPanel.element)
  return true
}
