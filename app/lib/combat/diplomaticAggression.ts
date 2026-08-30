import { FACTION_SCORE } from './factions'
import { t } from '../lang'
import type { GameContextLike } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

type DiplomaticAggressor = {
  context?: GameContextLike | null
  owner?: PlayerLike | null
}

type DiplomaticAggressionRelation = 'unchanged' | 'hostile' | 'neutral'

export type DiplomaticAggressionResult = {
  changed: boolean
  hostileNow: boolean
  relation: DiplomaticAggressionRelation
  targetName?: string
}

const NO_DIPLOMATIC_CHANGE: DiplomaticAggressionResult = {
  changed: false,
  hostileNow: false,
  relation: 'unchanged',
}

function getFactionRelationDelta(player: PlayerLike, context?: GameContextLike | null): number | null {
  const factionId = player.factionId
  if (!factionId) return null
  const faction = context?.getCampaignFactions?.()?.[factionId]
  if (!faction || faction.relationState === 'hostile') return null
  const targetScore =
    faction.relationState === 'neutral' || faction.relationState === 'wary'
      ? FACTION_SCORE.hostile
      : FACTION_SCORE.neutral
  return targetScore - faction.relationScore
}

function getDiplomaticTargetName(player: PlayerLike, context?: GameContextLike | null): string {
  const faction = player.factionId ? context?.getCampaignFactions?.()?.[player.factionId] : null
  return faction?.name || player.name || player.label
}

function notifyDiplomaticAggression(
  source: DiplomaticAggressor | null | undefined,
  result: DiplomaticAggressionResult
): void {
  if (!result.changed || !source?.owner?.isPlayed || !result.targetName) return
  const key = result.hostileNow ? 'diplomaticAggressionWar' : 'diplomaticAggressionNeutral'
  source.context?.menu?.showMessage(t(key, { name: result.targetName }), 'warning')
}

export function canTriggerDiplomaticAggression(
  source: DiplomaticAggressor | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  const sourceOwner = source?.owner
  const targetOwner = target?.owner
  if (!sourceOwner?.isPlayed || !targetOwner || sourceOwner.label === targetOwner.label) return false
  if (sourceOwner.isEnemy?.(targetOwner)) return false
  if (getFactionRelationDelta(targetOwner, source?.context) != null) return true
  return (
    targetOwner.diplomacy === 'neutral' ||
    sourceOwner.diplomacy === 'neutral' ||
    (sourceOwner.team != null && sourceOwner.team === targetOwner.team)
  )
}

export function canTargetBeAggressed(
  source: DiplomaticAggressor | null | undefined,
  target: RuntimeEntity | null | undefined
): boolean {
  const sourceOwner = source?.owner
  const targetOwner = target?.owner
  return Boolean(
    targetOwner &&
      sourceOwner &&
      sourceOwner.label !== targetOwner.label &&
      (sourceOwner.isEnemy?.(targetOwner) || canTriggerDiplomaticAggression(source, target))
  )
}

export function applyDiplomaticAggression(
  source: DiplomaticAggressor | null | undefined,
  target: RuntimeEntity | null | undefined,
  options: { notify?: boolean; reason?: string } = {}
): DiplomaticAggressionResult {
  if (!canTriggerDiplomaticAggression(source, target)) return NO_DIPLOMATIC_CHANGE
  const sourceOwner = source?.owner
  const targetOwner = target?.owner
  if (!sourceOwner || !targetOwner) return NO_DIPLOMATIC_CHANGE

  const targetName = getDiplomaticTargetName(targetOwner, source?.context)
  const complete = (result: Omit<DiplomaticAggressionResult, 'targetName'>): DiplomaticAggressionResult => {
    const withName = { ...result, targetName }
    if (options.notify !== false) notifyDiplomaticAggression(source, withName)
    return withName
  }

  const factionDelta = getFactionRelationDelta(targetOwner, source?.context)
  if (factionDelta != null) {
    source.context?.changeFactionRelation?.(targetOwner.factionId!, factionDelta, options.reason ?? 'attack')
    const hostileNow = Boolean(sourceOwner.isEnemy?.(targetOwner))
    return complete({ changed: true, hostileNow, relation: hostileNow ? 'hostile' : 'neutral' })
  }

  if (targetOwner.diplomacy === 'neutral' || sourceOwner.diplomacy === 'neutral') {
    targetOwner.diplomacy = null
    if (sourceOwner.diplomacy === 'neutral') sourceOwner.diplomacy = null
    const hostileNow = Boolean(sourceOwner.isEnemy?.(targetOwner))
    return complete({ changed: hostileNow, hostileNow, relation: hostileNow ? 'hostile' : 'unchanged' })
  }

  if (sourceOwner.team != null && sourceOwner.team === targetOwner.team) {
    targetOwner.team = null
    targetOwner.diplomacy = 'neutral'
    return complete({ changed: true, hostileNow: false, relation: 'neutral' })
  }

  return NO_DIPLOMATIC_CHANGE
}
