import type { Container } from 'pixi.js'
import type { Command } from './DevCommandRegistry'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { ResourceAmount } from '../types/common'

export type DebugTickerCallback = (ticker?: { deltaTime?: number; elapsedMS?: number }) => void

export type DevMapLike = {
  size: number
  grid: RuntimeCell[][]
  resources: Set<DevEntity>
  gaia?: { units: DevEntity[] } | null
  instantMode?: boolean
  revealEverything?: boolean
  revealTerrain?: boolean
  showResources?: boolean
  fogLayer?: { visible: boolean } | null
  fogMemoryLayer?: { visible: boolean } | null
  mapFog?: { viewportRenderer: { invalidate(): void; update(viewport?: unknown): void } }
  terrainChunkManager?: { invalidateAll(): void }
  debugSolidVisible?: boolean
  debugPathVisible?: boolean
  debugVisionVisible?: boolean
  debugGridVisible?: boolean
  debugCoordsVisible?: boolean
  debugPerfVisible?: boolean
  debugAiInfoVisible?: boolean
  _debugPathTicker?: DebugTickerCallback | null
  _debugPerfTicker?: DebugTickerCallback | null
  _debugAiInfoTicker?: DebugTickerCallback | null
  _debugSolidTicker?: DebugTickerCallback | null
  _debugVisionTicker?: DebugTickerCallback | null
  _debugGridTicker?: DebugTickerCallback | null
  _debugCoordsTicker?: DebugTickerCallback | null
  _fogQueue?: Map<RuntimeCell, string>
  _pendingFogChunkUpdates?: Map<unknown, unknown>
  viewportRenderer?: { invalidate(): void; update(viewport?: unknown): void }
  addChild<T extends Container>(child: T): T
  removeChild<T extends Container>(child: T): T
  getChildByLabel?(label: string): Container | null
  registerRenderChunk?(displayObjects: unknown, bounds: unknown): unknown
}

type DevMenuLike = {
  updateTopbar(): void
  updateBottombar?(): void
  updateTerrainMiniMap?(i: number, j: number): void
  updatePlayerMiniMapEvt?(player: PlayerLike): void
  updateResourcesMiniMapEvt?(): void
  updateCameraMiniMapEvt?(): void
  revealTerrainMinimap?(): void
  rebuildTerrainMiniMapFromViews?(): void
  showMessage?(message: string, type?: string): void
}

type DevControlsLike = {
  mouse?: { x: number; y: number }
  getCellUnderCursor?(): DevCell | null
  updateVisibleCells?(): void
  cameraController?: {
    getViewportRect(): { visibleLeft: number; visibleTop: number; visibleWidth: number; visibleHeight: number }
    visibleCells?: Set<RuntimeCell>
  }
  stopKeyboardMove?(): void
}

export type DevPerformanceMetric = {
  count?: number
  totalMs: number
  averageMs: number
  maxMs: number
  slowCount?: number
}

type DevPerformanceSnapshot = {
  frames: {
    samples: number
    averageMs: number
    p95Ms: number
    p99Ms: number
    fps: number
    speed: number
  }
  metrics: Record<string, DevPerformanceMetric>
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
  menu: DevMenuLike
  controls?: DevControlsLike
  devConsoleOpen?: boolean
  victory?: boolean
  instantMode?: boolean
  paused?: boolean
  performance?: {
    metrics?: Record<string, DevPerformanceMetric>
    snapshot?(): DevPerformanceSnapshot
    reset?(): void
  } | null
  app?: {
    ticker: {
      FPS?: number
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

export type DevEntity = RuntimeEntity & {
  action?: string | null
  assetType?: string
  children?: Array<{ destroy?: () => void }>
  currentCell?: RuntimeCell | null
  dest?: unknown
  hitPoints?: number
  inactif?: boolean
  name?: string
  totalHitPoints?: number
  path?: RuntimeCell[]
  die?: (immediate?: boolean) => void
}

export type DevPlayer = PlayerLike & {
  config: {
    units: Record<string, unknown>
    buildings: Record<string, unknown>
  }
  buildings: BuildingEntity[]
  units: UnitEntity[]
  corpses: UnitEntity[]
  techs: Record<string, unknown>
  popMax?: number
  population?: number
  hasBuilt?: string[]
  isEnemy?(player: PlayerLike): boolean
  createUnit?(options: { i: number; j: number; type: string }): UnitEntity
}

export type DevCell = RuntimeCell & {
  setFog?(init?: boolean): void
  removeFog?(): void
}
