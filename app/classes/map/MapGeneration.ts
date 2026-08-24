import { Assets, type ContainerChild } from 'pixi.js'
import { Resource } from '../Resource'
import { Human, AI, Gaia, Player } from '../players'
import {
  colors,
  getZoneInGridWithCondition,
  updateInstanceVisibility,
  getGaiaAnimals,
  getBuildingFootprintCells,
  getBuildingFootprintRadius,
  getPlainCellsAroundPoint,
} from '../../lib'
import { rehydrateAIKnowledge } from '../../services/FogOfWar'
import { getIdealSpawnRangeForMapSize } from '../../config/mapSizes'
import {
  BUILDING_TYPES,
  FAMILY_TYPES,
  PLAYER_TYPES,
  POPULATION_MAX,
  RESOURCE_TYPES,
  UNIT_TYPES,
  getEnvironmentTerrainParams,
} from '../../constants'
import type { EnvironmentTerrainParams } from '../../constants'
import { Cell, GenerationCell } from '../cell'
import { MapBlueprintGeneration } from './MapBlueprintGeneration'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RuntimeMap } from '../../types/map'
import type { PlayerLike } from '../../types/player'
import type { PlayerOptions } from '../players/Player'
import type { ResourceOptions } from '../Resource'
import type { AnimalOptions } from '../animal'
import type { RuntimeEntity, ResourceEntity, BuildingEntity } from '../../types/entities'
import type { GameContextLike, MapRuntimeContext } from '../../types/context'
import type { AnimalConfig } from '../../types/config'
import type { TextureRef } from '../../lib'
import {
  processUnit,
  restoreAIState,
  restoreBuildingAssignments,
  restorePlayerEntitiesFromSave,
  restorePlayerViewsAndFog,
  restoreSelection,
  type SavedPlayer,
} from './MapSaveRestore'
import { ensureBanditCampOwner, placeBanditCamps } from './BanditCampGeneration'
import { applyCivilizationLevelStartingKit } from './CivilizationStartingKit'
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
import type { SaveCellState, SaveEntityState, SerializedSave } from '../../types/save'

type TerrainValue = 0 | 1 | 2 | 3 | 4 | 5 | 7
type BlueprintTerrainValue = TerrainValue | string
export type TerrainGrid = TerrainValue[][]
type GeneratedPosition = GridPosition | null
type GaiaRespawnSlot = SaveEntityState & {
  context: GameContextLike
  family: typeof FAMILY_TYPES.animal
  owner: PlayerLike
}

// Unowned, indestructible landmark: exactly one is placed per map, never tied to any player.
const PORTAL_RESOURCE_TYPE = 'Portal'
const PORTAL_FOOTPRINT_SIZE = 3
const STARTING_CIVILIAN_GENDERS: Array<'male' | 'female'> = ['male', 'male', 'female', 'female']
function createGaiaRespawnSlot(animal: SaveEntityState, context: GameContextLike, owner: PlayerLike): GaiaRespawnSlot {
  return {
    ...animal,
    context,
    family: FAMILY_TYPES.animal,
    isDestroyed: true,
    owner,
  }
}

