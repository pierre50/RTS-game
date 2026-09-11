import { PLAYER_TYPES } from '../../constants'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import type { TerritoryPlayer } from '../../lib/campaign/mapTerritory'
import { getHexColor } from '../../lib/graphics/colors'
import { playableColor } from '../../lib/graphics/playableColor'
import type { MenuHost } from '../MenuHost'

export function worldMapPlayerColor(menu: MenuHost, player: TerritoryPlayer): string | null {
  const factions = menu.context.getCampaignFactions?.()
  const faction =
    (player.factionId ? factions?.[player.factionId] : null) ??
    (player.civ ? factions?.[factionIdForCivilization(player.civ)] : null) ??
    Object.values(factions ?? {}).find(entry => player.civ && entry.civilization === player.civ)
  const color = player.isPlayed
    ? (player.color ?? player.colorHex ?? faction?.color)
    : (faction?.color ?? player.color ?? player.colorHex)
  if (!color) return null
  const resolved =
    player.type === PLAYER_TYPES.gaia || player.type === PLAYER_TYPES.bandits ? color : playableColor(color)
  return resolved.startsWith('#') ? resolved : getHexColor(resolved)
}
