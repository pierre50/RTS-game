import { t } from '../lib/lang'
import { isValidCondition } from '../lib'
import { getMissingResourceNames, isTraineeTrainingType } from '../lib/buildings/buildingTraining'
import { formatUnitTrainingDuration, getUnitTrainingDurationDays } from '../lib/training/unitTrainingDuration'
import type { ResourceAmount } from '../types/common'
import type { BuildingConfig, TechnologyConfig, UnitConfig } from '../types/config'
import type { BuildingEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'
import type { TooltipContent } from '../types/ui'
import type { Condition } from '../lib/combat'

const AGE_REQUIREMENT_KEYS: Record<number, string> = {
  1: 'ToolAge',
  2: 'BronzeAge',
  3: 'IronAge',
}

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

function getConditionValueLabel(value: Condition['value']): string {
  if (Array.isArray(value)) return value.map(item => getConditionValueLabel(item)).join(', ')
  if (typeof value === 'string') return t(value)
  return String(value)
}

function getAgeRequirementLabel(value: Condition['value']): string {
  const age = Number(value)
  const key = AGE_REQUIREMENT_KEYS[age]
  return key ? t(key) : String(value)
}

function getTechnologyRequirementText(condition: Condition, player: PlayerLike): string | null {
  try {
    if (isValidCondition(condition, player)) return null
  } catch {
    // Unknown future condition keys should explain the lock instead of breaking the tooltip.
  }

  if (condition.key === 'age') {
    return t('tooltipRequiresAge', { age: getAgeRequirementLabel(condition.value) })
  }

  if (condition.key === 'technologies') {
    const technology = getConditionValueLabel(condition.value)
    return condition.op === 'notincludes'
      ? t('tooltipBlockedByTechnology', { technology })
      : t('tooltipRequiresTechnology', { technology })
  }

  if (condition.key === 'discoveredEquipment' && condition.value === 'bow') {
    return t('tooltipRequiresAnyBow')
  }

  if (condition.key === 'hasBuilt' || condition.key === 'buildings') {
    return t('tooltipRequiresBuilding', { building: getConditionValueLabel(condition.value) })
  }

  return t('tooltipRequiresCondition', {
    condition: `${condition.key} ${condition.op} ${getConditionValueLabel(condition.value)}`,
  })
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
      options.commandBlocked ? t('requiresChief') : null,
      options.isLimitReached ? t('buildingLimitReached') : null,
    ],
  }
}

export function getTechnologyTooltip(
  type: string,
  config: TechnologyConfig,
  player: PlayerLike,
  commandBlocked: boolean
): TooltipContent {
  const unmetRequirements = (config.conditions || [])
    .map(condition => getTechnologyRequirementText(condition, player))
    .filter((requirement): requirement is string => Boolean(requirement))
  return {
    title: t(type),
    description: t(`${type}Description`),
    meta: [t('tooltipCost', { cost: formatActionCost(config.cost) }), ...(commandBlocked ? [t('requiresChief')] : []), ...unmetRequirements],
  }
}

export function getUnitTooltip(
  type: string,
  config: UnitConfig,
  cost: ResourceAmount,
  commandBlocked: boolean,
  building?: BuildingEntity
): TooltipContent {
  const chiefBlocked = commandBlocked && (type === 'Villager' || Boolean(building && isTraineeTrainingType(building, type)))
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
