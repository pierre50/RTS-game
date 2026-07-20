import type { Application, Container, Graphics } from 'pixi.js'
import type { RuntimeMap, RuntimeCell } from './map'
import type { PlayerLike } from './player'
import type { RuntimeEntity, PlaceableBuildingConfig, UnitEntity, BuildingEntity } from './entities'
import type { MapEditorLike } from './mapEditor'
import type { MenuButtonSpec, MinimapPlayerCanvas } from './ui'
import type { HeroTool } from '../lib/heroTools'
import type { Bounds } from './geometry'

export type SchedulerTaskId = number

export interface SchedulerLike {
  elapsedMs: number
  timeScale?: number
  add(callback: () => void, time: number, name?: string): SchedulerTaskId
  remove(id: SchedulerTaskId): void
  update(id: SchedulerTaskId, time: number): void
  addOneShot(callback: () => void, time: number, name?: string): SchedulerTaskId
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
  toggleQueuedActionCancel(id: string, enabled: boolean): void
  getActionUnitButton(type: string): MenuButtonSpec
  getActionTechnologyButton(type: string): MenuButtonSpec
  getActionRallyPointButton(): MenuButtonSpec
  getActionDepositButton(building: BuildingEntity): MenuButtonSpec
  getActionBuildingButton(type: string, ownerOverride?: PlayerLike | null): MenuButtonSpec
  init?(): void
  destroy?(): void
  toggleInventory?(): void
  closeInventory?(): void
  isInventoryOpen?(): boolean
  setEquippedTool?(tool: HeroTool | null): void
  setHeroStatusTarget?(hero: UnitEntity | null): void
  updateHeroStatus?(hero?: UnitEntity | null): void
  toggleNpcOrders?(npcs: UnitEntity[]): void
  openNpcOrders?(npcs: UnitEntity[]): void
  isNpcOrdersOpen?(): boolean
  closeNpcOrders?(): void
  getNpcOrdersTarget?(): UnitEntity[]
  openArpgBuildingMenu?(building: BuildingEntity): boolean
  isArpgBuildingMenuOpen?(): boolean
  closeArpgBuildingMenu?(): void
  getArpgBuildingMenuTarget?(): BuildingEntity | null
  refreshArpgBuildingMenu?(): void
  closeArpgBuildingMenuIfInvalid?(): void
}

interface EntityPreviewLike {
  set(selection: RuntimeEntity | PlaceableBuildingConfig | null): void
}

interface MinimapManagerLike {
  getMinimapFactor(): number
}

export interface MinimapHostLike {
  context: GameContextLike
  gameHud: HTMLDivElement
  bottombar: HTMLDivElement
  bottombarMap?: HTMLDivElement
  minimapMap?: HTMLDivElement
  terrainMinimap: HTMLCanvasElement
  resourcesMinimap: HTMLCanvasElement
  cameraMinimap: HTMLCanvasElement
  playersMinimap: MinimapPlayerCanvas[]
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
  setMouseBuilding?(building: PlaceableBuildingConfig): void
  setCamera?(x: number, y: number, direct?: boolean): void
  sendUnits?(cell: RuntimeCell): void
  updateVisibleCells?(): void
  instanceInCamera(instance: { x: number; y: number }, bounds?: Bounds): boolean
  instanceIsAudible(instance: AudibleInstanceLike): boolean
  isMouseInApp(evt: ControlPointerEvent): boolean
  isInteractionBlocked(): boolean
  doubleClicked?: boolean
  consumeUnitDoubleClick?(unit: RuntimeEntity): boolean
  registerUnitClick?(unit: RuntimeEntity): void
  getCellOnCamera?(callback: (cell: RuntimeCell) => void): void
  init?(): void
  heroUnit?: UnitEntity | null
  equippedTool?: HeroTool | null
  heroActionHeld?: boolean
  setEquippedTool?(tool: HeroTool | null): void
  isArpgActive?(): boolean
  beginNpcGoTo?(npcs: UnitEntity[]): void
  freeCameraActive?: boolean
  setFreeCamera?(enabled: boolean): void
}

export interface SelectionRectangle {
  x: number
  y: number
  width: number
  height: number
  graph: Graphics
}

export type ControlPointerEvent = {
  clientX?: number
  clientY?: number
  target?: EventTarget | null
  type?: string
  nativeEvent?: {
    clientX?: number
    clientY?: number
    target?: EventTarget | null
  } | null
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
  devConsoleOpen?: boolean
  victory?: boolean
  defeat?: boolean
  checkVictory?: () => boolean
  checkDefeat?: () => boolean
  save: () => object | void
  load: (event: object) => void
  pause: () => void
  resume: () => void
  restart: () => void
  quit: () => void
  applyZoom: () => void
}

export type AudibleInstanceLike = {
  x?: number
  y?: number
  owner?: { isPlayed?: boolean; owner?: { isPlayed?: boolean }; visible?: boolean }
  target?: { visible?: boolean }
  visible?: boolean
}
