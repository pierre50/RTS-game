import type { Application, Container, Graphics } from 'pixi.js'
import type { RuntimeMap, RuntimeCell } from './map'
import type { PlayerLike } from './player'
import type { RuntimeEntity } from './entities'
import type { MapEditorLike } from './mapEditor'

export interface SchedulerLike {
  elapsedMs: number
  timeScale?: number
  add(callback: () => void, time: number, name?: string): unknown
  remove(id: unknown): void
  update(id: unknown, time: number): void
  addOneShot(callback: () => void, time: number, name?: string): unknown
  clear?(): void
  destroy?(): void
}

export interface PerformanceMonitorLike {
  measureSampled<T>(name: string, callback: () => T): T
  measure<T>(name: string, callback: () => T): T
  record(name: string, value: number): void
  setPhase?(phase: string): void
  reset?(): void
  destroy?(): void
}

export interface MenuLike {
  selection?: RuntimeEntity | null
  icons?: Record<string, string>
  infoIcons?: Record<string, string>
  handleHotkey?(key: string): void
  showMessage(message: string, type?: string): void
  setBottombar(selection?: RuntimeEntity | null): void
  updateTopbar(): void
  updateBottombar(): void
  updateTerrainMiniMap?(i: number, j: number): void
  updateResourcesMiniMap(): void
  updateCameraMiniMap?(): void
  updatePlayerMiniMap?(player: PlayerLike): void
  updatePlayerMiniMapEvt(player: PlayerLike): void
  updateInfo(id: string, value: string | number | ((element: HTMLElement) => void)): void
  updateButtonContent(id: string, value: string | number | ((element: HTMLElement) => void)): void
  toggleButtonCancel(id: string, enabled: boolean): void
  getUnitButton(type: string): import('./ui').MenuButtonSpec
  getTechnologyButton(type: string): import('./ui').MenuButtonSpec
  getRallyPointButton(): import('./ui').MenuButtonSpec
  getBuildingButton(type: string, ownerOverride?: PlayerLike | null): import('./ui').MenuButtonSpec
  updatePlayerStats(): void
  init?(): void
  destroy?(): void
}

interface EntityPreviewLike {
  set(selection: unknown): void
}

interface MinimapManagerLike {
  getMinimapFactor(): number
}

export interface MinimapHostLike {
  context: GameContextLike
  gameHud: HTMLDivElement
  bottombar: HTMLDivElement
  bottombarMap: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  playersMinimap: import('./ui').MinimapPlayerCanvas[]
  minimapManager: MinimapManagerLike
  toggle?: HTMLButtonElement
  toggled: boolean
}

interface RallyPointControllerLike {
  active: boolean
  building: RuntimeEntity | null
  start(building: RuntimeEntity): void
  cancel(options?: { clear?: boolean }): void
  handleMouseMove(): void
  handleMouseUp(cell: RuntimeCell): boolean
  handleMouseUpOnEntity(entity: RuntimeEntity): boolean
}

export interface ControlsLike extends Container {
  context: GameContextLike
  camera: { x: number; y: number }
  mouse: { x: number; y: number; prevent?: boolean }
  pointerStart?: { x: number; y: number } | null
  mouseBuilding?: (Container & { type?: string; isFree?: boolean }) | null
  mouseRectangle?: SelectionRectangle | null
  entityPreview?: EntityPreviewLike | null
  rallyPointController?: RallyPointControllerLike
  screenToLocal(x: number, y: number): { x: number; y: number }
  localToScreen(x: number, y: number): { x: number; y: number }
  getViewportMetrics(): { visibleHeight: number; visibleWidth: number; visibleLeft: number; visibleTop: number }
  removeMouseBuilding(): void
  setMouseBuilding?(building: import('./entities').PlaceableBuildingConfig): void
  setCamera?(x: number, y: number, direct?: boolean): void
  sendUnits?(cell: RuntimeCell): void
  updateVisibleCells?(): void
  instanceInCamera(instance: unknown): boolean
  instanceIsAudible(instance: unknown): boolean
  isMouseInApp(evt: unknown): boolean
  isInteractionBlocked(): boolean
  doubleClicked?: boolean
  consumeUnitDoubleClick?(unit: RuntimeEntity): boolean
  registerUnitClick?(unit: RuntimeEntity): void
  getCellOnCamera?(callback: (cell: RuntimeCell) => void): void
  init?(): void
}

export interface SelectionRectangle {
  x: number
  y: number
  width: number
  height: number
  graph: Graphics
}

export interface GameContextLike {
  app: Application
  gamebox: HTMLElement
  map: RuntimeMap
  player: PlayerLike
  players: PlayerLike[]
  controls: ControlsLike
  menu: MenuLike
  scheduler: SchedulerLike
  performance?: PerformanceMonitorLike | null
  editor?: MapEditorLike
  paused?: boolean
  aiPaused?: boolean
  devConsoleOpen?: boolean
  victory?: boolean
  defeat?: boolean
  checkVictory?: () => boolean
  checkDefeat?: () => boolean
  save: () => unknown
  load: (event: unknown) => void
  pause: () => void
  resume: () => void
  restart: () => void
  quit: () => void
  applyZoom: () => void
}
