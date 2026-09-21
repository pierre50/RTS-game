import { BUILDING_TYPES } from '../../constants'
import { townCenterLimitReached } from './townCenterClaim'
import type { PlayerLike } from '../../types/player'

export function isBuildingLimitReached(owner: PlayerLike | null | undefined, type: string): boolean {
  return (
    type === BUILDING_TYPES.townCenter && Boolean(owner && townCenterLimitReached(owner, owner.context?.players ?? []))
  )
}
