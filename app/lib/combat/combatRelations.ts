import { FAMILY_TYPES, PLAYER_TYPES } from '../../constants'
import type { CombatEntity } from '../../types/combat'

export function isFriendlyTarget(source?: CombatEntity | null, target?: CombatEntity | null): boolean {
  if (!source?.owner || !target?.owner) return false
  if (source.owner.label === target.owner.label) return true
  // Wild animals are owned by the map's Gaia player (map.gaia = new Gaia(context), with no
  // diplomacy set — it's not 'neutral', just undefined). Player.isEnemy()/isNeutralPlayer() are
  // built for player-vs-player and player-vs-faction diplomacy, and going through them here
  // misread every wild animal as friendly (e.g. whenever the hunter's own faction wasn't
  // 'hostile', isEnemy() short-circuited to false for every target), silently zeroing out all
  // hunting/combat damage against it. Wildlife has no diplomatic stance to consult in the first
  // place, so animals are carved out here directly instead of routing through isEnemy(). A
  // tamed/companion animal is still owned by Gaia, so it's excluded from this carve-out to keep
  // protecting it from stray hits the way the isEnemy-based check already did.
  if (
    target.family === FAMILY_TYPES.animal &&
    target.owner.type === PLAYER_TYPES.gaia &&
    !(target as { companionOwner?: unknown }).companionOwner
  ) {
    return false
  }
  return source.owner.isEnemy?.(target.owner as never) === false
}
