import { BANDIT_CAMP_RESPAWN_DAYS } from '../../config/campActivity'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { PLAYER_TYPES } from '../../constants'
import { campRespawnStates } from '../../lib/camps/CampRespawnState'
import { isUnitAlive } from '../../lib/playerState'
import { respawnBanditCamp } from '../../classes/map/BanditCampGeneration'
import type { MapGenerationMap } from '../../classes/map/MapGenerationTypes'
import type { GameContextLike } from '../../types/context'

export class CampRespawnSystem {
  constructor(private context: GameContextLike) {}

  update(): void {
    const { context } = this
    if (context.editor || context.paused || !context.dayNight) return
    const now = context.dayNight.getElapsedMs()
    const camps = campRespawnStates(context.map)
    const bandits = context.players.filter(player => player.type === PLAYER_TYPES.bandits)
    const occupiedHomes = new Set<string>()
    for (const owner of bandits)
      for (const unit of owner.units) {
        if (!isUnitAlive(unit) || (unit.campBehavior?.homeSpaceId ?? 'outside') !== 'outside') continue
        const anchor = unit.campPatrolAnchor ?? unit.banditCampAnchor
        if (anchor) occupiedHomes.add(`${anchor.i}:${anchor.j}`)
      }
    for (const camp of camps) {
      const occupied = occupiedHomes.has(`${camp.i}:${camp.j}`)
      if (occupied) {
        delete camp.clearedAtMs
        continue
      }
      camp.clearedAtMs ??= now
      if (now - camp.clearedAtMs < BANDIT_CAMP_RESPAWN_DAYS * DAY_NIGHT_CONFIG.dayLengthMs) continue
      if (respawnBanditCamp(context.map as unknown as MapGenerationMap, context, camp)) delete camp.clearedAtMs
    }
  }
}
