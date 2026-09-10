import type { TargetObservation } from '../../lib/units/playerTargetKnowledge'
import type { SaveEntityState, SavedAIState } from '../../types/save'

export type SavedPlayer = {
  targetKnowledge?: TargetObservation[]
  age?: number
  ageRulesVersion?: number
  label?: string
  factionId?: string
  name?: string
  type: string
  isPlayed?: boolean
  buildings?: SaveEntityState[]
  units?: SaveEntityState[]
  corpses?: SaveEntityState[]
  aiState?: SavedAIState
  selectedUnitLabels?: string[]
  selectedUnitLabel?: string | null
  selectedBuildingLabel?: string | null
  selectedOtherLabel?: string | null
}
