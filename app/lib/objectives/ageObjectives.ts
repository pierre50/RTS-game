import { AGE_UP_ENABLED, UNIT_TYPES, BUILDING_TYPES } from '../../constants'
import { t } from '../lang'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { TooltipContent } from '../../types/ui'

export const AGE_OBJECTIVES = {
  createWheatField: 'createWheatField',
  huntAnimal: 'huntAnimal',
  reachVillage: 'reachVillage',
  tameHorse: 'tameHorse',
  reachTown: 'reachTown',
  trainInfantry: 'trainInfantry',
  trainArchers: 'trainArchers',
  buildWatchTower: 'buildWatchTower',
} as const

export type AgeObjectiveId = (typeof AGE_OBJECTIVES)[keyof typeof AGE_OBJECTIVES]

export type AgeObjectiveDefinition = {
  id: AgeObjectiveId
  age: number
  icon: string
  labelKey: string
  descriptionKey: string
}

const STONE_AGE_OBJECTIVES: readonly AgeObjectiveDefinition[] = [
  {
    id: AGE_OBJECTIVES.createWheatField,
    age: 0,
    icon: '090_50729',
    labelKey: 'objectiveCreateWheatField',
    descriptionKey: 'objectiveCreateWheatFieldDescription',
  },
  {
    id: AGE_OBJECTIVES.huntAnimal,
    age: 0,
    icon: '076_50729',
    labelKey: 'objectiveHuntAnimal',
    descriptionKey: 'objectiveHuntAnimalDescription',
  },
  {
    id: AGE_OBJECTIVES.reachVillage,
    age: 0,
    icon: '065_50729',
    labelKey: 'objectiveReachVillage',
    descriptionKey: 'objectiveReachVillageDescription',
  },
  {
    id: AGE_OBJECTIVES.trainInfantry,
    age: 0,
    icon: '065_50729',
    labelKey: 'objectiveTrainInfantry',
    descriptionKey: 'objectiveTrainInfantryDescription',
  },
]

const POPULATION_OBJECTIVES = [
  { id: AGE_OBJECTIVES.reachVillage, population: 20 },
  { id: AGE_OBJECTIVES.reachTown, population: 50 },
]

export const AGE_PROGRESSION: readonly {
  labelKey: string
  age: number
  icon: string
  objectives: readonly AgeObjectiveDefinition[]
}[] = [
  { labelKey: 'BronzeAge', age: 1, icon: '066_50729', objectives: STONE_AGE_OBJECTIVES },
  {
    labelKey: 'IronAge',
    age: 2,
    icon: '067_50729',
    objectives: [
      {
        id: AGE_OBJECTIVES.tameHorse,
        age: 1,
        icon: '068_50729',
        labelKey: 'objectiveTameHorse',
        descriptionKey: 'objectiveTameHorseDescription',
      },
      {
        id: AGE_OBJECTIVES.reachTown,
        age: 1,
        icon: '066_50729',
        labelKey: 'objectiveReachTown',
        descriptionKey: 'objectiveReachTownDescription',
      },
      {
        id: AGE_OBJECTIVES.trainArchers,
        age: 1,
        icon: '076_50729',
        labelKey: 'objectiveTrainArchers',
        descriptionKey: 'objectiveTrainArchersDescription',
      },
      {
        id: AGE_OBJECTIVES.buildWatchTower,
        age: 1,
        icon: '067_50729',
        labelKey: 'objectiveBuildWatchTower',
        descriptionKey: 'objectiveBuildWatchTowerDescription',
      },
    ],
  },
]

const AGE_OBJECTIVE_DEFINITIONS = AGE_PROGRESSION.flatMap(stage => stage.objectives)

function ensureCompletedObjectives(player: PlayerLike): string[] {
  player.completedObjectives = player.completedObjectives ?? []
  return player.completedObjectives
}

function notifyObjectiveCompletion(player: PlayerLike, objective: AgeObjectiveDefinition): void {
  if (!player.isPlayed) return
  const context = (player as PlayerLike & { context?: GameContextLike }).context
  context?.menu?.showMessage?.(t('objectiveCompleted', { objective: t(objective.labelKey) }), 'success')
  context?.menu?.updateActionTarget?.()
  context?.menu?.updateTopbar?.()
  context?.menu?.syncObjectiveProgress?.()
}

function tryAutoAdvanceAge(player: PlayerLike): void {
  if (!AGE_UP_ENABLED) return
  for (const stage of AGE_PROGRESSION) {
    if (
      stage.age !== player.age + 1 ||
      !stage.objectives.length ||
      !stage.objectives.every(objective => isAgeObjectiveComplete(player, objective.id))
    )
      continue
    player.age = stage.age
    player.onAgeChange?.()
    if (player.isPlayed) {
      const context = (player as PlayerLike & { context?: GameContextLike }).context
      context?.menu?.showMessage?.(t('progressionAgeReached', { age: t(stage.labelKey) }), 'success')
      context?.menu?.updateActionTarget?.()
      context?.menu?.updateTopbar?.()
      context?.menu?.syncObjectiveProgress?.()
    }
  }
}

export function updatePopulationObjectives(player: PlayerLike): void {
  for (const objective of POPULATION_OBJECTIVES) {
    if ((player.villagerPopulation ?? 0) >= objective.population) completeAgeObjective(player, objective.id)
  }
  updateSettlementObjectives(player)
}

function updateSettlementObjectives(player: PlayerLike): void {
  const living = (type: string) =>
    (player.units ?? []).filter(unit => unit.type === type && !unit.isDead && !unit.isDestroyed).length
  if (living(UNIT_TYPES.infantry) >= 3) completeAgeObjective(player, AGE_OBJECTIVES.trainInfantry)
  if (living(UNIT_TYPES.bowman) >= 5) completeAgeObjective(player, AGE_OBJECTIVES.trainArchers)
  if (
    (player.buildings ?? []).some(
      building =>
        building.type === BUILDING_TYPES.watchTower && building.isBuilt && !building.isDead && !building.isDestroyed
    )
  ) {
    completeAgeObjective(player, AGE_OBJECTIVES.buildWatchTower)
  }
  tryAutoAdvanceAge(player)
}

export function completeAgeObjective(player: PlayerLike | null | undefined, id: AgeObjectiveId): boolean {
  if (!player) return false
  const objective = AGE_OBJECTIVE_DEFINITIONS.find(definition => definition.id === id)
  if (!objective) return false

  const completedObjectives = ensureCompletedObjectives(player)
  if (completedObjectives.includes(id)) return false

  completedObjectives.push(id)
  notifyObjectiveCompletion(player, objective)
  tryAutoAdvanceAge(player)
  return true
}

export function isAgeObjectiveComplete(player: PlayerLike, id: AgeObjectiveId): boolean {
  return Boolean(player.completedObjectives?.includes(id))
}

export function getAgeObjectiveTooltip(objective: AgeObjectiveDefinition): TooltipContent {
  return {
    title: t(objective.labelKey),
    description: t(objective.descriptionKey),
  }
}
