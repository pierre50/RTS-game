import { t } from '../lib/lang'
import type { ResourceAmount } from '../types/common'
import type { TributeRaid } from './TributeRaidRules'

function formatCost(cost: ResourceAmount): string {
  return Object.entries(cost)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resource, amount]) => `${amount} ${t(resource)}`)
    .join(', ')
}

export function getIncomingRaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionRaidIncoming', { name: raid.faction?.name ?? t('computer') })
  return t('banditRaidIncoming')
}

export function getTributeTitle(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributeTitle', { name: raid.faction?.name ?? t('computer') })
  return t('banditTributeTitle')
}

export function getTributeDemand(raid: TributeRaid): string {
  if (raid.kind === 'faction') {
    return t('factionTributeDemand', { cost: formatCost(raid.tribute), name: raid.faction?.name ?? t('computer') })
  }
  return t('banditTributeDemand', { cost: formatCost(raid.tribute) })
}

export function getTributePaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributePaid', { name: raid.faction?.name ?? t('computer') })
  return t('banditTributePaid')
}

export function getHostileRaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionRaidHostile', { name: raid.faction?.name ?? t('computer') })
  return t('banditRaidHostile')
}
