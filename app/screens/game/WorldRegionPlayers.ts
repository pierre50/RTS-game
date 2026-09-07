import { CIVILIZATIONS } from '../../config/civilizations'
import { playerColors } from '../../lib/graphics/colors'
import { factionIdForCivilization } from '../../lib/campaign/playerRoster'
import type { MapBlueprint } from '../../classes/map/MapGenerationTypes'
import type { PlayerLike } from '../../types/player'
import type { FactionSave, GameConfig, PlayerSetupConfig } from '../../types/save'

export type WorldRegionPlayerConfig = Partial<PlayerLike> & PlayerSetupConfig

export function humanPlayerConfig(config: GameConfig): PlayerSetupConfig {
  return config.players?.find(player => player.isHuman) ?? config.players?.[0] ?? { civ: 'Hellas', isHuman: true }
}

function factionForCivilization(factions: Record<string, FactionSave> | undefined, civilization: string): FactionSave | null {
  const expectedId = factionIdForCivilization(civilization)
  return factions?.[expectedId] ?? Object.values(factions ?? {}).find(faction => faction.civilization === civilization) ?? null
}

function configForCivilization(options: {
  civ: string
  faction?: FactionSave | null
  human: PlayerSetupConfig
  index: number
  isHuman: boolean
}): WorldRegionPlayerConfig {
  const { civ, faction, human, index, isHuman } = options
  const fallbackFactionId = factionIdForCivilization(civ)
  return {
    ...(isHuman ? human : {}),
    civ,
    color: isHuman
      ? (human.color ?? faction?.color ?? playerColors[index % playerColors.length])
      : (faction?.color ?? playerColors[index % playerColors.length]),
    factionId: isHuman ? (human.factionId ?? faction?.id ?? fallbackFactionId) : (faction?.id ?? fallbackFactionId),
    gender: isHuman ? human.gender : 'male',
    isHuman,
    name: isHuman ? human.name : (faction?.name ?? civ),
    team: isHuman ? (human.team ?? null) : null,
  }
}

export function buildWorldRegionPlayerConfigs(
  config: GameConfig,
  blueprint: MapBlueprint,
  factions: Record<string, FactionSave> | undefined
): WorldRegionPlayerConfig[] {
  const human = humanPlayerConfig(config)
  const settlements = (blueprint.settlements || []).filter(
    settlement => (settlement.kind === 'village' || settlement.kind === 'city') && settlement.civ
  )
  if (!settlements.length) return (config.players as WorldRegionPlayerConfig[] | undefined) || [human]

  const humanCiv = human.civ ?? CIVILIZATIONS[0]?.value ?? settlements[0]?.civ ?? 'Hellas'
  const players = settlements.map((settlement, index) => {
    const civ = settlement.civ || CIVILIZATIONS[index % CIVILIZATIONS.length]?.value || 'Hellas'
    return configForCivilization({
      civ,
      faction: factionForCivilization(factions, civ),
      human,
      index,
      isHuman: civ === humanCiv,
    })
  })

  if (players.some(player => player.isHuman)) return players

  return [
    configForCivilization({
      civ: humanCiv,
      faction: factionForCivilization(factions, humanCiv),
      human,
      index: players.length,
      isHuman: true,
    }),
    ...players,
  ]
}

export function selectActivePlayer(players: PlayerLike[]): PlayerLike | null {
  return players.find(player => player.isPlayed) ?? players[0] ?? null
}
