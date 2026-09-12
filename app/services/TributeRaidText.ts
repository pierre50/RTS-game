import { t } from '../lib/lang'
import type { ResourceAmount } from '../types/common'
import type { FactionSave } from '../types/save'
import type { TributeRaid } from './tribute/TributeRaidRules'

function formatCost(cost: ResourceAmount): string {
  return Object.entries(cost)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resource, amount]) => `${amount} ${t(resource)}`)
    .join(', ')
}

function getRaidFactionDisplayName(faction: FactionSave | null | undefined): string {
  const rawName = faction?.name?.trim()
  if (rawName && rawName.toLowerCase() !== 'bandits') return rawName
  return faction?.civilization ? t('factionCivilizationDisplayName', { civ: t(faction.civilization) }) : t('unknownFaction')
}

export function getIncomingRaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionRaidIncoming', { name: getRaidFactionDisplayName(raid.faction) })
  return t('banditRaidIncoming')
}

export function getTributeTitle(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionTributeTitle', { name: getRaidFactionDisplayName(raid.faction) })
  return t('banditTributeTitle')
}

export function getTributeDemand(raid: TributeRaid): string {
  if (raid.kind === 'faction') {
    return t('factionTributeDemand', { cost: formatCost(raid.tribute), name: getRaidFactionDisplayName(raid.faction) })
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
  if (raid.kind === 'faction') return t('factionTributePaid', { name: getRaidFactionDisplayName(raid.faction) })
  return t('banditTributePaid')
}

export function getLocalTributeTargetMessage(raid: TributeRaid): string {
  return t('banditLocalTributePaid', { name: raid.target.owner?.name ?? t('computer') })
}

export function getLocalTributeRefusedMessage(raid: TributeRaid): string {
  return t('banditLocalTributeRefused', { name: raid.target.owner?.name ?? t('computer') })
}

export function getHostileRaidMessage(raid: TributeRaid): string {
  if (raid.kind === 'faction') return t('factionRaidHostile', { name: getRaidFactionDisplayName(raid.faction) })
  return t('banditRaidHostile')
}
