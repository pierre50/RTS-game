import { ensureRuntimeBuildingInteriorSpace } from '../../../engine/services/BuildingInteriorSpaceSystemRuntime'
import { furnishBanditCaveContent } from './BanditCaveContent'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export function furnishBanditCave(
  context: GameContextLike,
  cave: BuildingEntity,
  campIndex: number,
  owner: PlayerLike,
  inventory: NonNullable<BuildingEntity['inventory']>
): void {
  const space = ensureRuntimeBuildingInteriorSpace(context, cave)
  if (!space) throw new Error('Cannot furnish bandit cave without an interior')
  furnishBanditCaveContent(context, space, cave, campIndex, owner, inventory)
}
