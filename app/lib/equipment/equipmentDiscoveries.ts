import { t } from '../lang'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BOW_DISCOVERY_KEY = 'bow'
const BOW_TECHNOLOGY = 'BowCrafting'

type EquipmentDiscovery = {
  key: string
  technology: string
  matches: (equipment: string) => boolean
  messageKey: string
}

const EQUIPMENT_DISCOVERIES: readonly EquipmentDiscovery[] = [
  {
    key: BOW_DISCOVERY_KEY,
    technology: BOW_TECHNOLOGY,
    matches: equipment => equipment.startsWith('bow'),
    messageKey: 'technologyBowCraftingUnlocked',
  },
]

function ensureDiscoveredEquipment(player: PlayerLike): string[] {
  player.discoveredEquipment = player.discoveredEquipment ?? []
  return player.discoveredEquipment
}

export function discoverHeroEquipment(hero: UnitEntity | null | undefined, equipment: string): string[] {
  const player = hero?.owner
  if (!player || !equipment) return []

  const unlocked: string[] = []
  const discoveredEquipment = ensureDiscoveredEquipment(player)
  for (const discovery of EQUIPMENT_DISCOVERIES) {
    if (!discovery.matches(equipment)) continue
    if (!discoveredEquipment.includes(discovery.key)) discoveredEquipment.push(discovery.key)
    if (!player.techs?.[discovery.technology] || player.technologies.includes(discovery.technology)) continue
    if (player.unlockTechnology?.(discovery.technology) === false) continue
    unlocked.push(discovery.technology)
    if (player.isPlayed) {
      const context = (player as PlayerLike & { context?: GameContextLike }).context
      context?.menu?.showMessage?.(t(discovery.messageKey), 'success')
      context?.menu?.updateActionTarget?.()
      context?.menu?.updateTopbar?.()
    }
  }
  return unlocked
}
