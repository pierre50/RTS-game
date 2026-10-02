import type { ForgeUpgrades } from '../../lib/equipment/forgeUpgrades'
import type { SettlementType, DevelopmentMode } from '../../config/settlementProfiles'
import type { TargetObservation } from '../../lib/units/playerTargetKnowledge'
import type { SaveEntityState, SavedAIState } from '../../types/save'

export type SavedPlayer = {
  settlementType?: SettlementType
  developmentMode?: DevelopmentMode
  populationMax?: number
  targetKnowledge?: TargetObservation[]
  forgeUpgrades?: ForgeUpgrades
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
