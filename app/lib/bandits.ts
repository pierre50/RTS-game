import { PLAYER_TYPES, UNIT_TYPES } from '../constants'
import type { PlayerLike } from '../types/player'
import type { UnitEntity } from '../types/entities'

const BANDIT_UNIT_TYPES = new Set<string>([
  UNIT_TYPES.banditChief,
  UNIT_TYPES.banditSword,
  UNIT_TYPES.banditArcher,
])

type BanditOwnerLike = PlayerLike & {
  banditCampOwner?: boolean
  banditRaidOwner?: boolean
  devConsoleBanditOwner?: boolean
}

export function isBanditUnitType(type?: string | null): boolean {
  return Boolean(type && BANDIT_UNIT_TYPES.has(type))
}

export function isBanditOwner(owner?: PlayerLike | null): boolean {
  const banditOwner = owner as BanditOwnerLike | null | undefined
  if (!banditOwner) return false
  return Boolean(
    banditOwner.type === PLAYER_TYPES.bandits ||
      banditOwner.banditCampOwner ||
      banditOwner.banditRaidOwner ||
      banditOwner.devConsoleBanditOwner ||
      (banditOwner.isPlayed !== true && banditOwner.name?.trim().toLowerCase() === 'bandits')
  )
}

export function isBanditUnit(unit?: UnitEntity | null): boolean {
  if (!unit) return false
  const type = unit.type?.toLowerCase() ?? ''
  const name = unit.name?.toLowerCase() ?? ''
  const category = unit.category?.toLowerCase() ?? ''
  const ownerName = unit.owner?.name?.toLowerCase() ?? ''
  const ownerLabel = unit.owner?.label?.toLowerCase() ?? ''

  return Boolean(
    isBanditUnitType(unit.type) ||
      isBanditOwner(unit.owner) ||
      category.includes('bandit') ||
      type.includes('bandit') ||
      name.includes('bandit') ||
      ownerName.includes('bandit') ||
      ownerLabel.includes('bandit')
  )
}
