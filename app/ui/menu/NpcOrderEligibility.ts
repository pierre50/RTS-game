import { UNIT_TYPES } from '../../constants'
import { hasVillagerAutonomyTarget } from '../../lib'
import { canMineIronResource } from '../../lib/resources/ironMining'
import { isVillagerSleepTime } from '../../lib/units/villagerSchedule'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity, VillagerAutonomyJob } from '../../types/entities'

export function canShowNpcJobOrder(
  npcs: readonly UnitEntity[],
  context: GameContextLike,
  job: VillagerAutonomyJob
): boolean {
  if (!npcs.some(npc => npc.type === UNIT_TYPES.villager) || isVillagerSleepTime(context)) return false
  if (!npcs.some(npc => npc.type === UNIT_TYPES.villager && canMineIronResource(npc, { type: job }))) return false
  const needsKnownTarget = job === 'construction' || job === 'horseCapture'
  return !needsKnownTarget || npcs.some(npc => npc.type === UNIT_TYPES.villager && hasVillagerAutonomyTarget(npc, job))
}
