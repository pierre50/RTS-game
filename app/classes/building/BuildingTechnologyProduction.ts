import { Assets } from 'pixi.js'
import { LABEL_TYPES } from '../../constants'
import { canAfford, changeSpriteColorDirectly, getBuildingAsset, getTexture, payCost, refundCost } from '../../lib'
import { hasLivingChief, playerNeedsChiefForCommand } from '../../lib/chief'
import { t } from '../../lib/lang'
import type { ConfigValue } from '../../types/config'
import type { BuildingControllerHost } from './BuildingTypes'

type DynamicBuildingState = BuildingControllerHost & Record<string, ConfigValue | object | undefined>

export function refreshOpenBuildingMenu(building: BuildingControllerHost): void {
  const menu = building.context.menu
  if (menu.getHeroBuildingMenuTarget?.() === building) {
    menu.refreshHeroBuildingMenu?.()
  }
}

export function cancelBuildingTechnology(building: BuildingControllerHost): boolean {
  const { menu } = building.context
  if (!building.technology) return false

  building.stopInterval()
  refundCost(building.owner, building.technology.config.cost)
  building.technology = null
  building.loading = null
  if (building.owner.isPlayed) {
    menu.updateTopbar()
    refreshOpenBuildingMenu(building)
  }
  return true
}

export function upgradeBuilding(building: BuildingControllerHost, type: string): void {
  const data = building.owner.config.buildings[type]
  const nextTotalHitPoints = Number(data.totalHitPoints) || building.totalHitPoints
  building.type = type
  building.hitPoints = nextTotalHitPoints - (building.totalHitPoints - building.hitPoints)
  for (const [key, value] of Object.entries(data)) {
    ;(building as DynamicBuildingState)[key] = value
  }
  const assets = getBuildingAsset(building.type, building.owner, Assets)
  building.textureName = assets.images!.final as string
  building.sprite.texture = getTexture(assets.images!.final as string, Assets)
  building.sprite.anchor.set(building.sprite.texture.defaultAnchor!.x, building.sprite.texture.defaultAnchor!.y)
  const color = building.getChildByLabel(LABEL_TYPES.color)
  color?.destroy()
  changeSpriteColorDirectly(building.sprite, building.owner.color ?? '')
  building.updateShadow()
}

export function buyBuildingTechnology(
  building: BuildingControllerHost,
  type: string,
  alreadyPaid?: boolean
): boolean {
  const {
    context: { menu },
  } = building
  let success = false
  const config = building.owner.techs[type]
  if (playerNeedsChiefForCommand(building.owner) && !hasLivingChief(building.owner)) {
    if (building.owner.isPlayed) menu.showMessage(t('requiresChief'), 'warning')
    return false
  }
  const hadQueuedTechnology = building.technology?.type === type
  if (
    building.isBuilt &&
    !building.isDead &&
    !building.isDestroyed &&
    !building.owner.technologies.includes(type) &&
    (alreadyPaid || canAfford(building.owner, config.cost))
  ) {
    !alreadyPaid && payCost(building.owner, config.cost)
    success = true
    if (hadQueuedTechnology) building.loading = null
    building.technology = null
    building.owner.unlockTechnology?.(type)
    if (building.owner.isPlayed) {
      menu.updateTopbar()
      refreshOpenBuildingMenu(building)
    }
  }
  return success
}
