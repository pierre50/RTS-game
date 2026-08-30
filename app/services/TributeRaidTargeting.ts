import { PLAYER_TYPES, UNIT_TYPES } from '../constants'
import { hasLivingChief, isLivingChief } from '../lib/chief'
import type { GameContextLike } from '../types/context'
import type { TributeRaidKind, TributeRaidOwner, TributeRaidUnit } from './TributeRaidRules'

export function hasActiveBanditCampPresence(context: GameContextLike): boolean {
  return context.players.some(player => {
    if (player.type !== PLAYER_TYPES.bandits && !(player as { banditCampOwner?: boolean }).banditCampOwner) return false
    return (
      player.units?.some(unit => !unit.isDead && !unit.isDestroyed && (unit.hitPoints ?? 1) > 0) ||
      player.buildings?.some(building => !building.isDead && !building.isDestroyed && (building.hitPoints ?? 1) > 0)
    )
  })
}

export function findRaidTarget(context: GameContextLike, kind: TributeRaidKind): TributeRaidUnit | null {
  const hero = context.controls?.heroUnit
  if (!hero || hero.isDead || hero.isDestroyed) return null
  if (kind !== 'bandit') return hero as TributeRaidUnit
  return findLocalChiefTarget(context) ?? (hero as TributeRaidUnit)
}

function findLocalChiefTarget(context: GameContextLike): TributeRaidUnit | null {
  const player = context.player
  const playerPresence = player ? getPlayerMapPresence(player, { ignoreHero: true }) : 0
  const allies = context.players.filter(candidate => {
    if (!candidate || candidate === player || candidate.isPlayed) return false
    if (candidate.type !== PLAYER_TYPES.ai) return false
    if (!hasLivingChief(candidate)) return false
    if (player?.isEnemy?.(candidate) || candidate.isEnemy?.(player)) return false
    return true
  })
  if (!allies.length) return null

  const scored = allies
    .map(owner => ({
      owner,
      chief: owner.units.find(unit => isLivingChief(unit)) as TributeRaidUnit | undefined,
      presence: getPlayerMapPresence(owner),
    }))
    .filter((entry): entry is { owner: TributeRaidOwner; chief: TributeRaidUnit; presence: number } =>
      Boolean(entry.chief && entry.presence > playerPresence)
    )
    .sort((a, b) => b.presence - a.presence)

  return scored[0]?.chief ?? null
}

function getPlayerMapPresence(
  player: Pick<TributeRaidOwner, 'buildings' | 'units'>,
  options: { ignoreHero?: boolean } = {}
): number {
  const livingUnits = (player.units ?? []).filter(
    unit =>
      !unit.isDead &&
      !unit.isDestroyed &&
      (unit.hitPoints ?? 1) > 0 &&
      (!options.ignoreHero || unit.type !== UNIT_TYPES.hero)
  )
  const livingBuildings = (player.buildings ?? []).filter(
    building => !building.isDead && !building.isDestroyed && (building.hitPoints ?? 1) > 0
  )
  return livingBuildings.length * 3 + livingUnits.length
}
