import { Assets } from 'pixi.js'
import { Gaia } from '../players'
import { MapBlueprintGeneration } from './generation/MapBlueprintGeneration'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { AnimalOptions } from '../animal/Animal'
import type { BuildingEntity } from '../../types/entities'
import type { GameContextLike } from '../../types/context'
import { placeBanditCamps } from './BanditCampGeneration'
import {
  applyCivilizationLevelStartingKit as applyPlayerCivilizationLevelStartingKit,
  applyStartingBonuses as applyPlayerStartingBonuses,
  generatePlayers as generateMapPlayers,
  placePlayers as placeMapPlayers,
} from './MapPlayerGeneration'
import {
  canPlaceAmbientAnimalAt,
  generateAmbientAnimalSets,
  generateAmbientAnimalSetsAsync,
  getAmbientAnimalProfile,
  pickAmbientAnimalType,
  placeAmbientAnimalGroup,
  type AmbientAnimalProfile,
} from './generation/AmbientAnimalGeneration'
import type { SaveEntityState } from '../../types/save'
import {
  createGenerationTimer,
  type GameConfig,
  type GenerateMapOptions,
  type GenerationTimer,
  type MapBlueprint,
  type MapGenerationContext,
  type MapGenerationMap,
  type ProgressCallback,
  type SavedGameData,
  type TerrainGrid,
} from './MapGenerationTypes'
import type { EnvironmentTerrainParams } from '../../constants'
import type { SavedPlayer } from './MapSaveRestoreTypes'
import { placePortal } from './MapPortalPlacement'
import { findPlayerPlaces } from './MapSpawnPlacement'
import {
  generateCells,
  generateCellsAsync,
  generateTerrain,
  generateTerrainDataAsync,
  generateTerrainInWorker,
} from './generation/MapCellGeneration'
import {
  generateStylishMap,
  prepareBaseTerrain as prepareMapBaseTerrain,
  prepareTerrainForSavedState as prepareMapTerrainForSavedState,
  setInitialFogCells as setMapInitialFogCells,
} from './MapGenerationPipeline'
import {
  applySavedStateToGeneratedMap,
  clearGeneratedGameplayState,
  finishSavedStateRestore,
  generateFromJSON,
  restoreSavedEntities,
  restoreSavedPlayers,
  restoreSavedResources,
} from './generation/MapSavedStateGeneration'
import { generateMapAsync as generateMapAsyncWithSpawnSearch } from './generation/MapAsyncGeneration'
export type {
  GenerateMapOptions,
  MapBlueprint,
  MapGenerationMap,
  ProgressCallback,
  SavedGameData,
  TerrainGrid,
} from './MapGenerationTypes'

function gameContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.menu || !context.controls || !context.scheduler) {
    throw new Error('Map generation requires a complete game context')
  }
  if (!context.player) {
    throw new Error('Map generation requires an active player')
  }
  return context as GameContextLike
}

function runtimeContext(context: MapGenerationContext): GameContextLike {
  if (!context.app || !context.gamebox || !context.map || !context.scheduler) {
    throw new Error('Map generation requires a runtime context')
  }
  return context as GameContextLike
}

function gameConfig(): GameConfig {
  return Assets.cache.get('config') as GameConfig
}

export class MapGeneration {
  map: MapGenerationMap
  mapBlueprintGeneration: MapBlueprintGeneration

  constructor(map: MapGenerationMap) {
    this.map = map
    this.mapBlueprintGeneration = new MapBlueprintGeneration(
      map,
      () => this.yieldToBrowser(),
      () => this.destroyGeneratedChildren()
    )
  }

