import type { Container } from 'pixi.js'
import type { ConfigValue, TechnologyConfig } from './config'
import type { RuntimeCell } from './map'
import type { AssetAge } from './pixi'
import type { RuntimeEntityBase } from './entityBase'
import type { RuntimeEntity } from './entityRuntime'
import type { UnitCreationExtra, UnitEntity } from './unitEntity'
import type { TextureRef } from '../lib/graphics/textures'

export interface BuildingEntity extends RuntimeEntityBase {
  isBuilt?: boolean
  accept?: string[]
  queue?: string[]
  technology?: { type?: string; config?: TechnologyConfig } | null
  isUsedBy?: RuntimeEntity | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string }>
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  addChild?: Container['addChild']
  setRallyPoint?: (cell: RuntimeCell, direction: number) => void
  clearRallyPoint?: () => void
  displayPopulation?: boolean
  loading?: number | null
  buyUnit?: (type: string, alreadyPaid?: boolean, force?: boolean, extra?: UnitCreationExtra) => boolean | void
  requestUnitTraining?: (type: string, extra?: UnitCreationExtra, trainee?: UnitEntity | null) => boolean
  cancelUnits?: (type: string) => void
  startTrainingWithUnit?: (trainee: UnitEntity) => boolean
  cancelTrainingForUnit?: (trainee: UnitEntity) => boolean
  buyTechnology?: (type: string) => void
  cancelTechnology?: () => void
  upgrade?: (target: string) => void
  assetType?: string
  textureName?: string
  finalTexture?: () => void
  increasePopulation?: number
  populationCapacityApplied?: boolean
  constructionTime?: number
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
