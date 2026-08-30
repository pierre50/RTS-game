import type { RuntimeCell } from './map'
import type { SpritesheetLike } from './pixi'
import type { RuntimeEntity } from './entityRuntime'
import type { EnergyEntity, UnitEntity } from './unitEntity'
import type { HorseTamingStatus } from '../lib/horses/horseTaming'

export interface AnimalEntity extends EnergyEntity {
  currentSheet?: string
  inactif?: boolean
  isFleeing?: boolean
  previousDest?: RuntimeEntity | RuntimeCell | null
  realDest?: Pick<RuntimeEntity | RuntimeCell, 'i' | 'j'> | null
  horseColor?: string
  tamingStatus?: HorseTamingStatus
  companionOwner?: UnitEntity | null
  isLassoed?: boolean
  lassoOwner?: UnitEntity | null
  companionHitCount?: number
  trapPrey?: boolean
  standingSheet?: SpritesheetLike | null
  walkingSheet?: SpritesheetLike | null
  animalBehavior?: { start?: () => void; stop?: () => void }
  setAltitude?: (altitude: number) => void
}
