import type { ResourceAmount } from './common'
import type { UnitCreationExtra, UnitEntity } from './entities/unitEntity'

// Entered trainees no longer belong to the map. Training only retains their portable state.
export type TrainingTrainee = Pick<
  UnitEntity,
  | 'type'
  | 'label'
  | 'i'
  | 'j'
  | 'homeHouseLabel'
  | 'homeBedLabel'
  | 'partnerLabel'
  | 'name'
  | 'gender'
  | 'appearanceVariants'
  | 'mountedOnHorse'
  | 'horseColor'
  | 'companionHorseColor'
  | 'experience'
  | 'speed'
  | 'hitPoints'
  | 'inventory'
>

export type SavedTrainingExtra = Omit<UnitCreationExtra, 'handleSetDest' | 'handleIsAttacked'>

export type SavedTrainingEntry = {
  type: string
  trainee: TrainingTrainee
  extra?: SavedTrainingExtra
  cost?: ResourceAmount
  loading?: number
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
}

export type TrainingEntry = Omit<SavedTrainingEntry, 'extra'> & {
  extra?: UnitCreationExtra
  trainingDayChangeUnsubscribe?: (() => void) | null
}

export type TrainingRequest = { type: string; traineeLabel?: string; travelRemainingMs?: number }
