import type { RuntimeCell } from './map'
import type { SpritesheetLike } from './pixi'
import type { RuntimeEntity } from './entityRuntime'
import type { EnergyEntity, UnitEntity } from './unitEntity'

export interface AnimalEntity extends EnergyEntity {
  currentSheet?: string
  inactif?: boolean
  isFleeing?: boolean
  previousDest?: RuntimeEntity | RuntimeCell | null
  realDest?: Pick<RuntimeEntity | RuntimeCell, 'i' | 'j'> | null
  horseColor?: string
  companionOwner?: UnitEntity | null
  isLassoed?: boolean
  lassoOwner?: UnitEntity | null
  companionHitCount?: number
  standingSheet?: SpritesheetLike | null
  walkingSheet?: SpritesheetLike | null
  animalBehavior?: { start?: () => void; stop?: () => void }
  setAltitude?: (altitude: number) => void
}
