import type { BuildingEntity } from '../../app/types/entities'
import type { RuntimeCell, RuntimeMap, RuntimeMapSpace, RuntimeMapSpacePortal } from '../../app/types/map'
import type { BuildingInteriorSpaceRenderer } from './BuildingInteriorSpaceRenderer'

export type TickerLike = { deltaMS?: number; elapsedMS?: number }

export type BuildingInventory = NonNullable<BuildingEntity['inventory']>

export type InteriorSpaceMapAdapter = Pick<
  RuntimeMap,
  | 'grid'
  | 'size'
  | 'seed'
  | 'mapType'
  | 'revealEverything'
  | 'revealTerrain'
  | 'instantMode'
  | 'startingResources'
  | 'resources'
  | 'random'
  | 'randomRange'
  | 'randomItem'
  | 'invalidateReliefCoastDistances'
  | 'setCoordinate'
  | 'updateRenderChunks'
  | 'addToInstanceBucket'
  | 'removeFromInstanceBucket'
  | 'updateInstanceBucket'
  | 'addChild'
  | 'removeChild'
> & {
  invalidateWaterOverlay?: () => void
}

export type BuildingInteriorRuntimeSpace = RuntimeMapSpace & {
  building: BuildingEntity
  defaultBuildingsPlaced?: boolean
  entryPortal: RuntimeMapSpacePortal
  exteriorEntryCell: RuntimeCell | null
  exitPortal: RuntimeMapSpacePortal
  idleCells: RuntimeCell[]
  renderer: BuildingInteriorSpaceRenderer
  sleepCells: RuntimeCell[]
  walkableCells: RuntimeCell[]
}
