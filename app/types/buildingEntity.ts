import type { Container } from 'pixi.js'
import type { ConfigValue, TechnologyConfig } from './config'
import type { ResourceAmount } from './common'
import type { RuntimeCell } from './map'
import type { AssetAge } from './pixi'
import type { RuntimeEntityBase } from './entityBase'
import type { RuntimeEntity } from './entityRuntime'
import type { UnitCreationExtra, UnitEntity } from './unitEntity'
import type { TextureRef } from '../lib/graphics/textures'
import type { HorseTamingStatus } from '../lib/horses/horseTaming'

export interface BuildingEntity extends RuntimeEntityBase {
  isBuilt?: boolean
  accept?: string[]
  queue?: string[]
  technology?: { type?: string; config?: TechnologyConfig } | null
  isUsedBy?: RuntimeEntity | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  trainingQueue?: Array<{
    type: string
    extra?: UnitCreationExtra
    trainee: UnitEntity
    cost?: ResourceAmount
    loading?: number
    trainingStartedDay?: number | null
    trainingCompleteDay?: number | null
    trainingDayChangeUnsubscribe?: (() => void) | null
  }>
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
  addChild?: Container['addChild']
  setRallyPoint?: (cell: RuntimeCell, direction: number) => void
  clearRallyPoint?: () => void
  displayPopulation?: boolean
  loading?: number | null
  buyUnit?: (
    type: string,
    alreadyPaid?: boolean,
    force?: boolean,
    extra?: UnitCreationExtra,
    trainee?: UnitEntity | null
  ) => boolean | void
  cancelUnits?: (type: string) => void
  cancelAllUnitTraining?: () => boolean
  startTrainingWithUnit?: (trainee: UnitEntity) => boolean
  buyTechnology?: (type: string) => void
  cancelTechnology?: () => void
  upgrade?: (target: string) => void
  assetType?: string
  textureName?: string
  hideWhenFogged?: boolean
  providesVision?: boolean
  requiresActiveSightInteraction?: boolean
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
  useSpriteShadow?: boolean
  spriteShadowAnchor?: { x?: number; y?: number }
  finalTexture?: () => void
  increasePopulation?: number
  shelterCapacity?: number
  populationCapacityApplied?: boolean
  constructionTime?: number
  indestructible?: boolean
  containedAnimalType?: string | null
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
  }
  marketStock?: string[]
  updateHitPoints?: (action: string) => void
  units?: string[]
  technologies?: string[]
  placeUnit?: (type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }) => boolean
  range?: number
  attackAction?: (target: RuntimeEntity) => void
  visibleCells?: Set<number>
  assetCiv?: string
  assetAge?: AssetAge
}

export interface PlaceableBuildingConfig {
  type: string
  images?: {
    final?: TextureRef
  }
  [key: string]: ConfigValue | { final?: TextureRef } | undefined
}
