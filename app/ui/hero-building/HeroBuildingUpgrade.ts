import { getBuildingTrainingLoad } from '../../lib/buildings/buildingTraining'
import { getBuildingLevel, getBuildingConfigForLevel } from '../../lib/buildings/buildingLevel'
import { nextBuildingUpgrade } from '../../lib/buildings/buildingUpgrade'
import { canStartBuildingUpgrade, startBuildingUpgrade } from '../../classes/building/BuildingUpgrade'
import { remainingConstructionMaterials, constructionProgressPercentage } from '../../lib/economy/constructionMaterials'
import { renderBuildingAvatar } from '../../lib/avatar'
import { t } from '../../lib/lang'
import type { BuildingEntity } from '../../types/entities'
import type { MenuHost } from '../MenuHost'
import { inventoryDeliveryMetaParts } from '../inventory/InventoryCostMeta'
import { createInventoryActionRow } from '../inventory/InventoryActionRow'

export function createHeroBuildingUpgrade(
  menu: MenuHost,
  building: BuildingEntity,
  refresh: () => void
): HTMLElement | null {
  if (building.owner !== menu.context.player || !building.isBuilt || building.indestructible) return null
  const config = building.owner.config.buildings[building.type]
  if (!Object.keys(config?.levelStats ?? {}).some(level => Number(level) > 0)) return null
  const current = getBuildingLevel(building)
  const upgrade = building.buildingUpgrade
  const next = upgrade?.targetLevel ?? nextBuildingUpgrade(config, current)
  const maximum = next == null
  const targetConfig = getBuildingConfigForLevel(config, next ?? current)
  const progress = upgrade ? Math.min(99, Math.floor(constructionProgressPercentage(building))) : 0
  const disabled = Boolean(upgrade) || maximum || !canStartBuildingUpgrade(building, menu.context.controls.heroUnit)
  const title = t(upgrade ? 'buildingUpgradeProgress' : maximum ? 'buildingUpgradeMaximum' : 'buildingUpgradeTitle', {
    level: (next ?? current) + 1,
    progress,
  })
  const trainingBlocked = getBuildingTrainingLoad(building) > 0 || Boolean(building.trainingRequests?.length)
  const benefits = [
    t('buildingUpgradeHealth', { before: building.totalHitPoints ?? 0, after: targetConfig.totalHitPoints ?? 0 }),
  ]
  if (building.type === 'House') benefits.push(t('buildingUpgradeBedsPreserved'))
  const { element, icon } = createInventoryActionRow(menu, {
    id: 'building-upgrade',
    className: 'inventory-construction-row building-upgrade-row',
    title,
    disabled,
    description: maximum
      ? ''
      : `${benefits.join(' · ')}. ${t(trainingBlocked ? 'buildingUpgradeTrainingBlocked' : 'buildingUpgradeDescription')}`,
    metaParts: maximum
      ? []
      : inventoryDeliveryMetaParts(
          upgrade ? remainingConstructionMaterials(building) : (targetConfig.cost ?? {}),
          Boolean(upgrade)
        ),
    trailingAction: {
      label: t(upgrade ? 'buildingUpgradeInProgress' : maximum ? 'forgeUpgradeMax' : 'forgeUpgradeAction'),
      disabled,
      onClick: () => {
        if (startBuildingUpgrade(building, menu.context.controls.heroUnit)) refresh()
      },
    },
  })
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 120
  const image = document.createElement('img')
  image.className = 'img'
  image.alt = ''
  if (
    renderBuildingAvatar(
      menu.context.app,
      building.assetType || building.type,
      { ...building.owner, civ: building.assetCiv || building.owner.civ, level: next ?? current },
      canvas
    )
  )
    image.src = canvas.toDataURL()
  icon.appendChild(image)
  return element
}
