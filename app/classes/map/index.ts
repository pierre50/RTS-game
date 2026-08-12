import {
  Assets,
  Container,
  Graphics,
  Matrix,
  RenderTexture,
  Sprite,
  TilingSprite,
  type ContainerChild,
  type Texture,
  type Ticker,
} from 'pixi.js'
import { BUCKET_SIZE, CELL_HEIGHT, CELL_WIDTH, GROUND_SET_CHANCE } from '../../constants'
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
import { createSeededRandom } from '../../lib/random'
import { rectangleIntersectsViewport } from '../../lib/graphics/chunkCulling'
import { getTextureByFrame } from '../../lib'
import { TerrainChunkManager, type ChunkedTerrainMap } from './TerrainChunkManager'
import type { ResourceAmount } from '../../types/common'
import type { GridPosition } from '../../types/grid'
import type { RuntimeCell, RenderChunk } from '../../types/map'
import type { FloatingItemEntity, ResourceEntity, RuntimeEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import type { Viewport, Bounds } from '../../types/geometry'
import type { PlayerSetupConfig } from '../../types/save'
import type { GameContextLike } from '../../types/context'
import type { MapEditorControlsLike } from '../../types/mapEditor'

export type MapContext = Omit<
  Partial<GameContextLike>,
  'controls' | 'map' | 'menu' | 'performance' | 'player' | 'players' | 'scheduler'
> & {
  controls?: GameContextLike['controls'] | MapEditorControlsLike | null
  map?: GameContextLike['map'] | null
  menu?: GameContextLike['menu'] | null
  performance?: GameContextLike['performance'] | null
  player?: PlayerLike | null
  players: PlayerLike[]
  scheduler?: GameContextLike['scheduler'] | null
}
type InstanceBuckets = Array<Array<Set<RuntimeEntity>>>
type GeneratedPosition = GridPosition | null
type WaterOverlayTicker = { add: (tick: (ticker: Ticker) => void) => void; remove: (tick: (ticker: Ticker) => void) => void }
type WaterBorderSurface = { sprite: { texture: Texture; parent?: unknown }; frames: Texture[] }
type WaterBorderAppearance = { resourceName: string; index: number }
type WaterBorderCell = RuntimeCell & { _terrainAppearance?: { waterBorder?: WaterBorderAppearance | null } }
type WaterBorderFilterLayer = Container & { overlay?: TilingSprite | null; maskTexture?: RenderTexture | null }

const WATER_OVERLAY_TEXTURES = [
  'water-surface/filter-0',
  'water-surface/filter-1',
  'water-surface/filter-2',
  'water-surface/filter-3',
]
const WATER_OVERLAY_FRAME_SPEED = 0.06
const WATER_OVERLAY_ALPHA = 0.32
const WATER_OVERLAY_MARGIN = CELL_WIDTH * 2
const WATER_OVERLAY_Z_INDEX = -0.5
const WATER_BORDER_WATER_SHEETS: Record<string, string> = {
  'water-borders/desert': 'water-borders/desert-water-filter-mask',
}
const WATER_BORDER_ANIMATION_Z_INDEX = -0.45

function getWaterOverlayFrames(): Texture[] {
  return WATER_OVERLAY_TEXTURES.map(id => (Assets.cache.has(id) ? (Assets.cache.get(id) as Texture) : null)).filter(
    (texture): texture is Texture => Boolean(texture)
  )
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
  startingUnits: number
  playersPos: GeneratedPosition[]
  positionsCount: number
  gaia: PlayerLike | null
  resources: Set<ResourceEntity>
  floatingItems: Set<FloatingItemEntity>
  instanceBuckets: InstanceBuckets | null
  renderChunks: RenderChunk[]
  _random: () => number
  mapGeneration: MapGeneration
  mapResources: MapResources
  mapTerrain: MapTerrain
  mapFog: MapFog
  terrainChunkManager: TerrainChunkManager
  waterOverlay: TilingSprite | null
  waterOverlayMask: Graphics | null
  waterOverlayDirty: boolean
  waterOverlayFrame: number
  waterOverlayElapsed: number
  waterOverlayTick: ((ticker: Ticker) => void) | null
  waterBorderSurfaces: Set<WaterBorderSurface>
  waterBorderAnimationLayer: WaterBorderFilterLayer | null

  visibleRenderChunkCount?: number

  constructor(context: MapContext) {
    super()

    this.context = context
    this.size = 0
    this.chanceOfSets = GROUND_SET_CHANCE

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

    this.x = 0
    this.y = 0
    this.startingUnits = 3

    this.playersPos = []
    this.positionsCount = 2
    this.gaia = null
    this.resources = new Set()
    this.floatingItems = new Set()
    this.instanceBuckets = null
    this.renderChunks = []
    this._random = Math.random

    this.eventMode = 'auto'

    this.mapGeneration = new MapGeneration(this)
    this.mapResources = new MapResources(this)
    this.mapTerrain = new MapTerrain(this)
    this.mapFog = new MapFog(this)
    this.terrainChunkManager = new TerrainChunkManager(this as ChunkedTerrainMap)
    this.waterOverlay = null
    this.waterOverlayMask = null
    this.waterOverlayDirty = true
    this.waterOverlayFrame = 0
    this.waterOverlayElapsed = 0
    this.waterOverlayTick = null
    this.waterBorderSurfaces = new Set()
    this.waterBorderAnimationLayer = null
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
    this.x = Math.round(x)
    this.y = Math.round(y)
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
    if (!this.waterOverlay || !this.waterOverlayMask) this.createWaterOverlay()
    if (this.waterOverlayDirty) this.rebuildWaterOverlayMask()
  }

  createWaterOverlay(): void {
    const frames = getWaterOverlayFrames()
    if (!frames.length || this.waterOverlay) return
    const bounds = this.getWaterOverlayBounds()
    const overlay = new TilingSprite({ texture: frames[0], width: bounds.width, height: bounds.height })
    overlay.label = 'waterOverlayFilter'
    overlay.position.set(bounds.minX, bounds.minY)
    overlay.alpha = WATER_OVERLAY_ALPHA
    overlay.eventMode = 'none'
    overlay.zIndex = WATER_OVERLAY_Z_INDEX

    const mask = new Graphics()
    mask.label = 'waterOverlayMask'
    mask.eventMode = 'none'

    this.addChild(overlay)
    this.addChild(mask)
    overlay.mask = mask
    this.waterOverlay = overlay
    this.waterOverlayMask = mask
    this.waterOverlayDirty = true
    this.ensureWaterAnimationTicker()
  }

  ensureWaterAnimationTicker(): void {
    if (this.waterOverlayTick) return
    const ticker = this.context.app?.ticker as WaterOverlayTicker | undefined
    if (ticker) {
      const tick = (ticker: Ticker) => {
        const frames = getWaterOverlayFrames()
        const borderFrameCount = Math.max(0, ...Array.from(this.waterBorderSurfaces, surface => surface.frames.length))
        const frameCount = frames.length || borderFrameCount
        if (!frameCount) return
        this.waterOverlayElapsed += ticker.deltaTime * WATER_OVERLAY_FRAME_SPEED
        if (this.waterOverlayElapsed >= 1) {
          this.waterOverlayElapsed %= 1
          this.waterOverlayFrame = (this.waterOverlayFrame + 1) % frameCount
          if (this.waterOverlay?.parent && frames.length) {
            this.waterOverlay.texture = frames[this.waterOverlayFrame % frames.length]
          }
          if (this.waterBorderAnimationLayer?.overlay && frames.length) {
            this.waterBorderAnimationLayer.overlay.texture = frames[this.waterOverlayFrame % frames.length]
          }
          for (const surface of this.waterBorderSurfaces) {
            if (!surface.sprite.parent) continue
            surface.sprite.texture = surface.frames[this.waterOverlayFrame % surface.frames.length]
          }
        }
      }
      ticker.add(tick)
      this.waterOverlayTick = tick
    }
  }

  registerWaterBorderSurface(sprite: { texture: Texture; parent?: unknown }, frames: Texture[], initialFrame: number = 0): () => void {
    if (!frames.length) return () => {}
    const surface = { sprite, frames }
    sprite.texture = frames[initialFrame % frames.length]
    this.waterBorderSurfaces.add(surface)
    this.ensureWaterAnimationTicker()
    return () => {
      this.waterBorderSurfaces.delete(surface)
    }
  }

  rebuildWaterOverlayMask(): void {
    const mask = this.waterOverlayMask
    if (!mask) return
    mask.clear()
    for (const row of this.grid) {
      for (const cell of row || []) {
        if (!cell || cell.category !== 'Water' || cell.waterBorder) continue
        mask.poly([
          cell.x - CELL_WIDTH / 2,
          cell.y,
          cell.x,
          cell.y - CELL_HEIGHT / 2,
          cell.x + CELL_WIDTH / 2,
          cell.y,
          cell.x,
          cell.y + CELL_HEIGHT / 2,
        ])
        mask.fill({ color: 0xffffff })
      }
    }
    this.waterOverlayDirty = false
  }

  invalidateWaterOverlay(): void {
    this.waterOverlayDirty = true
  }

  rebuildWaterBorderAnimationLayer(): void {
    this.waterBorderAnimationLayer?.maskTexture?.destroy(true)
    this.waterBorderAnimationLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.waterBorderAnimationLayer = null
    if (!this.grid.length) return

    const frames = getWaterOverlayFrames()
    if (!frames.length) return
    const renderer = this.context.app?.renderer
    if (!renderer) return
    const bounds = this.getWaterOverlayBounds()
    const layer = new Container() as WaterBorderFilterLayer
    layer.label = 'waterBorderAnimationLayer'
    layer.eventMode = 'none'
    layer.zIndex = WATER_BORDER_ANIMATION_Z_INDEX

    const overlay = new TilingSprite({ texture: frames[this.waterOverlayFrame % frames.length], width: bounds.width, height: bounds.height })
    overlay.label = 'waterBorderSurfaceFilter'
    overlay.position.set(bounds.minX, bounds.minY)
    overlay.alpha = WATER_OVERLAY_ALPHA
    overlay.eventMode = 'none'
    overlay.zIndex = 1

    const maskContainer = new Container()
    maskContainer.label = 'waterBorderSurfaceMaskBake'
    maskContainer.eventMode = 'none'
    maskContainer.sortableChildren = true
    let maskCount = 0

    for (const row of this.grid) {
      for (const cell of row || []) {
        const appearance = (cell as WaterBorderCell)?._terrainAppearance?.waterBorder
        const waterSheet = appearance ? WATER_BORDER_WATER_SHEETS[appearance.resourceName] : null
        if (!appearance || !waterSheet) continue

        const frameIndex = Number(appearance.index)
        const waterTexture = getTextureByFrame(waterSheet, frameIndex, Assets)
        const waterMask = new Sprite(waterTexture)
        waterMask.label = 'waterBorderSurfaceMaskSprite'
        waterMask.position.set(cell.x, cell.y)
        waterMask.anchor.set(Math.floor(waterTexture.width / 2) / waterTexture.width, Math.floor(waterTexture.height / 2) / waterTexture.height)
        waterMask.roundPixels = true
        waterMask.eventMode = 'none'
        waterMask.zIndex = cell.zIndex ?? 0
        maskContainer.addChild(waterMask)
        maskCount++
      }
    }

    if (!maskCount) {
      maskContainer.destroy({ children: true, texture: false, textureSource: false })
      layer.destroy({ children: true, texture: false, textureSource: false })
      return
    }

    const maskTexture = RenderTexture.create({ width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) })
    renderer.render({
      container: maskContainer,
      target: maskTexture,
      transform: new Matrix().translate(-bounds.minX, -bounds.minY),
      clear: true,
    })
    maskContainer.destroy({ children: true, texture: false, textureSource: false })

    const mask = new Sprite(maskTexture)
    mask.label = 'waterBorderSurfaceMask'
    mask.position.set(bounds.minX, bounds.minY)
    mask.eventMode = 'none'
    overlay.mask = mask

    layer.overlay = overlay
    layer.maskTexture = maskTexture
    layer.addChild(overlay)
    this.addChild(layer)
    this.waterBorderAnimationLayer = layer
    this.ensureWaterAnimationTicker()
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
    options?: { textureName?: string }
  ): boolean {
    return this.mapResources.placeResourceGroupAt(center, instance, quantity, clusterRadius, options)
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

  classifyDeepWater(): void {
    return this.mapTerrain.classifyDeepWater()
  }

  formatCellsDeepWaterBorder(): void {
    return this.mapTerrain.formatCellsDeepWaterBorder()
  }

  // MapFog
  bakeTerrainToChunks(): void {
    this.mapFog.bakeTerrainToChunks()
    this.rebuildWaterBorderAnimationLayer()
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
    this.waterOverlayMask = null
    this.waterBorderSurfaces.clear()
    this.waterBorderAnimationLayer?.destroy({ children: true, texture: false, textureSource: false })
    this.waterBorderAnimationLayer = null
    this.terrainChunkManager?.destroy()
    this.mapFog?.destroyFogResources()
    super.destroy(options ?? undefined)
  }
}
