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

export function getTributePayLabel(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributePay')
  return t('banditTributePay')
}

export function getTributeRefuseLabel(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributeRefuse')
  return t('banditTributeRefuse')
}

export function getTributeCannotPayLabel(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributeCannotPay')
  return t('banditTributeCannotPay')
}

export function getTributePaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributePaid', { name: raid.faction?.name ?? t('computer') })
  return t('banditTributePaid')
}

export function getLocalTributeTargetMessage(raid: TributeRaid): string {
  return t('banditLocalTributePaid', { name: raid.target.owner?.name ?? t('computer') })
}

export function getLocalTributeRefusedMessage(raid: TributeRaid): string {
  return t('banditLocalTributeRefused', { name: raid.target.owner?.name ?? t('computer') })
}

export function getHostileRaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionRaidHostile', { name: raid.faction?.name ?? t('computer') })
  return t('banditRaidHostile')
}
