import type { Container, ContainerChild } from 'pixi.js'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { RuntimeMap } from '../types/map'
import type { PlayerLike, PlayerUnitCreationOptions } from '../types/player'
import type { TechnologyConfig, UnitConfig, BuildingConfig } from '../types/config'
import type { DayNightColorAdjustment, DayNightStateLike } from '../types/context'
import type { FactionSave } from '../types/save'

export type DevWeatherPhase =
  | 'sunny'
  | 'clouding'
  | 'stormBuildUp'
  | 'rainLight'
  | 'rainHeavy'
  | 'snow'
  | 'sandstorm'
  | 'clearing'
  | 'night'

export interface CommandResult {
  ok: boolean
  message: string
}

export interface Command {
  name: string
  aliases?: string[]
  usage?: string
  describe?: string
  complete?: (args: string[], context: DevConsoleContext) => string[]
  run: (args: string[], context: DevConsoleContext) => CommandResult
}

type DevDayNightLike = {
  debugState?(): object
  forceNextDay?(): void
  getColorAdjustment?(): DayNightColorAdjustment
  getDarknessLevel?(): number
  getDayLabel?(): string
  getElapsedMs?(): number
  getTimeLabel?(): string
  setTime?(hour: number, minute?: number): void
  state?: DayNightStateLike
}

type DevWeatherLike = {
  debugState?(): object
  forcePhase?(phase: DevWeatherPhase): void
  getDarknessLevel?(): number
  phase?: DevWeatherPhase
}

type DevTimeSkipLike = {
  active?: boolean
  dayNightMaxDeltaMs?: number
  suppressAudio?: boolean
  suppressCosmetics?: boolean
  cancel?(options?: { silent?: boolean }): void
  destroy?(): void
  getProgress?(): number
  start?(hours: number): CommandResult
}

type DebugTickerCallback = (ticker?: { deltaTime?: number; elapsedMS?: number }) => void

export type DevMapLike = {
  size: number
  grid: RuntimeCell[][]
  spaces?: RuntimeMap['spaces']
  activeSpaceId?: RuntimeMap['activeSpaceId']
  mapType?: string
  resources: Set<DevEntity>
  renderChunks?: Array<{
    displayObjects?: unknown[]
    renderable?: boolean
  }>
  gaia?: {
    units: DevEntity[]
    animals?: DevEntity[]
    createAnimal?(options: { i: number; j: number; spaceId?: string; type: string }): unknown
  } | null
  instantMode?: boolean
  revealEverything?: boolean
  showResources?: boolean
  fogLayer?: { visible: boolean } | null
  fogMemoryLayer?: { visible: boolean } | null
  mapFog?: { viewportRenderer: { invalidate(): void; update(viewport?: DevViewportRect): void } }
  terrainChunkManager?: {
    clock?: number
    chunks?: Map<
      string,
      {
        lastUsed?: number
        mounted?: boolean
        visualCells?: { size?: number } | null
      }
    >
    invalidateAll(): void
  }
  visibleRenderChunkCount?: number
  debugSolidVisible?: boolean
  debugPathVisible?: boolean
  debugVisionVisible?: boolean
  debugGridVisible?: boolean
  debugCoordsVisible?: boolean
  debugHeroAimVisible?: boolean
  debugHeroCollisionVisible?: boolean
  debugPerfVisible?: boolean
  debugAiInfoVisible?: boolean
  debugPlayerStatsVisible?: boolean
  debugTerrainFrameVisible?: boolean
  debugEntityBarsVisible?: boolean
  _debugPathTicker?: DebugTickerCallback | null
  _debugPerfTicker?: DebugTickerCallback | null
  _debugAiInfoTicker?: DebugTickerCallback | null
  _debugPlayerStatsTicker?: DebugTickerCallback | null
  _debugSolidTicker?: DebugTickerCallback | null
  _debugVisionTicker?: DebugTickerCallback | null
  _debugGridTicker?: DebugTickerCallback | null
  _debugCoordsTicker?: DebugTickerCallback | null
  _debugHeroAimTicker?: DebugTickerCallback | null
  _debugHeroCollisionTicker?: DebugTickerCallback | null
  _debugTerrainFrameTicker?: DebugTickerCallback | null
  _debugEntityBarsTicker?: DebugTickerCallback | null
  _fogQueue?: Map<RuntimeCell, string>
  _pendingFogChunkUpdates?: Map<RuntimeCell, string>
  viewportRenderer?: { invalidate(): void; update(viewport?: DevViewportRect): void }
  addChild<T extends Container>(child: T): T
  removeChild<T extends Container>(child: T): T
  addToInstanceBucket?(instance: RuntimeEntity): void
  removeFromInstanceBucket?(instance: RuntimeEntity): void
  getChildByLabel?(label: string): Container | null
  registerRenderChunk?(
    displayObjects: ContainerChild | ContainerChild[],
    bounds: { minX: number; minY: number; width: number; height: number }
  ): object
}

type DevViewportRect = { visibleLeft: number; visibleTop: number; visibleWidth: number; visibleHeight: number }

type DevMenuLike = {
  updateTopbar(): void
  updateActionTarget?(): void
  updateTerrainMiniMap?(i: number, j: number): void
  updatePlayerMiniMapEvt?(player: PlayerLike): void
  updateResourcesMiniMapEvt?(): void
  updateCameraMiniMapEvt?(): void
  isMiniMapActive?(): boolean
  revealTerrainMinimap?(): void
  rebuildTerrainMiniMapFromViews?(): void
  refreshInventory?(): void
  showMessage?(message: string, type?: string): void
}