  destroyGeneratedChildren(): void {
    this.map.terrainChunkManager?.destroy()
    this.map.mapFog?.destroyFogResources()
    for (const row of this.map.grid) {
      for (const cell of row || []) {
        if (!cell?.isGenerationCell) continue
        for (const child of cell.children || []) {
          child.destroy?.({ children: true, texture: false, textureSource: false })
        }
      }
    }
    for (const child of this.map.removeChildren()) {
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    this.map.grid = []
    this.map.resources = new Set()
    this.map.instanceBuckets = null
    this.map.clearRenderChunks()
  }

  yieldToBrowser(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()))
  }

  generateTerrainInWorker(
    gridSize: number,
    seed: number,
    params: Partial<EnvironmentTerrainParams> = {}
  ): Promise<TerrainGrid> {
    return generateTerrainInWorker(this.map, gridSize, seed, params)
  }

  isInPlayerStartSafeZone(i: number, j: number, radius: number = 20): boolean {
    const safeDistanceSq = radius ** 2
    return this.map.playersPos.some(pos => Boolean(pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < safeDistanceSq))
  }

  pickAmbientAnimalType(i: number, j: number): string {
    const environment = this.map.environment ?? ''
    return pickAmbientAnimalType({
      animals: gameConfig().animals,
      biome: environment === 'Steppe' ? environment : (this.map.grid[i]?.[j]?.type ?? ''),
      isInPlayerStartSafeZone: radius => this.isInPlayerStartSafeZone(i, j, radius),
      random: () => this.map.random(),
    })
  }

  getAmbientAnimalProfile(type: string): AmbientAnimalProfile {
    return getAmbientAnimalProfile(type)
  }

  canPlaceAmbientAnimalAt(i: number, j: number): boolean {
    return canPlaceAmbientAnimalAt(this.map, i, j, {
      hasWaterNeighbor: () => this._hasWaterNeighbor(i, j),
      isInPlayerStartSafeZone: radius => this.isInPlayerStartSafeZone(i, j, radius),
    })
  }

  placeAmbientAnimalGroup(i: number, j: number, type: string): void {
    placeAmbientAnimalGroup(this.map, i, j, type, {
      canPlace: (i, j) => this.canPlaceAmbientAnimalAt(i, j),
      createAnimal: options => this._gaiaCreateAnimal(options),
    })
  }

  isShoreWaterCell(i: number, j: number): boolean {
    const cell = this.map.grid[i]?.[j]
    return Boolean(cell?.category === 'Water' && this._hasLandNeighborInRange(i, j, 1))
  }

  restoreSavedPlayers(players: SavedPlayer[], runtime?: SavedGameData['runtime']): void {
    restoreSavedPlayers(this.map, players, runtime)
  }

  restoreSavedResources(resources: SaveEntityState[], naturalResourceRespawnSlots?: SaveEntityState[]): void {
    restoreSavedResources(this.map, resources, naturalResourceRespawnSlots)
  }

  restoreSavedEntities(players: SavedPlayer[], animals: SaveEntityState[], context: GameContextLike): void {
    restoreSavedEntities(this.map, players, animals, context)
  }

  finishSavedStateRestore({ bakeTerrain = false }: { bakeTerrain?: boolean } = {}): void {
    finishSavedStateRestore(this.map, { bakeTerrain })
  }

  async setInitialFogCells(yieldEvery: number): Promise<number> {
    return setMapInitialFogCells(this.map, () => this.yieldToBrowser(), yieldEvery)
  }

  generateFromJSON(data: SavedGameData): void {
    generateFromJSON(this.map, data)
  }

  clearGeneratedGameplayState(): void {
    clearGeneratedGameplayState(this.map)
  }

  applySavedStateToGeneratedMap(data: SavedGameData): void {
    applySavedStateToGeneratedMap(this.map, data)
  }

  async generateMapAsync(
    positionsCountOverride: number | null = null,
    repeat: number = 0,
    options: GenerateMapOptions = {}
  ): Promise<void> {
    await generateMapAsyncWithSpawnSearch(this.map, this, positionsCountOverride, repeat, options)
  }

  async stylishMap({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = gameContext(this.map.context)
    const timer = createGenerationTimer(this.map.generationTimings || {}, this.map.context.performance)
    await generateStylishMap(this.map, context, timer, this.pipelineCallbacks(), { onProgress })
  }

  async prepareTerrainForSavedState({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = runtimeContext(this.map.context)
    const timer = createGenerationTimer(this.map.generationTimings || {}, this.map.context.performance)
    await prepareMapTerrainForSavedState(this.map, context, timer, this.pipelineCallbacks(), { onProgress })
  }

  async prepareBaseTerrain(
    context: GameContextLike,
    timer: Pick<GenerationTimer, 'measure' | 'timings'>,
    onProgress: ProgressCallback
  ): Promise<void> {
    await prepareMapBaseTerrain(this.map, context, timer, onProgress, () => this.yieldToBrowser())
  }

  private pipelineCallbacks() {
    return {
      generateSetsAsync: () => this.generateSetsAsync(),
      placeBanditCamps: () => this.placeBanditCamps(),
      placePortal: () => this.placePortal(),
      prepareBaseTerrain: (
        context: GameContextLike,
        timer: Pick<GenerationTimer, 'measure' | 'timings'>,
        onProgress: ProgressCallback
      ) => this.prepareBaseTerrain(context, timer, onProgress),
      setInitialFogCells: (yieldEvery: number) => this.setInitialFogCells(yieldEvery),
    }
  }

  applyStartingBonuses(player: PlayerLike, configuredAge: number | null = null): void {
    applyPlayerStartingBonuses(this.map, player, configuredAge)
  }

  generatePlayers(playersConfig: Array<PlayerOptions> | null = null): PlayerLike[] {
    return generateMapPlayers(this.map, playersConfig)
  }

  placePlayers(): void {
    placeMapPlayers(this.map)
  }

  placeBanditCamps(): void {
    placeBanditCamps(this.map, runtimeContext(this.map.context))
  }

  // Spawns a player already at an advanced stage: extra economy/military buildings, a static wall
  // perimeter, consistent technologies, a resource cushion and a few soldiers stationed near home.
  // Building/unit counts are read straight from the AI's own long-term per-age targets
  // (MAX_BUILDING_BY_AGE, MAX_*_BY_AGE) so no new tuning numbers are invented here.
  applyCivilizationLevelStartingKit(player: PlayerLike, level: number, townCenter: BuildingEntity): void {
    applyPlayerCivilizationLevelStartingKit(this.map, player, level, townCenter)
  }

  generateCells(): void {
    generateCells(this.map)
  }

  async generateTerrainDataAsync(): Promise<TerrainGrid> {
    return generateTerrainDataAsync(this.map, (gridSize, seed, params) =>
      this.generateTerrainInWorker(gridSize, seed, params)
    )
  }

  async generateCellsAsync({
    onProgress = async (_stage: string, _progress: number) => {},
    terrain: preparedTerrain = null,
  }: GenerateMapOptions = {}): Promise<void> {
    await generateCellsAsync(
      this.map,
      () => this.yieldToBrowser(),
      () => this.generateTerrainDataAsync(),
      { onProgress, terrain: preparedTerrain }
    )
  }

  async generateFromBlueprint(
    blueprintData: MapBlueprint,
    options: { onProgress?: ProgressCallback } = {}
  ): Promise<void> {
    return this.mapBlueprintGeneration.generateFromBlueprint(blueprintData, options)
  }

  generateEditableFromBlueprint(blueprintData: MapBlueprint): void {
    return this.mapBlueprintGeneration.generateEditableFromBlueprint(blueprintData)
  }

  generateTerrain(gridSize: number = 120, seed?: number, params: Partial<EnvironmentTerrainParams> = {}): TerrainGrid {
    return generateTerrain(this.map, gridSize, seed, params)
  }

  _hasSolidNeighbor(i: number, j: number): boolean {
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        if (Math.abs(di) + Math.abs(dj) <= 1 && this.map.grid[i + di]?.[j + dj]?.solid) return true
      }
    }
    return false
  }

  _hasWaterNeighbor(i: number, j: number): boolean {
    for (let di = -2; di <= 2; di++) {
      const maxDj = 2 - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this.map.grid[i + di]?.[j + dj]
        if (neighbor?.category === 'Water' || neighbor?.waterBorder) return true
      }
    }
    return false
  }

  _hasLandNeighborInRange(i: number, j: number, range: number): boolean {
    for (let di = -range; di <= range; di++) {
      const maxDj = range - Math.abs(di)
      for (let dj = -maxDj; dj <= maxDj; dj++) {
        const neighbor = this.map.grid[i + di]?.[j + dj]
        if (neighbor && neighbor.category !== 'Water') return true
      }
    }
    return false
  }

  _gaiaCreateAnimal(options: AnimalOptions): void {
    const { gaia } = this.map
    if (gaia instanceof Gaia) {
      gaia.createAnimal(options)
    }
  }

  generateSets() {
    generateAmbientAnimalSets(this.map, {
      hasSolidNeighbor: (i, j) => this._hasSolidNeighbor(i, j),
      hasWaterNeighbor: (i, j) => this._hasWaterNeighbor(i, j),
      pickType: (i, j) => this.pickAmbientAnimalType(i, j),
      placeGroup: (i, j, type) => this.placeAmbientAnimalGroup(i, j, type),
    })
  }

  async generateSetsAsync() {
    await generateAmbientAnimalSetsAsync(this.map, {
      hasSolidNeighbor: (i, j) => this._hasSolidNeighbor(i, j),
      hasWaterNeighbor: (i, j) => this._hasWaterNeighbor(i, j),
      pickType: (i, j) => this.pickAmbientAnimalType(i, j),
      placeGroup: (i, j, type) => this.placeAmbientAnimalGroup(i, j, type),
      yieldToBrowser: () => this.yieldToBrowser(),
    })
  }

  placePortal(): void {
    placePortal(this.map)
  }

  findPlayerPlaces() {
    return findPlayerPlaces(this.map)
  }
}
