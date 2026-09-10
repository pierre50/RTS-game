import { t } from '../lib/lang'
import { getMissingResourceNames, isTraineeTrainingType } from '../lib/buildings/buildingTraining'
import { formatUnitTrainingDuration, getUnitTrainingDurationDays } from '../lib/training/unitTrainingDuration'
import type { ResourceAmount } from '../types/common'
import type { BuildingConfig, UnitConfig } from '../types/config'
import type { BuildingEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { TooltipContent } from '../types/ui'

export function formatActionCost(cost?: ResourceAmount): string {
  return Object.entries(cost || {})
    .map(([resource, amount]) => `${amount} ${t(resource)}`)
    .join(', ')
}

export function getMissingResourceMessage(player: PlayerLike, cost: ResourceAmount): string {
  const resource = getMissingResourceNames(player, cost)
    .map(key => t(key))
    .join(', ')
  return t('needMore', { resource })
}

export function getBuildingTooltip(options: {
  commandBlocked: boolean
  config: BuildingConfig
  isLimitReached: boolean
  type: string
}): TooltipContent {
  return {
    title: t(options.type),
    description: t(`${options.type}Description`),
    meta: [
      t('tooltipCost', { cost: formatActionCost(options.config.cost) }),
      options.config.totalHitPoints != null ? t('tooltipBuildingHP', { value: options.config.totalHitPoints }) : null,
      options.commandBlocked ? t('requiresChief') : null,
      options.isLimitReached ? t('buildingLimitReached') : null,
    ],
  }
}

export function getUnitTooltip(
  type: string,
  config: UnitConfig,
  cost: ResourceAmount,
  commandBlocked: boolean,
  building?: BuildingEntity
): TooltipContent {
  const chiefBlocked =
    commandBlocked && (type === 'Villager' || Boolean(building && isTraineeTrainingType(building, type)))
  return {
    title: t(type),
    description: t(`${type}Description`),
    meta: [
      t('tooltipCost', { cost: formatActionCost(cost) }),
      t('tooltipTrainTime', { time: formatUnitTrainingDuration(getUnitTrainingDurationDays(config)) }),
      chiefBlocked ? t('requiresChief') : null,
    ],
  }
}
