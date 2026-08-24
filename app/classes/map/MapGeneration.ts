import { Assets } from 'pixi.js'
import { Gaia } from '../players'
import { updateInstanceVisibility } from '../../lib'
import { rehydrateAIKnowledge } from '../../services/FogOfWar'
import { getIdealSpawnRangeForMapSize } from '../../config/mapSizes'
import { MapBlueprintGeneration } from './MapBlueprintGeneration'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { AnimalOptions } from '../animal'
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
  createSpawnSearchCell,
  generateAmbientAnimalSets,
  generateAmbientAnimalSetsAsync,
  getAmbientAnimalProfile,
  pickAmbientAnimalType,
  placeAmbientAnimalGroup,
  type AmbientAnimalProfile,
} from './AmbientAnimalGeneration'
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
  type TerrainValue,
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
} from './MapCellGeneration'
import {
  applySavedStateToGeneratedMap,
  clearGeneratedGameplayState,
  finishSavedStateRestore,
  generateFromJSON,
  restoreSavedEntities,
  restoreSavedPlayers,
  restoreSavedResources,
} from './MapSavedStateGeneration'
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
    return pickAmbientAnimalType({
      animals: gameConfig().animals,
      biome: this.map.grid[i]?.[j]?.type ?? '',
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
    const fogCellsStartedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      for (let j = 0; j <= this.map.size; j++) {
        this.map.grid[i][j].setFog()
      }
      if (i % yieldEvery === 0) await this.yieldToBrowser()
    }
    return performance.now() - fogCellsStartedAt
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
    this.destroyGeneratedChildren()
    if (!Number.isFinite(this.map.seed)) this.map.seed = Math.random() * 9999
    this.map.resetRandom('ideal-spawns')
    const [minIdealSpawns, maxIdealSpawns] = getIdealSpawnRangeForMapSize(this.map.size)
    this.map.positionsCount =
      positionsCountOverride ??
      this.map.randomRange(Math.min(minIdealSpawns, maxIdealSpawns), Math.max(minIdealSpawns, maxIdealSpawns))

    const terrain = await this.generateTerrainDataAsync()
    this.map.size = terrain.length - 1
    // Lightweight placeholder grid used only for the findPlayerPlaces() spawn search below;
    // generateCellsAsync() replaces it with real GenerationCell instances further down.
    this.map.grid = terrain.map((row: TerrainValue[], i: number) =>
      row.map((terrainType: TerrainValue, j: number) => createSpawnSearchCell(i, j, terrainType))
    )

    let validSpawns = false
    for (let attempt = repeat; attempt <= 10; attempt++) {
      this.map.resetRandom(attempt)
      this.map.playersPos = this.map.findPlayerPlaces()
      if (this.map.playersPos.length >= this.map.positionsCount) {
        this.map.resetRandom(attempt)
        validSpawns = true
        break
      }
      await this.yieldToBrowser()
    }

    if (!validSpawns) {
      this.map.grid = []
      alert('Error while generating the map')
      return
    }

    await this.generateCellsAsync({ ...options, terrain })
  }

  async stylishMap({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = gameContext(this.map.context)
    const { menu, player } = context

    const { timings, measure, measureAsync } = createGenerationTimer(this.map.generationTimings || {})

    await this.prepareBaseTerrain(context, { timings, measure }, onProgress)
    await onProgress('generatingPlayers', 0.48)
    measure('playerPlacement', () => this.map.placePlayers())
    await onProgress('generatingResources', 0.58)
    if (this.map.pregeneratedResourcesLoaded) {
      timings.playerResources = 0
      timings.neutralResources = 0
      timings.biomeTrees = 0
    } else {
      await measureAsync('playerResources', () => this.map.generateResourcesAroundPlayersAsync(this.map.playersPos))
      await measureAsync('neutralResources', () => this.map.generateNeutralResourceGroupsAsync(this.map.playersPos))
      await measureAsync('biomeTrees', () => this.map.generateBiomeTreesAsync(this.map.playersPos))
    }
    measure('banditCampPlacement', () => this.placeBanditCamps())
    measure('portalPlacement', () => this.placePortal())
    await onProgress('generatingDecorations', 0.74)
    await measureAsync('decorations', () => this.generateSetsAsync())
    for (const viewer of this.map.context.players || []) {
      rehydrateAIKnowledge(viewer, this.map)
    }
    await onProgress('generatingFog', 0.86)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      const yieldEvery = this.map.pregeneratedBlueprintId ? 32 : 12
      timings.fogCells = await this.setInitialFogCells(yieldEvery)
      for (let i = 0; i < player.buildings.length; i++) {
        const building = player.buildings[i]
        building.visibleCells = new Set()
        updateInstanceVisibility(building)
      }
      for (let i = 0; i < player.units.length; i++) {
        const unit = player.units[i]
        unit.visibleCells = new Set()
        updateInstanceVisibility(unit)
      }
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.93)
    await measureAsync('terrainBake', () => this.map.bakeTerrainToChunks())
    this.map.ready = true
    this.map.generationTimings = timings
    console.table(
      Object.fromEntries(Object.entries(timings).map(([name, duration]) => [name, `${duration.toFixed(1)} ms`]))
    )
    menu.updateResourcesMiniMap()
  }

  async prepareTerrainForSavedState({
    onProgress = async (_stage: string, _progress: number) => {},
  }: GenerateMapOptions = {}): Promise<void> {
    const context = runtimeContext(this.map.context)
    const { timings, measure, measureAsync } = createGenerationTimer(this.map.generationTimings || {})

    await this.prepareBaseTerrain(context, { timings, measure }, onProgress)
    await onProgress('generatingFog', 0.72)
    measure('fogInit', () => this.map._initFogChunks())

    if (!this.map.revealEverything) {
      timings.fogCells = await this.setInitialFogCells(16)
    }

    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    await onProgress('finalizingWorld', 0.92)
    await measureAsync('terrainBake', () => this.map.bakeTerrainToChunks())
    this.map.ready = true
    this.map.generationTimings = timings
  }

  async prepareBaseTerrain(
    context: GameContextLike,
    timer: Pick<GenerationTimer, 'measure' | 'timings'>,
    onProgress: ProgressCallback
  ): Promise<void> {
    this.map.gaia = new Gaia(context)
    if (this.map.pregeneratedBlueprintId) {
      timer.timings.relief = 0
    } else {
      await onProgress('generatingRelief', 0.28)
      timer.measure('relief', () => this.map.generateMapRelief())
    }
    await this.yieldToBrowser()
    timer.measure('terrainRendering', () => this.map.rebuildTerrainAppearance())
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
    if (this.map.gaia instanceof Gaia) {
      this.map.gaia.createAnimal(options)
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
