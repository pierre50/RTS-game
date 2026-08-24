import type { ContainerChild } from 'pixi.js'
import type { EnvironmentTerrainParams, FAMILY_TYPES } from '../../constants'
import type { GameContextLike, MapRuntimeContext } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { AnimalConfig } from '../../types/config'
import type { SaveCellState, SaveEntityState, SerializedSave } from '../../types/save'
import type { TextureRef } from '../../lib'
import type { SavedPlayer } from './MapSaveRestore'

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
  banditCampPositions: GridPosition[]
  positionsCount: number
  noAI?: boolean
  humanStartsWithoutBase?: boolean
  startingUnits: number
  generationTimings?: Record<string, number>
  difficulty: string
  chanceOfSets: number
  allTechnologies: boolean
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
  generateResourcesAroundPlayersAsync(playersPos: GeneratedPosition[]): Promise<void>
  generateNeutralResourceGroupsAsync(playersPos: GeneratedPosition[]): Promise<void>
  generateBiomeTreesAsync(playersPos: GeneratedPosition[]): Promise<void>
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

export type MapBlueprint = {
  seed?: string | number
  size: number
  mapType?: string
  spawns?: GeneratedPosition[]
  terrain: BlueprintTerrainValue[][]
  relief?: number[][]
  resources?: BlueprintResource[]
}

export type SavedGameData = Omit<
  SerializedSave,
  'map' | 'players' | 'resources' | 'animals' | 'naturalResourceRespawnSlots'
> & {
  map: SaveCellState[][]
  players: SavedPlayer[]
  camera: { x: number; y: number }
  resources: SaveEntityState[]
  naturalResourceRespawnSlots?: SaveEntityState[]
  animals: SaveEntityState[]
}

export type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
export type GenerationTimer = ReturnType<typeof createGenerationTimer>
type GeneratedMapChild = ContainerChild & Partial<RuntimeEntity>

export function createGenerationTimer(timings: Record<string, number>) {
  return {
    timings,
    measure<T>(name: string, callback: () => T): T {
      const startedAt = performance.now()
      const result = callback()
      timings[name] = performance.now() - startedAt
      return result
    },
    async measureAsync<T>(name: string, callback: () => Promise<T> | T): Promise<T> {
      const startedAt = performance.now()
      const result = await callback()
      timings[name] = performance.now() - startedAt
      return result
    },
  }
}
