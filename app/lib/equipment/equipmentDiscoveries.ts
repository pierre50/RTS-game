import { t } from '../lang'
import type { ResourceAmount } from '../../types/common'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'

const BOW_DISCOVERY_KEY = 'bow'
const BOW_TECHNOLOGY = 'BowCrafting'
const WHEAT_DISCOVERY_KEY = 'wheat'
const FARMING_TECHNOLOGY = 'Farming'

type EquipmentDiscovery = {
  key: string
  technology: string
  matches: (equipment: string) => boolean
  messageKey: string
}

type ResourceDiscovery = {
  key: string
  technology: string
  matches: (resource: keyof ResourceAmount) => boolean
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

const RESOURCE_DISCOVERIES: readonly ResourceDiscovery[] = [
  {
    key: WHEAT_DISCOVERY_KEY,
    technology: FARMING_TECHNOLOGY,
    matches: resource => resource === WHEAT_DISCOVERY_KEY,
    messageKey: 'technologyFarmingUnlocked',
  },
]

function ensureDiscoveredEquipment(player: PlayerLike): string[] {
  player.discoveredEquipment = player.discoveredEquipment ?? []
  return player.discoveredEquipment
}

function ensureDiscoveredResources(player: PlayerLike): string[] {
  player.discoveredResources = player.discoveredResources ?? []
  return player.discoveredResources
}

function notifyTechnologyDiscovery(player: PlayerLike, messageKey: string): void {
  if (!player.isPlayed) return
  const context = (player as PlayerLike & { context?: GameContextLike }).context
  context?.menu?.showMessage?.(t(messageKey), 'success')
  context?.menu?.updateActionTarget?.()
  context?.menu?.updateTopbar?.()
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
    notifyTechnologyDiscovery(player, discovery.messageKey)
  }
  return unlocked
}

export function discoverHeroResource(
  hero: UnitEntity | null | undefined,
  resource: keyof ResourceAmount,
  amount = 1
): string[] {
  const player = hero?.owner
  if (!player || !resource || amount <= 0) return []

  const unlocked: string[] = []
  const discoveredResources = ensureDiscoveredResources(player)
  for (const discovery of RESOURCE_DISCOVERIES) {
    if (!discovery.matches(resource)) continue
    if (!discoveredResources.includes(discovery.key)) discoveredResources.push(discovery.key)
    if (!player.techs?.[discovery.technology] || player.technologies.includes(discovery.technology)) continue
    if (player.unlockTechnology?.(discovery.technology) === false) continue
    unlocked.push(discovery.technology)
    notifyTechnologyDiscovery(player, discovery.messageKey)
  }
  return unlocked
}
