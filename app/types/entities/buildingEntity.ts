import type { BuildingUpgrade } from '../../lib/economy/constructionMaterials'
import type { DepotReservePolicy } from '../../lib/economy/depotReserves'
import type { TrainingRequest } from '../training'
import type { ConstructionMaterials } from '../../lib/economy/constructionMaterials'
import type { CaveDefinition } from '../cave'
import type { Container } from 'pixi.js'
import type { ConfigValue } from '../config'
import type { ResourceAmount } from '../common'
import type { AssetLevel } from '../pixi'
import type { RuntimeEntityBase } from './entityBase'
import type { RuntimeEntity } from './entityRuntime'
import type { UnitCreationExtra, UnitEntity } from './unitEntity'
import type { TextureRef } from '../../lib/graphics/textures'
import type { HorseTamingStatus } from '../../lib/horses/horseTaming'
import type { TrainingEntry, TrainingTrainee } from '../training'
import type { SaveEntityState } from '../save'

export interface BuildingEntity extends RuntimeEntityBase {
  settlementName?: string
  scanForInitialTarget?: () => void
  heroHomeResident?: { label: string; name?: string }
  plannedBedLabels?: string[]
  demolish?: () => void
  constructionWorkRequired?: number
  constructionProgress?: number
  constructionMaterials?: ConstructionMaterials
  buildingUpgrade?: BuildingUpgrade
  reservePolicy?: DepotReservePolicy
  placementMirrored?: boolean
  buildingLevel?: number
  interiorUnfurnished?: boolean
  interiorBuildings?: SaveEntityState[]
  interiorPortalId?: string
  isBuilt?: boolean
  accept?: string[]
  queue?: string[]
  isUsedBy?: RuntimeEntity | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  trainingUnit?: TrainingTrainee | null
  trainingType?: string | null
  trainingQueue?: TrainingEntry[]
  trainingRequests?: TrainingRequest[]
  resumeSavedTraining?: () => void
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
  addChild?: Container['addChild']
  loading?: number | null
  buyUnit?: (
    type: string,
    alreadyPaid?: boolean,
    force?: boolean,
    extra?: UnitCreationExtra,
    trainee?: UnitEntity | null
  ) => boolean | void
  cancelUnits?: (type: string) => void
  cancelTrainingEntry?: (label: string) => boolean
  cancelAllUnitTraining?: () => boolean
  startTrainingWithUnit?: (trainee: UnitEntity) => boolean
  upgrade?: (target: string) => void
  assetType?: string
  textureName?: string
  providesVision?: boolean
  requiresActiveSightInteraction?: boolean
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
  useSpriteShadow?: boolean
  spriteShadowAnchor?: { x?: number; y?: number }
  finalTexture?: () => void
  shelterCapacity?: number
  constructionTime?: number
  cave?: CaveDefinition
  indestructible?: boolean
  containedAnimalType?: string | null
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
  }
  marketGold?: number
  marketStock?: string[]
  updateHitPoints?: (action: string) => void
  units?: string[]
  placeUnit?: (type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }) => boolean
  range?: number
  attackAction?: (target: RuntimeEntity) => void
  visibleCells?: Set<number>
  assetCiv?: string
  assetLevel?: AssetLevel
}

export interface PlaceableBuildingConfig {
  type: string
  images?: {
    final?: TextureRef
  }
  [key: string]: ConfigValue | { final?: TextureRef } | undefined
}
