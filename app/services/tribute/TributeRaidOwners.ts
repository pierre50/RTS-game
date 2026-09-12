import { Player } from '../../classes/players/Player'
import { PLAYER_TYPES } from '../../constants'
import { getHexColor } from '../../lib'
import { definedProperties } from '../../lib/definedProperties'
import { playableColor } from '../../lib/graphics/playableColor'
import { preloadBakedLpcUnitsForPlayers } from '../../lib/lpc'
import type { FactionSave } from '../../types/save'
import { BANDIT_OWNER_NAME, isRaidBanditOwner, isRaidFactionOwner, type TributeRaidOwner } from './TributeRaidRules'
import type { TributeRaidSystem } from '../TributeRaidSystem'

export function getOrCreateBanditOwner(runtime: TributeRaidSystem): TributeRaidOwner {
  const existing = runtime.context.players.find(isRaidBanditOwner)
  if (existing) {
    existing.diplomacy = 'neutral'
    return existing
  }

  const owner = runtime.createTemporaryRaidOwner({
    civ: runtime.context.player?.civ ?? 'Hellas',
    name: BANDIT_OWNER_NAME,
  })
  owner.banditRaidOwner = true
  return owner
}

export function getOrCreateFactionRaidOwner(runtime: TributeRaidSystem, faction: FactionSave): TributeRaidOwner {
  const existing = runtime.context.players.find(player => isRaidFactionOwner(player, faction.id))
  if (existing) {
    existing.diplomacy = 'neutral'
    existing.factionId = null
    existing.color = playableColor(faction.color ?? existing.color, 'red')
    existing.colorHex = getHexColor(existing.color)
    existing.civ = faction.civilization ?? existing.civ ?? runtime.context.player?.civ ?? 'Hellas'
    return existing
  }

  const owner = runtime.createTemporaryRaidOwner({
    civ: faction.civilization ?? runtime.context.player?.civ ?? 'Hellas',
    color: playableColor(faction.color, 'red'),
    factionId: null,
    name: faction.name,
  })
  owner.factionRaidOwner = true
  owner.factionRaidFactionId = faction.id
  return owner
}

export function createTemporaryRaidOwner(
  runtime: TributeRaidSystem,
  options: {
    civ: string
    color?: string | null
    factionId?: string | null
    name: string
  }
): TributeRaidOwner {
  const owner = new Player(
    definedProperties({
      name: options.name,
      type: PLAYER_TYPES.ai,
      isPlayed: false,
      color: options.color ?? 'red',
      civ: options.civ,
      gender: 'male' as const,
      team: null,
      diplomacy: 'neutral' as const,
      factionId: options.factionId,
      populationMax: Number.POSITIVE_INFINITY,
    }),
    runtime.context
  ) as TributeRaidOwner
  owner.selectedUnits = []
  owner.selectedUnit = null
  owner.selectedBuilding = null
  owner.selectedOther = null
  owner.hasBuilt = []
  runtime.context.players.push(owner)
  return owner
}

export async function preloadRaidOwnerAssets(runtime: TributeRaidSystem, owner: TributeRaidOwner): Promise<void> {
  try {
    await preloadBakedLpcUnitsForPlayers([owner], runtime.context.performance, { preloadEquipment: true })
  } catch (error) {
    console.error('Unable to preload tribute raid owner assets', { owner: owner.name, civ: owner.civ, error })
  }
}
