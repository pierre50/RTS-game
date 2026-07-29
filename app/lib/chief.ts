import { PLAYER_TYPES, UNIT_TYPES } from '../constants'
import type { UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

type ChiefLike = {
  type?: string
  isChief?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  hitPoints?: number
}

export const AI_CHIEF_SUCCESSION_DELAY_MS = 180000

export function isChiefUnit(unit: ChiefLike | null | undefined): boolean {
  return Boolean(unit && (unit.isChief || unit.type === UNIT_TYPES.chief))
}

export function isLivingChief(unit: ChiefLike | null | undefined): boolean {
  if (!unit || !isChiefUnit(unit)) return false
  return !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 1) > 0
}

export function hasLivingChief(player: { units?: ChiefLike[] } | null | undefined): boolean {
  return Boolean(player?.units?.some(unit => isLivingChief(unit)))
}

export function heroCanCommand(hero: UnitEntity | null | undefined): boolean {
  return isLivingChief(hero)
}

export function playerNeedsChiefForCommand(player: Pick<PlayerLike, 'type' | 'isPlayed'> | null | undefined): boolean {
  return Boolean(player?.isPlayed || player?.type === PLAYER_TYPES.ai)
}
