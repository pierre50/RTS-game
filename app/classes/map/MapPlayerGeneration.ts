import { definedProperties } from '../../lib/definedProperties'
import { playerColors } from '../../lib'
import { BUILDING_TYPES, PLAYER_TYPES, POPULATION_MAX, UNIT_TYPES } from '../../constants'
import { expandLegacyFoodAmount, syncPlayerResourceFieldsFromChests } from '../../lib/resources/playerResourceTotals'
import { AI, Human } from '../players'
import { ensureBanditCampOwner } from './BanditCampGeneration'
import { applyCivilizationLevelStartingKit as applyCivilizationLevelStartingKitToMap } from './CivilizationStartingKit'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { MapGenerationContext, MapGenerationMap, MapSettlement } from './MapGenerationTypes'

const STARTING_CIVILIAN_GENDERS: Array<'male' | 'female'> = ['male', 'male', 'female', 'female']

function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

export function applyStartingBonuses(
  map: MapGenerationMap,
  player: PlayerLike,
  configuredAge: number | null = null
): void {
  const age = configuredAge == null ? map.startingAge : configuredAge
  const startingAge = Math.max(0, Math.min(Number(age) || 0, 2))
  player.age = startingAge

}

export function generatePlayers(
  map: MapGenerationMap,
  playersConfig: Array<PlayerOptions> | null = null
): PlayerLike[] {
  const context = runtimeContext(map.context)
  const players: PlayerLike[] = []
  map.banditCampPositions = [...(map.banditCampPositions || [])]
  const settlementStarts = (map.settlements || []).filter(
    settlement => (settlement.kind === 'village' || settlement.kind === 'city') && settlement.local
  )

  if (map.heroOnlyStart) {
    const humanConfig = playersConfig?.find(player => player.isHuman) ?? playersConfig?.[0]
    const humanStart = findHeroOnlyStart(map, settlementStarts, humanConfig)
    players.push(createHumanPlayer(context, humanStart.i, humanStart.j, 0, humanConfig))

    if (!map.noAI) {
      const humanCiv = humanConfig?.civ
      for (const settlement of settlementStarts) {
        if (humanCiv && settlement.civ === humanCiv) continue
        const position = settlement.local
        const config = playersConfig?.find(player => player.civ === settlement.civ)
        if (!position) continue
        players.push(createAIPlayer(map, context, position.i, position.j, players.length, config))
      }
    }

    applyAllStartingBonuses(map, players, playersConfig)

    return players
  }

  if (settlementStarts.length) {
    const playerCount = Math.min(playersConfig?.length || settlementStarts.length, settlementStarts.length)
    for (let i = 0; i < playerCount; i++) {
      const settlement = settlementStarts[i]
      const position = settlement.local
      const config = playersConfig?.find(player => player.civ === settlement.civ) ?? playersConfig?.[i]
      if (!position) continue

      if (config?.isHuman || (!players.some(player => player.isPlayed) && i === 0)) {
        players.push(createHumanPlayer(context, position.i, position.j, i, config))
      } else if (!map.noAI) {
        players.push(createAIPlayer(map, context, position.i, position.j, i, config))
      }
    }

    applyAllStartingBonuses(map, players, playersConfig)

    return players
  }

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

  applyAllStartingBonuses(map, players, playersConfig)

  return players
}

function findHeroOnlyStart(
  map: MapGenerationMap,
  settlementStarts: MapSettlement[],
  humanConfig: PlayerOptions | undefined
): { i: number; j: number } {
  const humanCiv = humanConfig?.civ
  const matchingSettlement = humanCiv ? settlementStarts.find(settlement => settlement.civ === humanCiv)?.local : null

  const center = Math.floor(map.size / 2)
  const canUse = (i: number, j: number) => {
    const cell = map.grid[i]?.[j]
    return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
  }
  if (matchingSettlement && canUse(matchingSettlement.i, matchingSettlement.j)) return matchingSettlement
  for (let radius = 0; radius <= Math.max(8, Math.ceil(map.size / 2)); radius += 1) {
    for (let di = -radius; di <= radius; di += 1) {
      for (let dj = -radius; dj <= radius; dj += 1) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== radius) continue
        const i = center + di
        const j = center + dj
        if (canUse(i, j)) return { i, j }
      }
    }
  }

  throw new Error('Cannot place hero: map has no available land cell')
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
    if (player.civilizationLevel) applyCivilizationLevelStartingKit(map, player, player.civilizationLevel, towncenter)
  }
}

export function applyCivilizationLevelStartingKit(
  map: MapGenerationMap,
  player: PlayerLike,
  level: number,
  townCenter: BuildingEntity
): void {
  applyCivilizationLevelStartingKitToMap(map, player, level, townCenter)
}

function shuffleSpawnIndexes(map: MapGenerationMap): number[] {
  const poses: number[] = []
  const randoms = Array.from(Array(map.playersPos.length).keys())
  for (let i = 0; i < map.playersPos.length; i++) {
    const pos = map.randomItem(randoms)
    poses.push(pos)
    randoms.splice(randoms.indexOf(pos), 1)
  }
  return poses
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
      age: 0,
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
      age: 0,
      civ: config?.civ ?? 'Hellas',
      color: config?.color ?? playerColors[playerIndex],
      diplomacy: config?.diplomacy ?? null,
      factionId: config?.factionId ?? null,
      gender: config?.gender,
      heroAppearance: config?.heroAppearance,
      team: config?.team ?? null,
      name: config?.name,
      difficulty: map.difficulty,
      civilizationLevel,
    }),
    context
  )
}

function placeStartingUnits(map: MapGenerationMap, player: PlayerLike, towncenter: BuildingEntity): void {
  const hasStartingLeader = player.type === PLAYER_TYPES.ai || player.isPlayed
  const startingCivilianCount = Math.max(map.startingUnits, STARTING_CIVILIAN_GENDERS.length)
  const requiredStartingPopulation = startingCivilianCount + (hasStartingLeader ? 1 : 0)
  player.populationMax = Math.max(player.populationMax, Math.min(POPULATION_MAX, requiredStartingPopulation))
  if (player.type === PLAYER_TYPES.ai) {
    towncenter.placeUnit?.(UNIT_TYPES.chief)
  } else if (player.isPlayed) {
    towncenter.placeUnit?.(UNIT_TYPES.villager)
  }
  for (let i = 0; i < startingCivilianCount; i++) {
    const gender = STARTING_CIVILIAN_GENDERS[i % STARTING_CIVILIAN_GENDERS.length]
    towncenter.placeUnit?.(UNIT_TYPES.villager, { gender, appearanceVariants: { gender } })
  }
}

function applyAllStartingBonuses(
  map: MapGenerationMap,
  players: PlayerLike[],
  playersConfig: PlayerOptions[] | null
): void {
  players
    .filter(player => player.type !== PLAYER_TYPES.bandits)
    .forEach((player, index) =>
      applyStartingBonuses(
        map,
        player,
        playersConfig?.[index]?.age ?? playersConfig?.[index]?.civilizationLevel ?? null
      )
    )
}
