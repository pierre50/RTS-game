import { definedProperties } from '../lib/definedProperties'
import type { UnitCreationExtra } from '../types/entities'
import type { SavedTrainingEntry, SavedTrainingExtra, TrainingEntry, TrainingTrainee } from '../types/training'

export function serializeTrainingExtra(extra: UnitCreationExtra | undefined): SavedTrainingExtra | undefined {
  if (!extra) return undefined
  return structuredClone(
    definedProperties({
      label: extra.label,
      inventory: extra.inventory,
      name: extra.name,
      gender: extra.gender,
      isChief: extra.isChief,
      mountedOnHorse: extra.mountedOnHorse,
      horseColor: extra.horseColor,
      companionHorseColor: extra.companionHorseColor,
      hitPoints: extra.hitPoints,
      speed: extra.speed,
      experience: extra.experience,
      appearanceVariants: extra.appearanceVariants,
    })
  )
}

function serializeTrainee(trainee: TrainingTrainee): TrainingTrainee {
  return structuredClone(
    definedProperties({
      type: trainee.type,
      label: trainee.label,
      i: trainee.i,
      j: trainee.j,
      name: trainee.name,
      gender: trainee.gender,
      appearanceVariants: trainee.appearanceVariants,
      mountedOnHorse: trainee.mountedOnHorse,
      horseColor: trainee.horseColor,
      companionHorseColor: trainee.companionHorseColor,
      experience: trainee.experience,
      speed: trainee.speed,
      hitPoints: trainee.hitPoints,
      inventory: trainee.inventory,
    })
  )
}

export function serializeTrainingQueue(queue: TrainingEntry[] | undefined): SavedTrainingEntry[] | undefined {
  if (!queue?.length) return undefined
  return queue.map(entry =>
    definedProperties({
      type: entry.type,
      trainee: serializeTrainee(entry.trainee),
      extra: serializeTrainingExtra(entry.extra),
      cost: entry.cost ? { ...entry.cost } : undefined,
      loading: entry.loading,
      trainingStartedDay: entry.trainingStartedDay,
      trainingCompleteDay: entry.trainingCompleteDay,
    })
  )
}
