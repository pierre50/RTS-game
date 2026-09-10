import type { PlacedCave } from '../../types/cave'
import type { PreparedTerrainCell } from './generation/PreparedMapContent'
import type { ContainerChild } from 'pixi.js'
import type { LocalMapLayout } from '../../lib/localMapLayout'
import type { EnvironmentTerrainParams, FAMILY_TYPES } from '../../constants'
import type { GameContextLike, MapRuntimeContext } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap, RuntimeWorldManifest } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { AnimalConfig } from '../../types/config'
import type { SaveCellState, SaveEntityState, SerializedSave } from '../../types/save'
import type { TextureRef } from '../../lib'
import type { SavedPlayer } from './MapSaveRestoreTypes'

export type TerrainValue = 0 | 1 | 2 | 3 | 4 | 5 | 7
type BlueprintTerrainValue = TerrainValue | string
export type TerrainGrid = TerrainValue[][]
type GeneratedPosition = GridPosition | null
export type GaiaRespawnSlot = SaveEntityState & {
  context: GameContextLike
  family: typeof FAMILY_TYPES.animal
  owner: PlayerLike
}

export type MapGenerationContext = MapRuntimeContext
export type MapGenerationMap = RuntimeMap & {
  context: MapGenerationContext
  playersPos: GeneratedPosition[]
  interiorExits?: GeneratedPosition[]
  banditCampPositions: GridPosition[]
  settlements?: MapSettlement[]
  positionsCount: number
  noAI?: boolean
  heroOnlyStart?: boolean
  startingUnits: number
  generationTimings?: Record<string, number>
  difficulty: string
  chanceOfSets: number
  startingAge: number
  instanceBuckets: Array<Array<Set<RuntimeEntity>>> | null
  pregeneratedBlueprintId?: string | null
  pregeneratedResourcesLoaded?: boolean
  naturalResourceRespawnSlots?: SaveEntityState[]
  blueprintDestroyMs?: number
  blueprintCellCreationMs?: number
  blueprintFillWaterGapsMs?: number
  blueprintNormalizeWaterMs?: number
  blueprintInitialWaterBorderMs?: number
  blueprintWaterBorderReady?: boolean
  blueprintResourceLoadMs?: number
  _fogInitComplete?: boolean
  terrainChunkManager?: { destroy(): void }
  mapFog?: { destroyFogResources(): void }
  children: GeneratedMapChild[]
  removeChildren(): GeneratedMapChild[]
  getChildByLabel(label: string): ContainerChild | null
  clearRenderChunks(): void
  resetRandom(stream?: number | string): void
  findPlayerPlaces(): GeneratedPosition[]
  generateCells(): void
  generateTerrain(gridSize?: number, seed?: number, params?: Partial<EnvironmentTerrainParams>): TerrainGrid
  fillWaterGaps(level?: number | null): Set<RuntimeCell>
  normalizeWaterTopology(
    level?: number | null,
    seeds?: Set<RuntimeCell> | null,
    protectedCells?: Set<RuntimeCell>
  ): Set<RuntimeCell>
  formatCellsWaterBorder(): void
  rebuildTerrainAppearance(protectedReliefCells?: Set<RuntimeCell>): void
  generateMapRelief(): void
  generateNeutralResourceGroupsAsync(
    playersPos: GeneratedPosition[],
    options?: {
      treeTextureFamily?: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | null
      treeTextureFamilyForCell?: (cell: RuntimeCell) => 'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | null | undefined
      treeChanceForCell?: (cell: RuntimeCell) => number | null | undefined
    }
  ): Promise<void>
  generateBiomeTreesAsync(
    playersPos: GeneratedPosition[],
    options?: {
      treeTextureFamily?: 'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | null
      treeTextureFamilyForCell?: (cell: RuntimeCell) => 'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | null | undefined
      treeChanceForCell?: (cell: RuntimeCell) => number | null | undefined
    }
  ): Promise<void>
  placePlayers(): void
  _initFogChunks(): void
  _indexFogChunkCells(): void
  _flushFogQueue(): void
  bakeTerrainToChunks(): void
  removeChild(child: ContainerChild): ContainerChild
}

type ResourceDefinition = {
  category?: string
  habitat?: string
}

export type GameConfig = {
  animals: Record<string, AnimalConfig>
  resources: Record<string, ResourceDefinition>
  cells: Record<string, CellDefinition>
}

export type CellDefinition = {
  assets: TextureRef[]
  [key: string]: string | TextureRef[] | number | boolean | undefined
}

export type GenerateMapOptions = {
  onProgress?: ProgressCallback
  terrain?: TerrainGrid | null
}

type BlueprintResource = {
  i: number
  j: number
  type: string
  quantity?: number
  textureName?: string
  startsMature?: boolean
}

export type MapSettlement = {
  id: string
  kind: 'village' | 'city' | 'banditCamp'
  world?: GridPosition
  region?: { x: number; y: number }
  local: GridPosition
  radius?: number
  biome?: string
  civ?: string
  playerIndex?: number
  strength?: number
  importance?: number
}

export type MapBlueprint = {
  caves?: PlacedCave[]
  terrainAppearance?: PreparedTerrainCell[]
  animals?: Array<{ i: number; j: number; type: string }>

  visualNeighbors?: Array<{ region: { x: number; y: number }; blueprint: MapBlueprint }>
  preserveLegacyGrid?: boolean
  localGridLayout?: LocalMapLayout
  seed?: string | number
  size: number
  buildingSize?: number
  kind?: string
  mapType?: string
  interiorType?: string
  environment?: string
  spawns?: GeneratedPosition[]
  exits?: GeneratedPosition[]
  terrain: BlueprintTerrainValue[][]
  relief?: number[][]
  floorMask?: number[][]
  borderMask?: number[][]
  floorShape?: unknown
  resources?: BlueprintResource[]
  settlements?: MapSettlement[]
  banditCampPositions?: GridPosition[]
  worldId?: string | null
  worldRegionId?: string | null
  worldRegion?: { x: number; y: number }
  worldManifest?: RuntimeWorldManifest
}

export type SavedGameData = Omit<
  SerializedSave,
  'map' | 'players' | 'resources' | 'animals' | 'naturalResourceRespawnSlots'
> & {
  map: (SaveCellState | null)[][]
  players: SavedPlayer[]
  camera: { x: number; y: number }
  resources: SaveEntityState[]
  naturalResourceRespawnSlots?: SaveEntityState[]
  animals: SaveEntityState[]
}

export type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
export type GenerationTimer = ReturnType<typeof createGenerationTimer>
type GeneratedMapChild = ContainerChild & Partial<RuntimeEntity>

export function createGenerationTimer(
  timings: Record<string, number>,
  performanceMonitor?: { record?: (name: string, duration: number) => void } | null
) {
  return {
    timings,
    measure<T>(name: string, callback: () => T): T {
      const startedAt = performance.now()
      try {
        return callback()
      } finally {
        const duration = performance.now() - startedAt
        timings[name] = duration
        performanceMonitor?.record?.(`mapGeneration.${name}`, duration)
      }
    },
    async measureAsync<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
      const startedAt = performance.now()
      try {
        return await callback()
      } finally {
        const duration = performance.now() - startedAt
        timings[name] = duration
        performanceMonitor?.record?.(`mapGeneration.${name}`, duration)
      }
    },
  }
}
