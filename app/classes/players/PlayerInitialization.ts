import { RESOURCE_NAMES } from '../../constants'
import { expandLegacyFoodAmount } from '../../lib/resources/playerResourceTotals'
import type { RuntimeMap } from '../../types/map'
import type { Player, PlayerOptions } from './Player'

export function initializePlayerResources(player: Player, res: RuntimeMap['startingResources']): void {
  for (const resource of RESOURCE_NAMES) {
    player[resource] = res[resource] ?? 0
  }
  const splitFood = expandLegacyFoodAmount(res)
  player.berry = splitFood.berry ?? 0
  player.meat = splitFood.meat ?? 0
  player.wheat = splitFood.wheat ?? 0
  player.herb = res.herb ?? 0
  player.toxicHerb = res.toxicHerb ?? 0
  player.fiber = res.fiber ?? 0
  player.feather = res.feather ?? 0
  player.leather = res.leather ?? 0
  player.sinew = res.sinew ?? 0
}

export function initializePlayerRelations(player: Player, options: PlayerOptions): void {
  const rawTeam = options.team
  player.team = rawTeam == null || rawTeam === '' ? null : Number(rawTeam)
  if (!Number.isFinite(player.team)) player.team = null
  player.diplomacy = options.diplomacy === 'neutral' ? 'neutral' : null
  player.factionId = typeof options.factionId === 'string' ? options.factionId : null
}
