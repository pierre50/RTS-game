import { defaultSettlementType } from '../../config/settlementProfiles'
import { startingVillagerInventory } from '../../lib/economy/startingProvisions'
import { definedProperties } from '../../lib/definedProperties'
import { playerColors } from '../../lib'
import { BUILDING_TYPES, PLAYER_TYPES, UNIT_TYPES } from '../../constants'
import { expandLegacyFoodAmount, syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import { AI, Human } from '../players'
import { ensureBanditCampOwner } from './BanditCampGeneration'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { MapGenerationContext, MapGenerationMap, MapSettlement } from './MapGenerationTypes'
import { findHeroOnlyStart, shuffleSpawnIndexes } from './generation/PlayerStartPositions'

const STARTING_CIVILIAN_GENDERS: Array<'male' | 'female'> = ['male', 'male', 'female', 'female']

function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

export function generatePlayers(
  map: MapGenerationMap,
  playersConfig: Array<PlayerOptions> | null = null
): PlayerLike[] {
  const context = runtimeContext(map.context)
  map.banditCampPositions = [...(map.banditCampPositions || [])]
  const settlementStarts = (map.settlements || []).filter(
    settlement => (settlement.kind === 'village' || settlement.kind === 'city') && settlement.local
  )

  if (map.heroOnlyStart) return generateHeroOnlyPlayers(map, context, settlementStarts, playersConfig)
  if (settlementStarts.length) return generateSettlementPlayers(map, context, settlementStarts, playersConfig)
  return generateSpawnPlayers(map, context, playersConfig)
}

function heroOnlySettlementConfig(
  settlement: MapSettlement,
  villageConfig: PlayerOptions | undefined,
  playersConfig: Array<PlayerOptions> | null
) {
  return {
    ...(villageConfig ?? playersConfig?.find(player => player.civ === settlement.civ)),
    civ: settlement.civ,
    ...(settlement.settlementType ? { label: settlement.id } : {}),
    settlementType:
      settlement.settlementType ??
      villageConfig?.settlementType ??
      (settlement.kind === 'city' ? ('city' as const) : defaultSettlementType(settlement.civ ?? '')),
  }
}

function generateHeroOnlyPlayers(
  map: MapGenerationMap,
  context: GameContextLike,
  settlementStarts: MapSettlement[],
  playersConfig: Array<PlayerOptions> | null
): PlayerLike[] {
  const humanConfig = playersConfig?.find(player => player.isHuman) ?? playersConfig?.[0]
  const humanStart = findHeroOnlyStart(map, settlementStarts, humanConfig)
  const players: PlayerLike[] = [createHumanPlayer(context, humanStart.i, humanStart.j, 0, humanConfig)]
  if (map.noAI) return players

  const humanCiv = humanConfig?.civ
  for (const settlement of settlementStarts) {
    const villageConfig = playersConfig?.find(player => player.civ === settlement.civ && player.isHuman === false)
    if (humanCiv && settlement.civ === humanCiv && !villageConfig) continue
    const position = settlement.local
    const config = heroOnlySettlementConfig(settlement, villageConfig, playersConfig)
    if (!position) continue
    players.push(createAIPlayer(map, context, position.i, position.j, players.length, config))
  }
  return players
}

function generateSettlementPlayers(
  map: MapGenerationMap,
  context: GameContextLike,
  settlementStarts: MapSettlement[],
  playersConfig: Array<PlayerOptions> | null
): PlayerLike[] {
  const players: PlayerLike[] = []
  const playerCount = Math.min(playersConfig?.length || settlementStarts.length, settlementStarts.length)
  for (let i = 0; i < playerCount; i++) {
    const settlement = settlementStarts[i]
    const position = settlement.local
    const config = playersConfig?.find(player => player.civ === settlement.civ) ?? playersConfig?.[i]
    if (!position) continue

    if (config?.isHuman || (!playersConfig?.some(player => player.isHuman) && i === 0)) {
      players.push(createHumanPlayer(context, position.i, position.j, i, config))
    } else if (!map.noAI) {
      players.push(createAIPlayer(map, context, position.i, position.j, i, config))
    }
  }
  return players
}

function generateSpawnPlayers(
  map: MapGenerationMap,
  context: GameContextLike,
  playersConfig: Array<PlayerOptions> | null
): PlayerLike[] {
  const players: PlayerLike[] = []
  const poses = shuffleSpawnIndexes(map)
  const playerCount = Math.min(playersConfig?.length || 1, map.playersPos.length)
  for (let i = 0; i < playerCount; i++) {
    const position = map.playersPos[poses[i]]
    if (!position) continue

    if (!i) {
      players.push(createHumanPlayer(context, position.i, position.j, i, playersConfig?.[i]))
    } else if (!map.noAI) {
      players.push(createAIPlayer(map, context, position.i, position.j, i, playersConfig?.[i]))
    }
  }

  if (!map.noAI && map.banditCampPositions.length) {
    const anchor = map.banditCampPositions[0]
    const human = players.find(player => player.isPlayed)
    ensureBanditCampOwner(map, context, anchor, human?.civ ?? 'Hellas', players, {
      civ: 'Hellas',
    })
  }

  return players
}

export function placePlayers(map: MapGenerationMap): void {
  const {
    context: { players },
  } = map

  for (const player of players) {
    if (player.type === PLAYER_TYPES.bandits || player.type === PLAYER_TYPES.gaia) continue
    if (player.isPlayed && map.heroOnlyStart) {
      player.createUnit?.({ i: player.i, j: player.j, type: UNIT_TYPES.hero })
      continue
    }

    const towncenter = player.spawnBuilding?.({
      i: player.i,
      j: player.j,
      type: BUILDING_TYPES.townCenter,
      isBuilt: true,
    })
    if (!towncenter) continue
    towncenter.inventory = towncenter.inventory ?? {}
    towncenter.inventory.resources = expandLegacyFoodAmount(map.startingResources)
    syncPlayerResourceFieldsFromChests(player)

    placeStartingUnits(map, player, towncenter)
  }
}

function createHumanPlayer(
  context: GameContextLike,
  i: number,
  j: number,
  playerIndex: number,
  config: PlayerOptions | undefined
): PlayerLike {
  const civilizationLevel = Math.max(0, Math.min(Number(config?.civilizationLevel) || 0, 3))
  return new Human(
    definedProperties({
      i,
      j,
      civ: config?.civ ?? 'Hellas',
      color: config?.color ?? playerColors[playerIndex],
      diplomacy: config?.diplomacy ?? null,
      factionId: config?.factionId ?? null,
      gender: config?.gender,
      heroAppearance: config?.heroAppearance,
      team: config?.team ?? null,
      name: config?.name,
      isPlayed: true,
      civilizationLevel,
    }),
    context
  )
}

function createAIPlayer(
  map: MapGenerationMap,
  context: GameContextLike,
  i: number,
  j: number,
  playerIndex: number,
  config: PlayerOptions | undefined
): PlayerLike {
  const civilizationLevel = Math.max(0, Math.min(Number(config?.civilizationLevel) || 0, 3))
  return new AI(
    definedProperties({
      i,
      j,
      civ: config?.civ ?? 'Hellas',
      color: config?.color ?? playerColors[playerIndex],
      diplomacy: config?.diplomacy ?? null,
      factionId: config?.factionId ?? null,
      gender: config?.gender,
      heroAppearance: config?.heroAppearance,
      team: config?.team ?? null,
      name: config?.name,
      difficulty: map.difficulty,
      label: config?.label,
      settlementType: config?.settlementType ?? defaultSettlementType(config?.civ ?? String(playerIndex)),
      developmentMode: config?.developmentMode ?? 'static',
      civilizationLevel,
    }),
    context
  )
}

function placeStartingUnits(map: MapGenerationMap, player: PlayerLike, towncenter: BuildingEntity): void {
  const startingCivilianCount = Math.max(map.startingUnits, STARTING_CIVILIAN_GENDERS.length)
  if (player.type === PLAYER_TYPES.ai) {
    towncenter.placeUnit?.(UNIT_TYPES.chief)
  } else if (player.isPlayed) {
    towncenter.placeUnit?.(UNIT_TYPES.villager, { inventory: startingVillagerInventory() })
  }
  for (let i = 0; i < startingCivilianCount; i++) {
    const gender = STARTING_CIVILIAN_GENDERS[i % STARTING_CIVILIAN_GENDERS.length]
    towncenter.placeUnit?.(UNIT_TYPES.villager, {
      gender,
      appearanceVariants: { gender },
      inventory: startingVillagerInventory(),
    })
  }
}
