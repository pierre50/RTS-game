import type { SaveEntityState, SavedAIState } from '../../types/save'

export type SavedPlayer = {
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
