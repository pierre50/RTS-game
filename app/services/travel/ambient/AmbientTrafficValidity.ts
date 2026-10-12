import { campRespawnStates } from '../../../lib/camps/campRespawnState'
import type { GameContextLike } from '../../../types/context'
import { deferredVillageBuildings } from '../../world/distantVillages/DeferredVillageStore'
import type { TrafficGroup } from './AmbientTrafficState'

export function isTrafficGroupValid(context: GameContextLike, group: TrafficGroup): boolean {
  if (group.kind === 'bandits')
    return campRespawnStates(context.map).some(
      c => c.id === group.campId && c.generation === group.campGeneration && c.clearedAtMs == null
    )
  return [group.from, group.to].every(end => {
    const owner = context.players?.find(p => p.label === end.owner)
    return (
      owner &&
      (deferredVillageBuildings(owner) ?? owner.buildings).some(
        b => b.label === end.label && b.isBuilt && !b.isDead && !b.isDestroyed
      )
    )
  })
}
