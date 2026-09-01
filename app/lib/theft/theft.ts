import { applyDiplomaticAggression, type DiplomaticAggressionResult } from '../combat/diplomaticAggression'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export const THEFT_SUBJECT_TYPES = {
  chest: 'chest',
  horse: 'horse',
} as const

type TheftSubjectType = (typeof THEFT_SUBJECT_TYPES)[keyof typeof THEFT_SUBJECT_TYPES]

type TheftActor = Pick<UnitEntity, 'context' | 'owner'> | null | undefined

type TheftOwnedTarget = Pick<RuntimeEntity, 'owner'> & Partial<RuntimeEntity>

export type TheftEvent = {
  actor: TheftActor
  context?: GameContextLike | null
  owner?: PlayerLike | null
  subject: TheftSubjectType
  target?: TheftOwnedTarget | null
  visible?: boolean
}

export type TheftResult = {
  diplomatic: DiplomaticAggressionResult
  stolen: boolean
  subject: TheftSubjectType
}

const THEFT_REASONS: Record<TheftSubjectType, string> = {
  chest: 'theft:chest',
  horse: 'theft:horse',
}

const NO_THEFT_DIPLOMATIC_CHANGE: DiplomaticAggressionResult = {
  changed: false,
  hostileNow: false,
  relation: 'unchanged',
}

function getTheftOwner(event: TheftEvent): PlayerLike | null {
  return event.owner ?? event.target?.owner ?? null
}

function isTheft(event: TheftEvent): boolean {
  const actorOwner = event.actor?.owner
  const owner = getTheftOwner(event)
  if (!actorOwner?.isPlayed || !owner) return false
  return actorOwner.label !== owner.label
}

export function applyTheftConsequences(event: TheftEvent): TheftResult {
  const owner = getTheftOwner(event)
  const target = event.target ?? ({ owner } as TheftOwnedTarget)
  const stolen = isTheft({ ...event, owner, target })
  const diplomatic = stolen
    ? applyDiplomaticAggression(
        { context: event.context ?? event.actor?.context ?? null, owner: event.actor?.owner ?? null },
        target as RuntimeEntity,
        { reason: THEFT_REASONS[event.subject] }
      )
    : NO_THEFT_DIPLOMATIC_CHANGE
  return {
    diplomatic,
    stolen,
    subject: event.subject,
  }
}
