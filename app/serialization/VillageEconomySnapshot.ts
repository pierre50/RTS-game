import { serializeTrainingQueue } from './TrainingSave'
import type { PlayerLike } from '../types/player'
import type { RuntimeEntity } from '../types/entities'
import type { SaveEntityState, SavePlayerState } from '../types/save'

const ENTITY_FIELDS = [
  'label',
  'type',
  'i',
  'j',
  'spaceId',
  'size',
  'hitPoints',
  'totalHitPoints',
  'constructionMaterials',
  'reservePolicy',
  'trainingRequests',
  'inventory',
  'equipment',
  'experience',
  'isBuilt',
  'buildingAge',
  'placementMirrored',
  'work',
  'autonomousJob',
  'collectiveTask',
  'collectiveHome',
  'offlineWork',
  'offlineBuilderJob',
  'dailySchedule',
  'lastMealAt',
  'trainingTargetType',
  'controlMode',
  'followingHero',
  'isChief',
  'action',
] as const
const PLAYER_FIELDS = [
  'label',
  'type',
  'civ',
  'age',
  'population',
  'populationMax',
  'hasBuilt',
  'completedObjectives',
  'offlineBuildingPlanDay',
  'offlineBuildingDecision',
  'abstractProductionRemainder',
] as const

function fields(value: object, keys: readonly string[]): Record<string, unknown> {
  const data = value as Record<string, unknown>
  return Object.fromEntries(keys.filter(key => data[key] !== undefined).map(key => [key, structuredClone(data[key])]))
}

/** No renderer, fog, scheduler or entity-reference graph enters a simulation transaction. */
function entitySnapshot(entity: RuntimeEntity): SaveEntityState {
  return fields(entity, ENTITY_FIELDS) as SaveEntityState
}

export function serializeEconomyPlayer(player: PlayerLike): SavePlayerState {
  const state = fields(player, PLAYER_FIELDS) as SavePlayerState
  state.units = player.units
    .filter(unit => !unit.isDead && !unit.isDestroyed)
    .map(unit => ({
      ...entitySnapshot(unit),
      dest: unit.dest ? [unit.dest.i, unit.dest.j, 'label' in unit.dest ? unit.dest.label : undefined] : null,
      buildQueue: unit.buildQueue?.map(building => building.label).filter((label): label is string => Boolean(label)),
    }))
  state.buildings = player.buildings
    .filter(building => !building.isDead && !building.isDestroyed)
    .map(building => ({
      ...entitySnapshot(building),
      trainingQueue: serializeTrainingQueue(building.trainingQueue),
    }))
  return state
}
