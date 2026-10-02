import type { PlayerLike } from '../types/player'
import type { UnitEntity } from '../types/entities'

export const RPG_VILLAGE_TICK_MS = 5000
export const RPG_VILLAGE_DECISION_MS = 30000
export const RPG_VILLAGE_WORKERS = { outpost: 0, village: 2, city: 4 }

export function isRpgVillage(owner?: Pick<PlayerLike, 'type' | 'isPlayed' | 'developmentMode'> | null): boolean {
  return Boolean(owner?.type === 'AI' && !owner.isPlayed && owner.developmentMode === 'static')
}

export function isRpgVillager(
  unit: Pick<UnitEntity, 'type' | 'owner' | 'controlMode' | 'followingHero' | 'isChief'>
): boolean {
  return (
    unit.type === 'Villager' &&
    !unit.isChief &&
    !unit.followingHero &&
    unit.controlMode !== 'hero' &&
    isRpgVillage(unit.owner)
  )
}
