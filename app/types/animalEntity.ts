import type { InventoryStorage } from '../lib/inventory/inventoryContainers'
import type { RuntimeCell } from './map'
import type { SpritesheetLike } from './pixi'
import type { RuntimeEntity } from './entityRuntime'
import type { EnergyEntity, UnitEntity } from './unitEntity'
import type { HorseTamingStatus } from '../lib/horses/horseTaming'

export interface AnimalEntity extends EnergyEntity {
  corpseMaterialDecayRemainingMs?: number
  inventory?: InventoryStorage
  currentSheet?: string
  inactif?: boolean
  isFleeing?: boolean
  previousDest?: RuntimeEntity | RuntimeCell | null
  realDest?: Pick<RuntimeEntity | RuntimeCell, 'i' | 'j'> | null
  horseColor?: string
  tamingStatus?: HorseTamingStatus
  companionOwner?: UnitEntity | null
  isCatchingPoleCaught?: boolean
  catchingPoleOwner?: UnitEntity | null
  companionHitCount?: number
  trapPrey?: boolean
  standingSheet?: SpritesheetLike | null
  walkingSheet?: SpritesheetLike | null
  animalBehavior?: { start?: () => void; stop?: () => void }
  setAltitude?: (altitude: number) => void
}
