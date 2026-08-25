import { colors } from '../../lib'
import { BUILDING_TYPES, PLAYER_TYPES, POPULATION_MAX, UNIT_TYPES } from '../../constants'
import { AI, Human } from '../players'
import { ensureBanditCampOwner } from './BanditCampGeneration'
import { applyCivilizationLevelStartingKit as applyCivilizationLevelStartingKitToMap } from './CivilizationStartingKit'
import type { GameContextLike } from '../../types/context'
import type { BuildingEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { MapGenerationContext, MapGenerationMap } from './MapGenerationTypes'

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
  const startingAge = Math.max(0, Math.min(Number(age) || 0, 3))
  player.age = startingAge

  if (!map.allTechnologies) return

  player.autoTechnologyByAge = true
  player.applyEligibleTechnologies?.()
}

export function generatePlayers(
  map: MapGenerationMap,
  playersConfig: Array<PlayerOptions> | null = null
): PlayerLike[] {
  const context = runtimeContext(map.context)
  const players: PlayerLike[] = []
  map.banditCampPositions = []

  const poses = shuffleSpawnIndexes(map)
  const playerCount = Math.min(playersConfig?.length || 1, map.playersPos.length)
  for (let i = 0; i < playerCount; i++) {
    const position = map.playersPos[poses[i]]
    if (!position) continue

    if (!i) {
      players.push(createHumanPlayer(context, position.i, position.j, i, playersConfig?.[i]))
    } else if (!map.noAI) {
      if (map.portalEncounter === 'bandit') {
        map.banditCampPositions.push({ i: position.i, j: position.j })
      } else {
        players.push(createAIPlayer(map, context, position.i, position.j, i, playersConfig?.[i]))
      }
    }
  }

  if (!map.noAI && map.banditCampPositions.length) {
    const anchor = map.banditCampPositions[0]
    const human = players.find(player => player.isPlayed)
    ensureBanditCampOwner(map, context, anchor, human?.civ ?? 'Greek', players)
  }

  players
    .filter(player => player.type !== PLAYER_TYPES.bandits)
    .forEach((player, index) =>
      applyStartingBonuses(map, player, playersConfig?.[index]?.age ?? playersConfig?.[index]?.civilizationLevel ?? null)
    )

  return players
}

export function placePlayers(map: MapGenerationMap): void {
  const {
    context: { players },
  } = map

  for (const player of players) {
    if (player.type === PLAYER_TYPES.bandits) continue
    if (player.isPlayed && map.humanStartsWithoutBase) {
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
    {
      i,
      j,
      age: 0,
      civ: config?.civ ?? 'Greek',
      color: config?.color ?? colors[playerIndex],
      diplomacy: config?.diplomacy ?? null,
      factionId: config?.factionId ?? null,
      gender: config?.gender,
      team: config?.team ?? null,
      name: config?.name,
      isPlayed: true,
      civilizationLevel,
    },
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
    {
      i,
      j,
      age: 0,
      civ: config?.civ ?? 'Greek',
      color: config?.color ?? colors[playerIndex],
      diplomacy: config?.diplomacy ?? null,
      factionId: config?.factionId ?? null,
      gender: config?.gender,
      team: config?.team ?? null,
      name: config?.name,
      difficulty: map.difficulty,
      civilizationLevel,
    },
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
