import { UNIT_TYPES } from '../../constants'
import { formatUnitTrainingDuration, getUnitTrainingDurationDays } from '../../lib/training/unitTrainingDuration'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

export function npcTrainingDetail(
  npcs: readonly UnitEntity[],
  fallbackOwner: PlayerLike,
  trainingType: string
): string {
  const owner = npcs.find(npc => npc.type === UNIT_TYPES.villager)?.owner ?? fallbackOwner
  const unitConfig = owner?.config?.units?.[trainingType]
  return formatUnitTrainingDuration(getUnitTrainingDurationDays(unitConfig))
}