function createGenerationTimer(timings: Record<string, number>) {
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
export type MapGenerationContext = MapRuntimeContext
// Mirrors the subset of the concrete `Map` class (app/classes/map/index.ts) API
// that MapGeneration relies on. Map can't be imported directly here: it imports
// MapGeneration itself, so importing it back would create a circular dependency.
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
  getChildByLabel(label: string): ContainerChild | null
  removeChild(child: ContainerChild): ContainerChild
}
type ResourceDefinition = {
  category?: string
  habitat?: string
}
type GameConfig = {
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
export type SavedGameData = Omit<SerializedSave, 'map' | 'players' | 'resources' | 'animals' | 'naturalResourceRespawnSlots'> & {
  map: SaveCellState[][]
  players: SavedPlayer[]
  camera: { x: number; y: number }
  resources: SaveEntityState[]
  naturalResourceRespawnSlots?: SaveEntityState[]
  animals: SaveEntityState[]
}
type ProgressCallback = (stage: string, progress: number) => Promise<void> | void
type GenerationTimer = ReturnType<typeof createGenerationTimer>
// Local view of the AI-only bookkeeping fields used while restoring saved games.
// These live on the concrete AI player instance but are not part of the shared
// PlayerLike contract, so we narrow to this shape only where we know (via the
// `player.type === PLAYER_TYPES.ai` guard) that we are dealing with an AI player.
type GeneratedMapChild = ContainerChild & Partial<RuntimeEntity>

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

function createResourceFromState(resource: ResourceOptions, map: MapGenerationMap): ResourceEntity {
  const resourceState =
    resource.type === RESOURCE_TYPES.wheat && resource.currentFrame == null && resource.startsMature == null
      ? { ...resource, startsMature: true }
      : resource
  const instance = map.addChild(new Resource(resourceState, runtimeContext(map.context)))
  if (instance.type === PORTAL_RESOURCE_TYPE) {
    getBuildingFootprintCells(instance.i, instance.j, map.grid, instance.size || PORTAL_FOOTPRINT_SIZE, cell => {
      cell.solid = true
      cell.has = instance
      return true
    })
  }
  return instance
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
    if (typeof Worker === 'undefined') {
      return Promise.resolve(this.generateTerrain(gridSize, seed, params))
    }
    const source = this.generateTerrain.toString()
    const functionSource = source.startsWith('function') ? `(${source})` : `(function ${source})`
    const workerSource = `
      const generateTerrain = ${functionSource};
      self.onmessage = ({ data }) => {
        try {
          const scope = { map: { seed: data.seed, positionsCount: data.positionsCount } };
          const terrain = generateTerrain.call(scope, data.gridSize, data.seed, data.params);
          self.postMessage({ terrain, seed: scope.map.seed });
        } catch (error) {
          self.postMessage({ error: error?.stack || error?.message || String(error) });
        }
      };
    `
    const url = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))
    return new Promise((resolve, reject) => {
      const worker = new Worker(url)
      const cleanup = () => {
        worker.terminate()
        URL.revokeObjectURL(url)
      }
      worker.onmessage = ({ data }) => {
        cleanup()
        if (data.error) {
          reject(new Error(data.error))
          return
        }
        this.map.seed = data.seed
        resolve(data.terrain)
      }
      worker.onerror = error => {
        cleanup()
        reject(error)
      }
      worker.postMessage({
        gridSize,
        seed,
        positionsCount: this.map.positionsCount,
        params,
      })
    })
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
    const classMap: Record<string, typeof Human | typeof AI | typeof Player> = {
      Human,
      AI,
      [PLAYER_TYPES.bandits]: Player,
    }
    const context = runtimeContext(this.map.context)
    this.map.context.players = players.map((player: SavedPlayer) => {
      const PlayerClass = classMap[player.type] ?? Player
      const restoredPlayer = new PlayerClass(
        {
          ...player,
          corpses: [],
          buildings: [],
          units: [],
          ...(player.type === PLAYER_TYPES.ai ? { difficulty: this.map.difficulty } : {}),
        },
        context
      )
      if (player.isPlayed) this.map.context.player = restoredPlayer
      return restoredPlayer
    })
    if (Number.isFinite(runtime?.elapsedMs) && this.map.context.scheduler) {
      this.map.context.scheduler.elapsedMs = Math.max(0, runtime?.elapsedMs ?? 0)
    }
  }

  restoreSavedResources(resources: SaveEntityState[], naturalResourceRespawnSlots?: SaveEntityState[]): void {
    this.map.resources = new Set(resources.map(resource => createResourceFromState(resource, this.map)))
    this.map.naturalResourceRespawnSlots = [...(naturalResourceRespawnSlots ?? [])]
  }

  restoreSavedEntities(players: SavedPlayer[], animals: SaveEntityState[], context: GameContextLike): void {
    this.map.context.players.forEach((player, index) => restorePlayerEntitiesFromSave(player, players[index]))
    const gaia = this.map.gaia instanceof Gaia ? this.map.gaia : null
    animals.forEach(animal => {
      if (!gaia) return
      if (animal.isDestroyed) (gaia.animals as unknown as GaiaRespawnSlot[]).push(createGaiaRespawnSlot(animal, context, gaia))
      else gaia.createAnimal(animal)
    })

    getGaiaAnimals(gaia)
      .filter(animal => !animal.isDestroyed)
      .forEach(animal => processUnit(animal, this.map))

    this.map.context.players.forEach((player, index) => {
      const savedPlayer = players[index]
      restorePlayerViewsAndFog(player, this.map)
      restoreBuildingAssignments(player, savedPlayer?.buildings || [], this.map)
      rehydrateAIKnowledge(player, this.map)
      restoreAIState(player, savedPlayer, this.map)
      player.units.forEach(unit => processUnit(unit, this.map))
      restoreSelection(player, savedPlayer, this.map)
    })
  }

  finishSavedStateRestore({ bakeTerrain = false }: { bakeTerrain?: boolean } = {}): void {
    this.map._fogInitComplete = true
    this.map._flushFogQueue()
    if (bakeTerrain) this.map.bakeTerrainToChunks()
    this.map.ready = true
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
    const { map, players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context
    this.map.removeChildren()
    this.map.clearRenderChunks()
    this.map.resetRandom()
    this.map.size = map.length - 1
    this.map.invalidateReliefCoastDistances()

    this.restoreSavedPlayers(players, runtime)

    this.map._initFogChunks()
    const gaia = new Gaia(context)
    this.map.gaia = gaia

    for (let i = 0; i <= this.map.size; i++) {
      const line = map[i]
      for (let j = 0; j <= this.map.size; j++) {
        if (!this.map.grid[i]) {
          this.map.grid[i] = []
        }
        const cell = line[j]
        const newCell = new Cell({ i, j, z: cell.z ?? 0, type: cell.type, fogSprites: cell.fogSprites ?? [] }, context)
        this.map.addChild(newCell)
        this.map.grid[i][j] = newCell
      }
    }
    this.map._indexFogChunkCells()

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.restoreSavedResources(resources, naturalResourceRespawnSlots)

    this.map.rebuildTerrainAppearance()

    if (!this.map.revealEverything) {
      for (let i = 0; i <= this.map.size; i++) {
        for (let j = 0; j <= this.map.size; j++) {
          this.map.grid[i][j].setFog()
        }
      }
    }

    controls?.setCamera?.(camera.x, camera.y, true)
    menu?.init?.()
    menu?.updateResourcesMiniMap()

    this.restoreSavedEntities(players, animals, context)
    this.finishSavedStateRestore({ bakeTerrain: true })
  }

  clearGeneratedGameplayState(): void {
    const dynamicFamilies = new Set([
      FAMILY_TYPES.animal,
      FAMILY_TYPES.building,
      FAMILY_TYPES.projectile,
      FAMILY_TYPES.resource,
      FAMILY_TYPES.unit,
    ])
    for (const child of [...(this.map.children || [])]) {
      if (!child.family || !dynamicFamilies.has(child.family)) continue
      child.stopInterval?.()
      child.stopTimeout?.()
      child.animalBehavior?.stop?.()
      child.isDestroyed = true
      this.map.removeChild(child)
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    for (const row of this.map.grid || []) {
      for (const cell of row || []) {
        cell.has = null
        cell.solid = false
        cell.corpses?.clear?.()
      }
    }
    this.map.resources = new Set()
    this.map.naturalResourceRespawnSlots = []
    this.map.instanceBuckets = null
    this.map.context.players = []
    this.map.context.player = null
    this.map.gaia = new Gaia(runtimeContext(this.map.context))
  }

  applySavedStateToGeneratedMap(data: SavedGameData): void {
    const { players, camera, resources, naturalResourceRespawnSlots, animals, runtime } = data
    const context = runtimeContext(this.map.context)
    const { menu, controls } = context

    this.clearGeneratedGameplayState()
    this.restoreSavedPlayers(players, runtime)

    this.restoreSavedResources(resources, naturalResourceRespawnSlots)

    controls?.setCamera?.(camera.x, camera.y, true)
    menu?.init?.()
    menu?.updateResourcesMiniMap()

    this.restoreSavedEntities(players, animals, context)
    this.finishSavedStateRestore()
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
    const age = configuredAge == null ? this.map.startingAge : configuredAge
    const startingAge = Math.max(0, Math.min(Number(age) || 0, 3))
    player.age = startingAge

    if (!this.map.allTechnologies) return

    player.autoTechnologyByAge = true
    player.applyEligibleTechnologies?.()
  }

  generatePlayers(playersConfig: Array<PlayerOptions> | null = null): PlayerLike[] {
    const context = runtimeContext(this.map.context)

    const players: PlayerLike[] = []
    this.map.banditCampPositions = []
    const poses: number[] = []
    const randoms = Array.from(Array(this.map.playersPos.length).keys())

    for (let i = 0; i < this.map.playersPos.length; i++) {
      const pos = this.map.randomItem(randoms)
      poses.push(pos)
      randoms.splice(randoms.indexOf(pos), 1)
    }

    const playerCount = Math.min(playersConfig?.length || 1, this.map.playersPos.length)
    for (let i = 0; i < playerCount; i++) {
      const posI = this.map.playersPos[poses[i]]?.i
      const posJ = this.map.playersPos[poses[i]]?.j
      if (posI != null && posJ != null) {
        const color = playersConfig?.[i]?.color ?? colors[i]
        const civ = playersConfig?.[i]?.civ ?? 'Greek'
        const factionId = playersConfig?.[i]?.factionId ?? null
        const gender = playersConfig?.[i]?.gender
        const team = playersConfig?.[i]?.team ?? null
        const diplomacy = playersConfig?.[i]?.diplomacy ?? null
        const name = playersConfig?.[i]?.name
        const civilizationLevel = Math.max(0, Math.min(Number(playersConfig?.[i]?.civilizationLevel) || 0, 3))
        if (!i) {
          players.push(
            new Human(
              {
                i: posI,
                j: posJ,
                age: 0,
                civ,
                color,
                diplomacy,
                factionId,
                gender,
                team,
                name,
                isPlayed: true,
                civilizationLevel,
              },
              context
            )
          )
        } else if (!this.map.noAI) {
          this.map.banditCampPositions.push({ i: posI, j: posJ })
        }
      }
    }

    if (!this.map.noAI && this.map.banditCampPositions.length) {
      const anchor = this.map.banditCampPositions[0]
      const human = players.find(player => player.isPlayed)
      ensureBanditCampOwner(this.map, context, anchor, human?.civ ?? 'Greek', players)
    }

    players
      .filter(player => player.type !== PLAYER_TYPES.bandits)
      .forEach((player, index) =>
        this.applyStartingBonuses(
          player,
          playersConfig?.[index]?.age ?? playersConfig?.[index]?.civilizationLevel ?? null
        )
      )

    return players
  }

  placePlayers(): void {
    const {
      context: { players },
    } = this.map

    for (let i = 0; i < players.length; i++) {
      const player = players[i]
      if (player.type === PLAYER_TYPES.bandits) continue
      if (player.isPlayed && this.map.humanStartsWithoutBase) {
        player.createUnit?.({ i: player.i, j: player.j, type: UNIT_TYPES.hero })
        continue
      }
      const towncenter = player.spawnBuilding?.({
        i: player.i,
        j: player.j,
        type: BUILDING_TYPES.townCenter,
        isBuilt: true,
      })
      if (!towncenter) continue
      const hasStartingLeader = player.type === PLAYER_TYPES.ai || player.isPlayed
      const startingCivilianCount = Math.max(this.map.startingUnits, STARTING_CIVILIAN_GENDERS.length)
      const requiredStartingPopulation = startingCivilianCount + (hasStartingLeader ? 1 : 0)
      player.populationMax = Math.max(player.populationMax, Math.min(POPULATION_MAX, requiredStartingPopulation))
      if (player.type === PLAYER_TYPES.ai) {
        towncenter.placeUnit?.(UNIT_TYPES.chief)
      } else if (player.isPlayed) {
        towncenter.placeUnit?.(UNIT_TYPES.villager)
      }
      for (let i = 0; i < startingCivilianCount; i++) {
        const gender = STARTING_CIVILIAN_GENDERS[i % STARTING_CIVILIAN_GENDERS.length]
        towncenter.placeUnit?.(UNIT_TYPES.villager, { gender, appearanceVariants: { gender } })
      }
      if (player.civilizationLevel) {
        this.applyCivilizationLevelStartingKit(player, player.civilizationLevel, towncenter)
      }
    }
  }

  placeBanditCamps(): void {
    placeBanditCamps(this.map, runtimeContext(this.map.context))
  }

  // Spawns a player already at an advanced stage: extra economy/military buildings, a static wall
  // perimeter, consistent technologies, a resource cushion and a few soldiers stationed near home.
  // Building/unit counts are read straight from the AI's own long-term per-age targets
  // (MAX_BUILDING_BY_AGE, MAX_*_BY_AGE) so no new tuning numbers are invented here.
  applyCivilizationLevelStartingKit(player: PlayerLike, level: number, townCenter: BuildingEntity): void {
    applyCivilizationLevelStartingKit(this.map, player, level, townCenter)
  }

  generateCells(): void {
    const context = runtimeContext(this.map.context)
    const z = 0
    this.map.grid = []
    this.map.invalidateReliefCoastDistances()
    const terrain = this.map.generateTerrain(
      this.map.size ? this.map.size + 1 : 121,
      this.map.seed == null ? undefined : Number(this.map.seed),
      getEnvironmentTerrainParams(this.map.environment)
    )
    this.map.size = terrain.length - 1

    const terrainMap: Record<TerrainValue, string> = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
      4: 'DarkForest',
      5: 'Dirt',
      7: 'Snow',
    }

    for (let i = 0; i <= this.map.size; i++) {
      if (!this.map.grid[i]) this.map.grid[i] = []
      for (let j = 0; j <= this.map.size; j++) {
        const type = terrainMap[terrain[i][j]]
        const cell = new Cell({ i, j, z, type }, context)
        this.map.addChild(cell)
        this.map.grid[i][j] = cell
      }
    }

    this.map.fillWaterGaps()
    this.map.normalizeWaterTopology()
    this.map.formatCellsWaterBorder()
  }

  async generateTerrainDataAsync(): Promise<TerrainGrid> {
    const terrainStartedAt = performance.now()
    const gridSize = this.map.size ? this.map.size + 1 : 121
    const seed = this.map.seed == null ? Math.random() * 9999 : Number(this.map.seed)
    const params = getEnvironmentTerrainParams(this.map.environment)
    let terrain: TerrainGrid
    try {
      terrain = await this.generateTerrainInWorker(gridSize, seed, params)
    } catch (error) {
      console.warn('Terrain worker unavailable, falling back to main thread', error)
      terrain = this.map.generateTerrain(gridSize, seed, params)
    }
    this.map.context.performance?.record('terrainData', performance.now() - terrainStartedAt)
    return terrain
  }

  async generateCellsAsync({
    onProgress = async (_stage: string, _progress: number) => {},
    terrain: preparedTerrain = null,
  }: GenerateMapOptions = {}): Promise<void> {
    const context = runtimeContext(this.map.context)
    const z = 0
    this.map.grid = []
    this.map.invalidateReliefCoastDistances()
    const terrain: TerrainGrid = preparedTerrain || (await this.generateTerrainDataAsync())
    this.map.size = terrain.length - 1

    const terrainMap: Record<number, string> = {
      0: 'Grass',
      1: 'Desert',
      2: 'Water',
      3: 'Jungle',
      4: 'DarkForest',
      5: 'Dirt',
      7: 'Snow',
    }
    const startedAt = performance.now()
    for (let i = 0; i <= this.map.size; i++) {
      const row: RuntimeCell[] = []
      this.map.grid[i] = row
      for (let j = 0; j <= this.map.size; j++) {
        const cell = new GenerationCell({ i, j, z, type: terrainMap[terrain[i][j]] }, context)
        row[j] = cell
      }
      if (i % 8 === 0) {
        await onProgress('loadingPregeneratedMap', 0.03 + (i / this.map.size) * 0.14)
        await this.yieldToBrowser()
      }
    }
    this.map.context.performance?.record('cellCreation', performance.now() - startedAt)

    this.map.fillWaterGaps()
    await this.yieldToBrowser()
    this.map.normalizeWaterTopology()
    await this.yieldToBrowser()
    this.map.formatCellsWaterBorder()
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
    let resolvedSeed = seed
    if (resolvedSeed == null) resolvedSeed = Math.random() * 9999
    this.map.seed = resolvedSeed

    function hash(x: number, y: number): number {
      const n = Math.sin(x * 127.1 + y * 311.7 + resolvedSeed! * 3.7) * 43758.5453
      return n - Math.floor(n)
    }

    function noise(x: number, y: number): number {
      const xi = Math.floor(x),
        yi = Math.floor(y)
      const xf = x - xi,
        yf = y - yi
      const smooth = (t: number) => t * t * (3 - 2 * t)
      const u = smooth(xf),
        v = smooth(yf)
      const a = hash(xi, yi),
        b = hash(xi + 1, yi)
      const c = hash(xi, yi + 1),
        d = hash(xi + 1, yi + 1)
      return a + (b - a) * u + (c - a) * v + (d + a - b - c) * u * v
    }

    function fbm(x: number, y: number, octaves: number = 5): number {
      let val = 0,
        amp = 0.5,
        freq = 1,
        sum = 0
      for (let o = 0; o < octaves; o++) {
        val += noise(x * freq, y * freq) * amp
        sum += amp
        amp *= 0.5
        freq *= 2
      }
      return val / sum
    }

    const scale = 4 / gridSize
    const half = gridSize / 2

    // Plateau + narrow falloff: the inner 85% radius (~72% of the map's area) is fully
    // land-biased and untouched by edge proximity, so the coastline forms from a thin band
    // near the border instead of eating into the interior. There are no boats to reach
    // stray islands, so the map should read as one big landmass, not a natural archipelago.
    const falloffPlateau = 0.85
    function radialFalloff(i: number, j: number): number {
      const dx = (i - half) / half
      const dy = (j - half) / half
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist <= falloffPlateau) return 1
      const t = Math.min(1, (dist - falloffPlateau) / (1 - falloffPlateau))
      return 1 - t * t * (3 - 2 * t)
    }

    // One map = one environment: `groundType` is the single ground type covering this
    // environment's non-water land (see EnvironmentTerrainParams) — water sparsity,
    // patchwork shapes and lakes come from `params` too. The default below (used only if
    // a caller omits `params` entirely) matches Temperate.
    const terrainValueByType = {
      Grass: 0,
      Desert: 1,
      Jungle: 3,
      DarkForest: 4,
      Dirt: 5,
      Snow: 7,
    } satisfies Record<'Grass' | 'Desert' | 'Jungle' | 'DarkForest' | 'Dirt' | 'Snow', TerrainValue>
    const groundTypeValue = terrainValueByType[params.groundType ?? 'Grass']
    const height = new Float32Array(gridSize * gridSize)
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        height[i * gridSize + j] = fbm(i * scale, j * scale)
      }
    }

    const waterThreshold = 0.28

    const terrainMap: TerrainGrid = []
    const borderWaterWidth = Math.max(4, Math.floor(gridSize * 0.04))
    for (let i = 0; i < gridSize; i++) {
      terrainMap[i] = []
      for (let j = 0; j < gridSize; j++) {
        let h = height[i * gridSize + j]
        const fo = radialFalloff(i, j)

        h += (fo - 0.5) * 0.75

        terrainMap[i][j] = h < waterThreshold ? 2 : groundTypeValue
      }
    }

    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < gridSize - 1; i++) {
        for (let j = 1; j < gridSize - 1; j++) {
          const wn =
            (terrainMap[i - 1][j] === 2 ? 1 : 0) +
            (terrainMap[i + 1][j] === 2 ? 1 : 0) +
            (terrainMap[i][j - 1] === 2 ? 1 : 0) +
            (terrainMap[i][j + 1] === 2 ? 1 : 0)
          if (terrainMap[i][j] !== 2 && wn >= 3) terrainMap[i][j] = 2
          if (terrainMap[i][j] === 2 && wn <= 1) terrainMap[i][j] = groundTypeValue
        }
      }
    }

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        if (
          i < borderWaterWidth ||
          j < borderWaterWidth ||
          i >= gridSize - borderWaterWidth ||
          j >= gridSize - borderWaterWidth
        ) {
          terrainMap[i][j] = 2
        }
      }
    }

    // There are no boats: drown every land component except the largest one so the map
    // is a single reachable landmass instead of a mainland dotted with useless islets.
    function removeDisconnectedLand(): void {
      const visited = new Uint8Array(gridSize * gridSize)
      let bestComponent: number[] | null = null
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const start = i * gridSize + j
          if (terrainMap[i][j] === 2 || visited[start]) continue
          visited[start] = 1
          const component = [start]
          const stack = [start]
          while (stack.length) {
            const idx = stack.pop()!
            const ci = Math.floor(idx / gridSize)
            const cj = idx % gridSize
            // Plain index access, not array destructuring: this method's compiled body is
            // extracted via .toString() and run inside a Web Worker in total isolation
            // (see generateTerrainInWorker) — destructuring a tuple here compiles to a
            // call to Babel's `_slicedToArray` helper, which only exists in the surrounding
            // bundle and is undefined inside the worker, throwing a ReferenceError there.
            const neighbors: [number, number][] = [
              [ci - 1, cj],
              [ci + 1, cj],
              [ci, cj - 1],
              [ci, cj + 1],
            ]
            for (let neighborIndex = 0; neighborIndex < neighbors.length; neighborIndex++) {
              const ni = neighbors[neighborIndex][0]
              const nj = neighbors[neighborIndex][1]
              if (ni < 0 || nj < 0 || ni >= gridSize || nj >= gridSize) continue
              const nIdx = ni * gridSize + nj
              if (visited[nIdx] || terrainMap[ni][nj] === 2) continue
              visited[nIdx] = 1
              component.push(nIdx)
              stack.push(nIdx)
            }
          }
          if (!bestComponent || component.length > bestComponent.length) bestComponent = component
        }
      }
      if (!bestComponent) return
      const mainland = new Uint8Array(gridSize * gridSize)
      // Plain indexed loop, not for...of: same worker-isolation constraint as above —
      // Babel can compile even a guaranteed-array for...of down to a call to its
      // `_createForOfIteratorHelper` runtime helper, which is equally undefined inside
      // the isolated worker scope.
      for (let componentIndex = 0; componentIndex < bestComponent.length; componentIndex++) {
        mainland[bestComponent[componentIndex]] = 1
      }
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (terrainMap[i][j] !== 2 && !mainland[i * gridSize + j]) terrainMap[i][j] = 2
        }
      }
    }
    removeDisconnectedLand()

    function forceOuterWater(): void {
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          if (
            i < borderWaterWidth ||
            j < borderWaterWidth ||
            i >= gridSize - borderWaterWidth ||
            j >= gridSize - borderWaterWidth
          ) {
            terrainMap[i][j] = 2
          }
        }
      }
    }

    function featureCount(baseCount: number): number {
      return Math.max(0, Math.round(baseCount * Math.max(1, gridSize / 144)))
    }

    function randomRange(min: number, max: number, salt: number): number {
      return min + hash(salt * 12.9898 + 78.233, salt * 37.719 + 11.17) * (max - min)
    }

    function randomInt(min: number, max: number, salt: number): number {
      return Math.floor(randomRange(min, max + 1, salt))
    }

    function normalizedShapeDistance(di: number, dj: number, radius: number, shapeIndex: number): number {
      const angle = Math.atan2(dj, di)
      const rx = radius * (shapeIndex === 1 ? 1.35 : shapeIndex === 2 ? 0.85 : 1.05)
      const ry = radius * (shapeIndex === 1 ? 0.85 : shapeIndex === 2 ? 1.25 : 0.95)
      const bend = shapeIndex === 3 ? Math.sin(angle * 2) * radius * 0.18 : 0
      const x = (di + bend) / rx
      const y = (dj - (shapeIndex === 2 ? Math.cos(angle) * radius * 0.12 : 0)) / ry
      return Math.sqrt(x * x + y * y)
    }

    function isInteriorNonWaterTerrainCell(i: number, j: number, margin = 2): boolean {
      return (
        i >= borderWaterWidth + margin &&
        j >= borderWaterWidth + margin &&
        i < gridSize - borderWaterWidth - margin &&
        j < gridSize - borderWaterWidth - margin &&
        terrainMap[i]?.[j] !== 2
      )
    }

    function applyGroundPatch(
      centerI: number,
      centerJ: number,
      radius: number,
      terrainValue: TerrainValue,
      salt: number
    ): void {
      const shapeIndex = randomInt(0, 3, salt + 17)
      const lobeCount = randomInt(1, 3, salt + 23)
      const lobeAngles = [randomRange(0, Math.PI * 2, salt + 31), randomRange(0, Math.PI * 2, salt + 37)]
      const lobeOffsets = [
        randomRange(radius * 0.18, radius * 0.42, salt + 41),
        randomRange(radius * 0.16, radius * 0.36, salt + 43),
      ]
      const lobeRadii = [
        randomRange(radius * 0.42, radius * 0.72, salt + 47),
        randomRange(radius * 0.34, radius * 0.58, salt + 53),
      ]
      const maxRadius = Math.ceil(radius * 2)
      const patchCells: Array<[number, number]> = []
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (!isInteriorNonWaterTerrainCell(ni, nj)) continue
          let edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          for (let lobeIndex = 0; lobeIndex < lobeCount - 1; lobeIndex++) {
            const angle = lobeAngles[lobeIndex]
            const li = Math.cos(angle) * lobeOffsets[lobeIndex]
            const lj = Math.sin(angle) * lobeOffsets[lobeIndex]
            edge = Math.min(edge, normalizedShapeDistance(di - li, dj - lj, lobeRadii[lobeIndex], shapeIndex))
          }
          const angle = Math.atan2(dj, di)
          const contour =
            Math.sin(angle * 2 + randomRange(-Math.PI, Math.PI, salt + 59)) * 0.1 +
            Math.sin(angle * 5 + randomRange(-Math.PI, Math.PI, salt + 61)) * 0.06
          const coarseNoise = (hash(ni * 0.37 + salt, nj * 0.37 - salt) - 0.5) * 0.28
          const fineNoise = (hash(ni * 1.17 - salt, nj * 1.17 + salt) - 0.5) * 0.16
          const porousEdge = edge > 0.72 && hash(ni * 2.19 + salt, nj * 2.19 - salt) < (edge - 0.72) * 0.45
          if (edge + contour + coarseNoise + fineNoise <= 1 && !porousEdge) {
            patchCells.push([ni, nj])
          }
        }
      }
      const shouldKeep = (i: number, j: number): boolean => {
        let neighbours = 0
        for (let ai = -1; ai <= 1; ai++) {
          for (let aj = -1; aj <= 1; aj++) {
            if (ai === 0 && aj === 0) continue
            if (terrainMap[i + ai]?.[j + aj] === terrainValue) neighbours++
          }
        }
        return neighbours >= 2
      }
      for (let index = 0; index < patchCells.length; index++) {
        const cell = patchCells[index]
        terrainMap[cell[0]][cell[1]] = terrainValue
      }
      for (let index = 0; index < patchCells.length; index++) {
        const cell = patchCells[index]
        if (!shouldKeep(cell[0], cell[1])) terrainMap[cell[0]][cell[1]] = groundTypeValue
      }
    }

    function applyLake(
      centerI: number,
      centerJ: number,
      radius: number,
      shoreRadius: number,
      shoreValue: TerrainValue | null,
      salt: number
    ): void {
      const shapeIndex = randomInt(0, 3, salt + 29)
      const maxRadius = Math.ceil(radius + shoreRadius + 2)
      const lakeCells: Array<[number, number]> = []
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (
            ni < borderWaterWidth + maxRadius ||
            nj < borderWaterWidth + maxRadius ||
            ni >= gridSize - borderWaterWidth - maxRadius ||
            nj >= gridSize - borderWaterWidth - maxRadius
          ) {
            continue
          }
          const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          const roughness = (hash(ni * 0.51 + salt, nj * 0.51 - salt) - 0.5) * 0.28
          if (edge + roughness <= 1) {
            lakeCells.push([ni, nj])
            terrainMap[ni][nj] = 2
          }
        }
      }
      if (!lakeCells.length || shoreValue == null || shoreRadius <= 0) return
      for (let di = -maxRadius; di <= maxRadius; di++) {
        for (let dj = -maxRadius; dj <= maxRadius; dj++) {
          const ni = centerI + di
          const nj = centerJ + dj
          if (!isInteriorNonWaterTerrainCell(ni, nj)) continue
          const edge = normalizedShapeDistance(di, dj, radius, shapeIndex)
          const roughness = (hash(ni * 0.61 + salt, nj * 0.61 - salt) - 0.5) * 0.35
          if (edge > 1 && edge <= 1 + shoreRadius / Math.max(radius, 1) + roughness) terrainMap[ni][nj] = shoreValue
        }
      }
    }

    // Lakes are carved first so patchwork (right below) can see them and steer Dirt
    // clear of any shoreline — Dirt and Desert relief borders look fine on their own,
    // but the two don't compose where they'd have to meet at the same cell.
    const lakes = params.lakes
    if (lakes && lakes.count > 0) {
      const shoreValue = lakes.shoreType ? terrainValueByType[lakes.shoreType] : null
      for (let index = 0; index < featureCount(lakes.count); index++) {
        const salt = 5000 + index * 43
        const margin = borderWaterWidth + Math.ceil(lakes.maxRadius + lakes.shoreRadius) + 5
        const centerI = randomInt(margin, gridSize - margin - 1, salt)
        const centerJ = randomInt(margin, gridSize - margin - 1, salt + 11)
        const radius = randomRange(lakes.minRadius, lakes.maxRadius, salt + 19)
        applyLake(centerI, centerJ, radius, lakes.shoreRadius, shoreValue, salt)
      }
    }

    function hasWaterWithin(centerI: number, centerJ: number, distance: number): boolean {
      const r = Math.ceil(distance)
      const distanceSq = distance * distance
      for (let di = -r; di <= r; di++) {
        for (let dj = -r; dj <= r; dj++) {
          if (di * di + dj * dj > distanceSq) continue
          if (terrainMap[centerI + di]?.[centerJ + dj] === 2) return true
        }
      }
      return false
    }

    const patchwork = params.patchwork
    if (patchwork && patchwork.count > 0) {
      const terrainValue = terrainValueByType[patchwork.terrainType]
      // Desert's own patchwork/lakes use Jungle and are meant to hug water (the oasis
      // look); Dirt/Snow need to stay clear of the desert-styled water border.
      const requireWaterClearance = patchwork.terrainType === 'Dirt' || patchwork.terrainType === 'Snow'
      for (let index = 0; index < featureCount(patchwork.count); index++) {
        const salt = 1000 + index * 31
        const margin = borderWaterWidth + Math.ceil(patchwork.maxRadius) + 4
        const radius = randomRange(patchwork.minRadius, patchwork.maxRadius, salt + 13)
        const waterClearance = Math.ceil(radius * 1.5) + 3
        let centerI = 0
        let centerJ = 0
        let placed = false
        for (let attempt = 0; attempt < 12; attempt++) {
          const attemptSalt = salt + attempt * 101
          centerI = randomInt(margin, gridSize - margin - 1, attemptSalt)
          centerJ = randomInt(margin, gridSize - margin - 1, attemptSalt + 7)
          if (!requireWaterClearance || !hasWaterWithin(centerI, centerJ, waterClearance)) {
            placed = true
            break
          }
        }
        if (placed) applyGroundPatch(centerI, centerJ, radius, terrainValue, salt)
      }
    }

    forceOuterWater()

    return terrainMap
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
    const { map } = this
    if ([...map.resources].some(resource => resource.type === PORTAL_RESOURCE_TYPE)) return

    // Same footprint convention as a size-3 building (3x3), matching the structure's visual size.
    const footprintRadius = getBuildingFootprintRadius(PORTAL_FOOTPRINT_SIZE)
    const isValidFootprint = (i: number, j: number, radius: number): boolean => {
      const centerZ = map.grid[i]?.[j]?.z
      if (centerZ === undefined) return false
      const cells = getPlainCellsAroundPoint(i, j, map.grid, radius)
      if (cells.length !== (radius * 2 + 1) ** 2) return false
      return cells.every(
        cell =>
          !cell.solid && !cell.has && cell.category !== 'Water' && !cell.border && !cell.inclined && cell.z === centerZ
      )
    }
    const center = Math.round(map.size / 2)
    const border = 10
    const playerSafeDistanceSq = 15 ** 2
    let position: GridPosition | null = null
    // Prefer breathing room beyond the footprint so it's not immediately hugged by trees/resources,
    // but relax that in dense biomes rather than fail outright — the footprint itself always stays clear.
    for (const clearance of [3, 2, 1, 0]) {
      for (let attempt = 0; attempt < 300; attempt++) {
        const i = attempt === 0 ? center : map.randomRange(border, map.size - border)
        const j = attempt === 0 ? center : map.randomRange(border, map.size - border)
        if (!isValidFootprint(i, j, footprintRadius + clearance)) continue
        const tooCloseToPlayer = map.playersPos.some(
          pos => pos && (pos.i - i) ** 2 + (pos.j - j) ** 2 < playerSafeDistanceSq
        )
        if (tooCloseToPlayer) continue
        position = { i, j }
        break
      }
      if (position) break
    }
    if (!position) return

    const context = runtimeContext(map.context)
    const portal = map.addChild(
      new Resource({ i: position.i, j: position.j, type: PORTAL_RESOURCE_TYPE, size: PORTAL_FOOTPRINT_SIZE }, context)
    )
    map.resources.add(portal)
    getBuildingFootprintCells(position.i, position.j, map.grid, PORTAL_FOOTPRINT_SIZE, cell => {
      cell.solid = true
      cell.has = portal
      return true
    })
  }

  findPlayerPlaces() {
    const results: GridPosition[] = []
    const N = this.map.positionsCount
    const searchHalf = Math.max(6, Math.floor(this.map.size * 0.06))
    const zoneRadius = this.map.size < 64 ? 2 : 5
    const border = Math.min(12, Math.max(2, Math.floor(this.map.size * 0.08)))
    let minDistance = Math.max(16, Math.floor((this.map.size / Math.max(N, 2)) * 0.55))

    const farEnoughFromOtherSpawns = (position: GridPosition) =>
      results.every(
        existing => !existing || (existing.i - position.i) ** 2 + (existing.j - position.j) ** 2 >= minDistance ** 2
      )

    const canUseCell = (cell: RuntimeCell) => !cell.border && !cell.solid && !cell.inclined && cell.category !== 'Water'

    for (let index = 0; index < N; index++) {
      let found = null

      for (let relaxation = 0; relaxation < 3 && !found; relaxation++) {
        const attempts = 80
        for (let attempt = 0; attempt < attempts && !found; attempt++) {
          const ci = this.map.randomRange(border, this.map.size - border)
          const cj = this.map.randomRange(border, this.map.size - border)
          const candidate = getZoneInGridWithCondition(
            {
              minX: Math.max(border, ci - searchHalf),
              maxX: Math.min(this.map.size - border, ci + searchHalf),
              minY: Math.max(border, cj - searchHalf),
              maxY: Math.min(this.map.size - border, cj + searchHalf),
            },
            this.map.grid,
            zoneRadius,
            canUseCell
          )
          if (candidate && farEnoughFromOtherSpawns(candidate)) found = candidate
        }
        minDistance = Math.max(10, Math.floor(minDistance * 0.75))
      }

      if (!found) {
        found = getZoneInGridWithCondition(
          {
            minX: border,
            maxX: this.map.size - border,
            minY: border,
            maxY: this.map.size - border,
          },
          this.map.grid,
          zoneRadius,
          canUseCell
        )
      }

      if (found) results.push(found)
    }

    return results
  }
}