type DevControlsLike = {
  mouse?: { x: number; y: number }
  getCellUnderCursor?(): DevCell | null
  getWorldPointUnderCursor?(): { x: number; y: number }
  updateVisibleCells?(): void
  heroUnit?: UnitEntity | null
  cameraController?: {
    getViewportRect(): { visibleLeft: number; visibleTop: number; visibleWidth: number; visibleHeight: number }
    set?(x: number, y: number, direct?: boolean): void
    visibleCellsStats?: {
      candidates: number
      exited: number
      margin: number
      samples: number
      stepX: number
      stepY: number
      updated: number
    }
    visibleCells?: Set<RuntimeCell>
  }
  stopKeyboardMove?(): void
  isHeroControlActive?(): boolean
  freeCameraActive?: boolean
  setCamera?(x: number, y: number, direct?: boolean): void
  setFreeCamera?(enabled: boolean): void
}

export type DevPerformanceMetric = {
  count?: number
  totalMs: number
  exclusiveMs?: number
  averageMs: number
  averageExclusiveMs?: number
  measuredCount?: number
  measuredAverageMs?: number
  measuredAverageExclusiveMs?: number
  maxMs: number
  maxExclusiveMs?: number
  frames?: number
  averageFrameMs?: number
  averageFrameExclusiveMs?: number
  maxFrameMs?: number
  maxFrameExclusiveMs?: number
  maxFrameCalls?: number
  lastMs?: number
  lastExclusiveMs?: number
  slowCount?: number
  slowSamples?: Array<{ at: number; duration: number }>
}

type DevPerformanceSlowFrame = {
  at: number
  duration: number
  estimatedExclusiveMs: number
  estimatedMs: number
  exclusiveMeasuredMs: number
  measuredMs: number
  metrics: Array<{
    count: number
    exclusiveMs: number
    measuredCount: number
    measuredMs: number
    name: string
    phase: string
    totalMs: number
  }>
  mixedPhases: boolean
  phase: string
  phaseFrame: number
  untrackedMs: number
}

export type DevPerformanceSnapshot = {
  frames: {
    samples: number
    averageMs: number
    p95Ms: number
    p99Ms: number
    fps: number
    speed: number
    slowCount?: number
  }
  metrics: Record<string, DevPerformanceMetric>
  renderStats?: Array<{
    at: number
    duration: number
    effectiveRenderable?: number
    effectiveVisible?: number
    maxDepth: number
    nodes: number
    renderable: number
    target: 'screen' | 'texture'
    visible: number
  }>
  slowFrames?: DevPerformanceSlowFrame[]
}

export type DevConsoleContext = {
  commands: {
    get(name: string): Command | undefined
    all(): Command[]
  }
  gamebox: HTMLElement
  map: DevMapLike
  player: DevPlayer
  players: DevPlayer[]
  getCampaignFactions?: () => Record<string, FactionSave> | null
  getCurrentWorldId?: () => string | null
  menu: DevMenuLike
  controls?: DevControlsLike
  devConsoleOpen?: boolean
  defeat?: boolean
  instantMode?: boolean
  paused?: boolean
  performance?: {
    metrics?: Record<string, DevPerformanceMetric>
    snapshot?(): DevPerformanceSnapshot
    reset?(): void
  } | null
  dayNight?: DevDayNightLike | null
  weather?: DevWeatherLike | null
  tributeRaids?: {
    triggerRaid(options?: { source?: 'schedule' | 'dev-console' }): boolean
    triggerFactionRaid(options?: { ignoreBaseWorld?: boolean; source?: 'schedule' | 'dev-console' }): boolean
  } | null
  timeSkip?: DevTimeSkipLike | null
  unitRest?: {
    synchronizeAfterTimeJump?(): void
  } | null
  synchronizeBuildingInteriorAfterTimeJump?: () => void
  app?: {
    stage?: unknown
    ticker: {
      FPS?: number
      maxFPS?: number
      minFPS?: number
      speed?: number
      add(callback: DebugTickerCallback): void
      remove(callback: DebugTickerCallback): void
    }
  }
  scheduler?: {
    _tasks?: { size: number }
    timeScale?: number
  }
  debugAiInfoTargetIndex?: number | null
}

export type DevConsoleRuntimeContext = Omit<DevConsoleContext, 'commands'>

export type DevEntity = RuntimeEntity & {
  action?: string | null
  assetType?: string
  children?: Array<{ destroy?: () => void }>
  currentCell?: RuntimeCell | null
  dest?: RuntimeCell | RuntimeEntity | null
  hitPoints?: number
  inactif?: boolean
  name?: string
  renderable?: boolean
  totalHitPoints?: number
  path?: RuntimeCell[]
  applyReliefLift?: (level: number, immediate?: boolean) => void
  die?: (immediate?: boolean) => void
}

export type DevPlayer = PlayerLike & {
  config: {
    units: Record<string, UnitConfig>
    buildings: Record<string, BuildingConfig>
  }
  buildings: BuildingEntity[]
  units: UnitEntity[]
  corpses: UnitEntity[]
  techs: Record<string, TechnologyConfig>
  popMax?: number
  population?: number
  hasBuilt?: string[]
  isEnemy?(player: PlayerLike): boolean
  createUnit?(options: PlayerUnitCreationOptions): UnitEntity
}

export type DevCell = RuntimeCell & {
  setFog?(init?: boolean): void
  removeFog?(): void
}
