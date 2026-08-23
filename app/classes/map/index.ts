import { Assets, Container, Graphics, TilingSprite, type ContainerChild, type Texture, type Ticker } from 'pixi.js'
import { BUCKET_SIZE, CELL_HEIGHT, CELL_WIDTH, getEnvironmentTerrainParams } from '../../constants'
import type { EnvironmentTerrainParams } from '../../constants'
import {
  MapGeneration,
  type GenerateMapOptions,
  type MapBlueprint,
  type SavedGameData,
  type TerrainGrid,
} from './MapGeneration'
import { MapResources, type ResourceDensity } from './MapResources'
import { MapTerrain, type ReliefLevelBounds } from './MapTerrain'
import { MapFog } from './MapFog'
import { getTextureByFrame } from '../../lib'
import { createSeededRandom } from '../../lib/random'
import { rectangleIntersectsViewport } from '../../lib/graphics/chunkCulling'
import { TerrainChunkManager, type ChunkedTerrainMap } from './TerrainChunkManager'
import type { ResourceAmount } from '../../types/common'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RenderChunk } from '../../types/map'
import type { ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { Viewport, Bounds } from '../../types/geometry'
import type { PlayerSetupConfig } from '../../types/save'
import type { SaveEntityState } from '../../types/save'
import type { GameContextLike } from '../../types/context'

export type MapContext = Omit<
  Partial<GameContextLike>,
  'controls' | 'map' | 'menu' | 'performance' | 'player' | 'players' | 'scheduler'
> & {
  controls?: GameContextLike['controls'] | null
  map?: GameContextLike['map'] | null
  menu?: GameContextLike['menu'] | null
  performance?: GameContextLike['performance'] | null
  player?: PlayerLike | null
  players: PlayerLike[]
  scheduler?: GameContextLike['scheduler'] | null
}
type InstanceBuckets = Array<Array<Set<RuntimeEntity>>>
type GeneratedPosition = GridPosition | null
type WaterOverlayTicker = {
  add: (tick: (ticker: Ticker) => void) => void
  remove: (tick: (ticker: Ticker) => void) => void
}
type WaterBorderSurface = { sprite: { texture: Texture; destroyed?: boolean }; frames: Texture[] }

const WATER_OVERLAY_SHEET = 'water-surface-filter'
const WATER_OVERLAY_FRAME_COUNT = 4
const WATER_OVERLAY_FRAME_SPEED = 0.03
const WATER_OVERLAY_ALPHA = 0.32
const WATER_OVERLAY_MARGIN = CELL_WIDTH * 2
const WATER_BACKGROUND_Z_INDEX = -3
const WATER_OVERLAY_Z_INDEX = -2.5

function getWaterOverlayFrames(): Texture[] {
  if (!Assets.cache.has(WATER_OVERLAY_SHEET)) return []
  return Array.from({ length: WATER_OVERLAY_FRAME_COUNT }, (_, index) =>
    getTextureByFrame(WATER_OVERLAY_SHEET, index, Assets)
  )
}

function getPingPongFrameIndex(frame: number, frameCount: number): number {
  if (frameCount <= 1) return 0
  const cycleLength = (frameCount - 1) * 2
  const cycleFrame = frame % cycleLength
  return cycleFrame < frameCount ? cycleFrame : cycleLength - cycleFrame
}

function compactPositions(positions: GeneratedPosition[]): GridPosition[] {
  return positions.filter((position): position is GridPosition =>
    Boolean(position && Number.isFinite(position.i) && Number.isFinite(position.j))
  )
}

export default class Map extends Container {
  context: MapContext
  size: number
  seed?: string | number
  mapType?: string
  environment?: string
  chanceOfSets: number
  ready: boolean
  grid: RuntimeCell[][]
  allTechnologies: boolean
  startingAge: number
  noAI: boolean
  humanStartsWithoutBase: boolean
  instantMode: boolean
  difficulty: string
  startingResources: ResourceAmount
  resourceDensity: ResourceDensity
  revealEverything: boolean
  revealTerrain: boolean
  showResources: boolean
  debugSolidVisible: boolean
  debugPathVisible: boolean
  debugVisionVisible: boolean
  debugGridVisible: boolean
  debugCoordsVisible: boolean
  debugPerfVisible: boolean
  debugEntityBarsVisible: boolean
  startingUnits: number
  playersPos: GeneratedPosition[]
  banditCampPositions: GridPosition[]
  positionsCount: number
  gaia: PlayerLike | null
  resources: Set<ResourceEntity>
  naturalResourceRespawnSlots: SaveEntityState[]
  instanceBuckets: InstanceBuckets | null
  renderChunks: RenderChunk[]
  _random: () => number
  mapGeneration: MapGeneration
  mapResources: MapResources
  mapTerrain: MapTerrain
  mapFog: MapFog
  terrainChunkManager: TerrainChunkManager
  shadowLayer: Container
  waterOverlay: TilingSprite | null
  waterOverlayFrame: number
  waterOverlayElapsed: number
  waterOverlayTick: ((ticker: Ticker) => void) | null
  waterBorderSurfaces: Set<WaterBorderSurface>
  waterBackground: Graphics | null

  visibleRenderChunkCount?: number

  constructor(context: MapContext) {
    super()

    this.context = context
    this.size = 0
    this.chanceOfSets = 0

    this.ready = false
    this.grid = []
    this.sortableChildren = true

    this.allTechnologies = false
    this.startingAge = 0
    this.noAI = false
    this.humanStartsWithoutBase = false

    this.instantMode = false
    this.difficulty = 'medium'
    this.startingResources = { wood: 200, food: 200, stone: 150, gold: 0, copper: 0, iron: 0 }
    this.resourceDensity = 'moderate'
    this.revealEverything = false
    this.revealTerrain = false
    this.showResources = true
    this.debugSolidVisible = false
    this.debugPathVisible = false
    this.debugVisionVisible = false
    this.debugGridVisible = false
    this.debugCoordsVisible = false
    this.debugPerfVisible = false
    this.debugEntityBarsVisible = false

    this.x = 0
    this.y = 0
    this.startingUnits = 3

    this.playersPos = []
    this.banditCampPositions = []
    this.positionsCount = 2
    this.gaia = null
    this.resources = new Set()
    this.naturalResourceRespawnSlots = []
    this.instanceBuckets = null
    this.renderChunks = []
    this._random = Math.random

    this.eventMode = 'auto'

    this.mapGeneration = new MapGeneration(this)
    this.mapResources = new MapResources(this)
    this.mapTerrain = new MapTerrain(this)
    this.mapFog = new MapFog(this)
    this.terrainChunkManager = new TerrainChunkManager(this as ChunkedTerrainMap)
    this.shadowLayer = new Container()
    this.shadowLayer.eventMode = 'none'
    this.shadowLayer.label = 'shadow-source-layer'
    this.shadowLayer.sortableChildren = true
    this.waterOverlay = null
    this.waterOverlayFrame = 0
    this.waterOverlayElapsed = 0
    this.waterOverlayTick = null
    this.waterBorderSurfaces = new Set()
    this.waterBackground = null
  }

  resetRandom(stream: number | string = 0): void {
    this._random = createSeededRandom(`${this.seed}:${stream}`)
  }

  random(): number {
    return this._random()
  }

  randomRange(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1) + min)
  }

  randomItem<T>(items: T[] = []): T {
    return items[Math.floor(this.random() * items.length)]
  }

  setCoordinate(x: number, y: number): void {
    // Keep camera movement smooth; rounding here reintroduces visible jitter on pixel-art sprites.
    this.x = x
    this.y = y
  }

  clearRenderChunks(): void {
    this.renderChunks.length = 0
  }

  registerRenderChunk(displayObjects: ContainerChild | ContainerChild[], bounds: Bounds): RenderChunk {
    const chunk = {
      displayObjects: Array.isArray(displayObjects) ? displayObjects : [displayObjects],
      bounds,
      renderable: true,
    }
    this.renderChunks.push(chunk)
    return chunk
  }

  updateRenderChunks(viewport: Viewport, margin: number = CELL_WIDTH * 2): void {
    this.updateWaterOverlay()
    if (this.terrainChunkManager?.chunks.size) {
      this.context.performance?.measure?.('terrainChunks.update', () => this.terrainChunkManager.update(viewport))
    }
    if (!this.revealEverything) this.mapFog?.viewportRenderer.update(viewport)

    const startedAt = performance.now()
    try {
      if (!viewport || !this.renderChunks.length) return

      let visibleCount = 0
      for (const chunk of this.renderChunks) {
        const renderable = rectangleIntersectsViewport(chunk.bounds, viewport, margin)
        if (renderable) visibleCount++
        if (chunk.renderable === renderable) continue

        chunk.renderable = renderable
        for (const displayObject of chunk.displayObjects) {
          if (displayObject && !displayObject.destroyed) {
            displayObject.renderable = renderable
          }
        }
      }
      this.visibleRenderChunkCount = visibleCount
    } finally {
      this.context.performance?.record?.('renderChunks.update', performance.now() - startedAt)
    }
  }

  getWaterOverlayBounds(): Bounds {
    const mapWidth = (this.size + 1) * CELL_WIDTH
    const mapHeight = (this.size + 1) * CELL_HEIGHT + CELL_HEIGHT
    return {
      minX: -mapWidth / 2 - WATER_OVERLAY_MARGIN,
      minY: -WATER_OVERLAY_MARGIN,
      width: mapWidth + WATER_OVERLAY_MARGIN * 2,
      height: mapHeight + WATER_OVERLAY_MARGIN * 2,
    }
  }

  updateWaterOverlay(): void {
    if (!this.grid.length || this.size <= 0) return
    if (!this.waterOverlay || !this.waterBackground) this.createWaterOverlay()
  }

  createWaterOverlay(): void {
    const frames = getWaterOverlayFrames()
    if (!frames.length || this.waterOverlay) return
    const bounds = this.getWaterOverlayBounds()
    const background = new Graphics()
    background.label = 'waterBackground'
    background.eventMode = 'none'
    background.zIndex = WATER_BACKGROUND_Z_INDEX
    background.rect(bounds.minX, bounds.minY, bounds.width, bounds.height)
    background.fill({ color: getEnvironmentTerrainParams(this.environment).waterBackgroundColor })

    const overlay = new TilingSprite({ texture: frames[0], width: bounds.width, height: bounds.height })
    overlay.label = 'waterOverlayFilter'
    overlay.position.set(bounds.minX, bounds.minY)
    overlay.alpha = WATER_OVERLAY_ALPHA
    overlay.eventMode = 'none'
    overlay.zIndex = WATER_OVERLAY_Z_INDEX

    this.addChild(background)
    this.addChild(overlay)
    this.waterBackground = background
    this.waterOverlay = overlay
    this.ensureWaterAnimationTicker()
  }

  ensureWaterAnimationTicker(): void {
    if (this.waterOverlayTick) return
    const ticker = this.context.app?.ticker as WaterOverlayTicker | undefined
    if (ticker) {
      const tick = (ticker: Ticker) => {
        const update = () => {
          const frames = getWaterOverlayFrames()
          const borderFrameCount = Math.max(0, ...Array.from(this.waterBorderSurfaces, surface => surface.frames.length))
          const frameCount = Math.max(frames.length, borderFrameCount)
          if (!frameCount) return
          this.waterOverlayElapsed += ticker.deltaTime * WATER_OVERLAY_FRAME_SPEED
          if (this.waterOverlayElapsed >= 1) {
            this.waterOverlayElapsed %= 1
            this.waterOverlayFrame += 1
            if (this.waterOverlay?.parent && frames.length) {
              this.waterOverlay.texture = frames[this.waterOverlayFrame % frames.length]
            }
            for (const surface of this.waterBorderSurfaces) {
              if (surface.sprite.destroyed) continue
              surface.sprite.texture =
                surface.frames[getPingPongFrameIndex(this.waterOverlayFrame, surface.frames.length)]
            }
          }
        }
        this.context.performance?.measure?.('water.update', update) ?? update()
      }
      ticker.add(tick)
      this.waterOverlayTick = tick
    }
  }

  registerWaterBorderSurface(
    sprite: { texture: Texture; destroyed?: boolean },
    frames: Texture[],
    initialFrame: number = 0
  ): () => void {
    if (!frames.length) return () => {}
    const surface = { sprite, frames }
    sprite.texture = frames[initialFrame % frames.length]
    this.waterBorderSurfaces.add(surface)
    this.ensureWaterAnimationTicker()
    return () => {
      this.waterBorderSurfaces.delete(surface)
    }
  }

  invalidateWaterOverlay(): void {
    // The water surface is now a full-map background layer, so terrain edits do
    // not need to rebuild a water-cell mask.
  }

  _ensureBuckets(): void {
    if (this.instanceBuckets) return
    const bw = Math.ceil(this.grid.length / BUCKET_SIZE)
    const bh = Math.ceil(this.grid[0].length / BUCKET_SIZE)
    this.instanceBuckets = Array.from({ length: bw }, () => Array.from({ length: bh }, () => new Set()))
  }

  addToInstanceBucket(instance: RuntimeEntity): void {
    this._ensureBuckets()
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets?.[bi]?.[bj]?.add(instance)
  }

  removeFromInstanceBucket(instance: RuntimeEntity): void {
    if (!this.instanceBuckets) return
    const bi = Math.floor(instance.i / BUCKET_SIZE)
    const bj = Math.floor(instance.j / BUCKET_SIZE)
    this.instanceBuckets[bi]?.[bj]?.delete(instance)
  }

  updateInstanceBucket(instance: RuntimeEntity, oldI: number, oldJ: number): void {
    if (!this.instanceBuckets) return
    const oldBi = Math.floor(oldI / BUCKET_SIZE),
      oldBj = Math.floor(oldJ / BUCKET_SIZE)
    const newBi = Math.floor(instance.i / BUCKET_SIZE),
      newBj = Math.floor(instance.j / BUCKET_SIZE)
    if (oldBi !== newBi || oldBj !== newBj) {
      this.instanceBuckets[oldBi]?.[oldBj]?.delete(instance)
      this.instanceBuckets[newBi]?.[newBj]?.add(instance)
    }
  }

  // MapGeneration
  generateFromJSON(data: SavedGameData): void {
    return this.mapGeneration.generateFromJSON(data)
  }

  generateMapAsync(
    positionsCountOverride: number | null = null,
    repeat: number = 0,
    options?: GenerateMapOptions
  ): Promise<void> {
    return this.mapGeneration.generateMapAsync(positionsCountOverride, repeat, options)
  }

  generateFromBlueprint(blueprint: MapBlueprint, options?: GenerateMapOptions): Promise<void> {
    return this.mapGeneration.generateFromBlueprint(blueprint, options)
  }

  generateEditableFromBlueprint(blueprint: MapBlueprint): void {
    return this.mapGeneration.generateEditableFromBlueprint(blueprint)
  }

  stylishMap(options?: GenerateMapOptions): Promise<void> {
    return this.mapGeneration.stylishMap(options)
  }

  prepareTerrainForSavedState(options?: GenerateMapOptions): Promise<void> {
    return this.mapGeneration.prepareTerrainForSavedState(options)
  }

  generatePlayers(playersConfig?: Array<Partial<PlayerLike> & PlayerSetupConfig> | null): PlayerLike[] {
    return this.mapGeneration.generatePlayers(playersConfig)
  }

  placeBanditCamps(): void {
    return this.mapGeneration.placeBanditCamps()
  }

  placePlayers(): void {
    return this.mapGeneration.placePlayers()
  }

  generateCells(): void {
    return this.mapGeneration.generateCells()
  }

  generateCellsAsync(options?: GenerateMapOptions): Promise<void> {
    return this.mapGeneration.generateCellsAsync(options)
  }

  generateTerrain(gridSize: number = 120, seed?: number, params?: Partial<EnvironmentTerrainParams>): TerrainGrid {
    return this.mapGeneration.generateTerrain(gridSize, seed, params)
  }

  generateSets(): void {
    return this.mapGeneration.generateSets()
  }

  findPlayerPlaces(): GeneratedPosition[] {
    return this.mapGeneration.findPlayerPlaces()
  }

  // MapResources
  generateForestAroundPlayer(
    player: GridPosition,
    treeCount: number,
    clusterCount?: number,
    minClusterRadius?: number,
    maxClusterRadius?: number,
    safeDistance?: number,
    clearingProbability?: number
  ): void {
    return this.mapResources.generateForestAroundPlayer(
      player,
      treeCount,
      clusterCount,
      minClusterRadius,
      maxClusterRadius,
      safeDistance,
      clearingProbability
    )
  }

  generateResourcesAroundPlayersAsync(playersPos: GeneratedPosition[]): Promise<void> {
    return this.mapResources.generateResourcesAroundPlayersAsync(compactPositions(playersPos))
  }

  generateNeutralResourceGroupsAsync(playersPos: GeneratedPosition[]): Promise<void> {
    return this.mapResources.generateNeutralResourceGroupsAsync(compactPositions(playersPos))
  }

  generateBiomeTreesAsync(playersPos: GeneratedPosition[]): Promise<void> {
    return this.mapResources.generateBiomeTreesAsync(compactPositions(playersPos))
  }

  findNeutralResourceCenter(
    playersPos: GeneratedPosition[],
    placedCenters: GridPosition[],
    playerSafeDistance: number,
    minNeutralDistance: number
  ): GridPosition | null {
    return this.mapResources.findNeutralResourceCenter(
      compactPositions(playersPos),
      placedCenters,
      playerSafeDistance,
      minNeutralDistance
    )
  }

  placeResourceGroup(player: PlayerLike, instance: string, quantity: number, range: [number, number]): boolean {
    return this.mapResources.placeResourceGroup(player, instance, quantity, range)
  }

  placeResourceGroupAt(
    center: GridPosition,
    instance: string,
    quantity: number,
    clusterRadius?: number,
    options?: { isNaturalResource?: boolean; textureName?: string; quantity?: number; startsMature?: boolean }
  ): boolean {
    return this.mapResources.placeResourceGroupAt(center, instance, quantity, clusterRadius, options)
  }

  respawnNaturalResource(slot: SaveEntityState): boolean {
    return this.mapResources.respawnNaturalResource(slot)
  }

  // MapTerrain
  generateMapRelief(): void {
    return this.mapTerrain.generateMapRelief()
  }

  flattenPlayerStartZones(radius?: number): void {
    return this.mapTerrain.flattenPlayerStartZones(radius)
  }

  getReliefCoastDistances(): Int16Array {
    return this.mapTerrain.getReliefCoastDistances()
  }

  invalidateReliefCoastDistances(): void {
    return this.mapTerrain.invalidateReliefCoastDistances()
  }

  getMaxReliefLevelFromCoastDistance(distance: number): number {
    return this.mapTerrain.getMaxReliefLevelFromCoastDistance(distance)
  }

  getMinReliefLevelFromCoastDistance(distance: number): number {
    return this.mapTerrain.getMinReliefLevelFromCoastDistance(distance)
  }

  setCellReliefLevelDirect(cell: RuntimeCell, level: number): void {
    return this.mapTerrain.setCellReliefLevelDirect(cell, level)
  }

  fillWaterGaps(level?: number | null): Set<RuntimeCell> {
    return this.mapTerrain.fillWaterGaps(level) as Set<RuntimeCell>
  }

  normalizeWaterTopology(
    level?: number | null,
    seeds?: Set<RuntimeCell> | null,
    protectedCells?: Set<RuntimeCell>
  ): Set<RuntimeCell> {
    return this.mapTerrain.normalizeWaterTopology(level, seeds, protectedCells) as Set<RuntimeCell>
  }

  clampReliefAroundWaterLevels(): ReliefLevelBounds {
    return this.mapTerrain.clampReliefAroundWaterLevels()
  }

  clampReliefAroundWater(dist?: Int16Array): void {
    return this.mapTerrain.clampReliefAroundWater(dist)
  }

  enforceReliefStepContinuity(
    dist?: Int16Array,
    protectedCells?: Set<RuntimeCell>,
    levelBounds?: ReliefLevelBounds
  ): void {
    return this.mapTerrain.enforceReliefStepContinuity(dist, protectedCells, levelBounds)
  }

  rebuildTerrainBackfill(): void {
    return this.mapTerrain.rebuildTerrainBackfill()
  }

  formatCellsRelief(): void {
    return this.mapTerrain.formatCellsRelief()
  }

  formatCellsWaterBorder(): void {
    return this.mapTerrain.formatCellsWaterBorder()
  }

  formatCellsWaterBorderOverlays(): void {
    return this.mapTerrain.formatCellsWaterBorderOverlays()
  }

  rebuildTerrainAppearance(protectedReliefCells?: Set<RuntimeCell>): void {
    return this.mapTerrain.rebuildTerrainAppearance(protectedReliefCells)
  }

  formatCellsPatchBorders(): void {
    return this.mapTerrain.formatCellsPatchBorders()
  }

  // MapFog
  bakeTerrainToChunks(): void {
    this.mapFog.bakeTerrainToChunks()
  }

  _initFogChunks(): void {
    return this.mapFog._initFogChunks()
  }

  _indexFogChunkCells(): void {
    return this.mapFog._indexFogChunkCells()
  }

  _flushFogQueue(): void {
    return this.mapFog._flushFogQueue()
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    const ticker = this.context.app?.ticker as WaterOverlayTicker | undefined
    if (ticker && this.waterOverlayTick) ticker.remove(this.waterOverlayTick)
    this.waterOverlayTick = null
    this.waterOverlay = null
    this.waterBorderSurfaces.clear()
    this.waterBackground = null
    this.shadowLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.terrainChunkManager?.destroy()
    this.mapFog?.destroyFogResources()
    super.destroy(options ?? undefined)
  }
}
