import type { Application, Container, Graphics } from 'pixi.js'
import type { RuntimeMap, RuntimeCell } from './map'
import type { PlayerLike } from './player'
import type { RuntimeEntity, PlaceableBuildingConfig, UnitEntity, BuildingEntity, ResourceEntity } from './entities'
import type { MenuButtonSpec, MinimapPlayerCanvas } from './ui'
import type { HeroEquippedItem } from '../lib/heroTools'
import type { FactionSave, WorldGraphSave } from './save'
import type { Bounds } from './geometry'

export interface DayNightStateLike {
  day: number
  darkness: number
  hour: number
  minute: number
  phase: string
}

export type DayNightColorAdjustment = {
  blue: number
  brightness: number
  contrast: number
  gamma: number
  green: number
  red: number
  saturation: number
}

export interface DayNightSystemLike {
  getColorAdjustment(): DayNightColorAdjustment
  getDarknessLevel(): number
  getElapsedMs(): number
  getDayLabel(): string
  getTimeLabel(): string
  onDayChange?(callback: (day: number, previousDay: number) => void): () => void
  state: DayNightStateLike
}

export interface WeatherSystemLike {
  debugState?(): object
  forcePhase?(phase: string): void
  getDarknessLevel?(): number
  phase?: string
}

export type SchedulerTaskId = number

export type NpcOrdersOpenOptions = { chatterLine?: string; ordersEnabled?: boolean }

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
  playUiClick?(): void
  showMessage(message: string, type?: string): void
  setActionTarget(selection?: RuntimeEntity | null): void
  updateTopbar(): void
  updateActionTarget(): void
  updateTerrainMiniMap?(i: number, j: number): void
  rebuildTerrainMiniMapFromViews?(): void
  updateResourcesMiniMap(): void
  updateCameraMiniMap?(): void
  updatePlayerMiniMap?(player: PlayerLike): void
  updatePlayerMiniMapEvt(player: PlayerLike): void
  updateInfo(id: string, value: string | number | ((element: HTMLElement) => void)): void
  updateButtonContent(id: string, value: string | number | ((element: HTMLElement) => void)): void
  toggleQueuedActionCancel(id: string, enabled: boolean): void
  getActionUnitButton(type: string, building?: BuildingEntity): MenuButtonSpec
  getActionTechnologyButton(type: string): MenuButtonSpec
  getHeroTechnologyButtons?(): MenuButtonSpec[]
  getActionRallyPointButton(): MenuButtonSpec
  getActionBuildingButton(type: string, ownerOverride?: PlayerLike | null): MenuButtonSpec
  init?(): void
  destroy?(): void
  toggleInventory?(): void
  closeInventory?(): void
  isInventoryOpen?(): boolean
  syncTechnologyProgress?(): void
  setEquippedItem?(item: HeroEquippedItem | null): void
  setEquippedTool?(tool: HeroEquippedItem | null): void
  setHeroStatusTarget?(hero: UnitEntity | null): void
  updateHeroStatus?(hero?: UnitEntity | null): void
  toggleNpcOrders?(npcs: UnitEntity[]): void
  openNpcOrders?(npcs: UnitEntity[], options?: NpcOrdersOpenOptions): void
  isNpcOrdersOpen?(): boolean
  closeNpcOrders?(): void
  getNpcOrdersTarget?(): UnitEntity[]
  openHeroBuildingMenu?(building: BuildingEntity): boolean
  openEntityInfoModal?(entity: RuntimeEntity): boolean
  isEntityInfoModalOpen?(): boolean
  closeEntityInfoModal?(): void
  syncEntityInfoModal?(): void
  isHeroBuildingMenuOpen?(): boolean
  closeHeroBuildingMenu?(): void
  getHeroBuildingMenuTarget?(): BuildingEntity | null
  refreshHeroBuildingMenu?(): void
  syncHeroBuildingMenu?(): void
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
  mouseBuilding?: (Container & { type?: string; isFree?: boolean }) | null
  entityPreview?: EntityPreviewLike | null
  rallyPointController?: RallyPointControllerLike
  screenToLocal(x: number, y: number): { x: number; y: number }
  localToScreen(x: number, y: number): { x: number; y: number }
  getViewportMetrics(): { visibleHeight: number; visibleWidth: number; visibleLeft: number; visibleTop: number }
  removeMouseBuilding(): void
  setMouseBuilding?(building: PlaceableBuildingConfig): void
  setCamera?(x: number, y: number, direct?: boolean): void
  updateVisibleCells?(): void
  instanceInCamera(instance: { x: number; y: number }, bounds?: Bounds): boolean
  instanceIsAudible(instance: AudibleInstanceLike): boolean
  isMouseInApp(evt: ControlPointerEvent): boolean
  isInteractionBlocked(): boolean
  getCellOnCamera?(callback: (cell: RuntimeCell) => void): void
  init?(): void
  heroUnit?: UnitEntity | null
  equippedItem?: HeroEquippedItem | null
  equippedTool?: HeroEquippedItem | null
  heroActionHeld?: boolean
  setEquippedItem?(item: HeroEquippedItem | null): void
  setEquippedTool?(tool: HeroEquippedItem | null): void
  isHeroControlActive?(): boolean
  beginNpcGoTo?(npcs: UnitEntity[]): void
  openHeroEntityInteraction?(target?: RuntimeEntity | null): boolean
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
  ctrlKey?: boolean
  altKey?: boolean
  target?: EventTarget | null
  type?: string
  nativeEvent?: {
    clientX?: number
    clientY?: number
    target?: EventTarget | null
  } | null
}

interface EditorInteractionTarget {
  handleEntityInteraction(entity: RuntimeEntity): boolean | void
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
  dayNight?: DayNightSystemLike | null
  weather?: WeatherSystemLike | null
  editor?: EditorInteractionTarget
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
  getWorldGraph?: () => WorldGraphSave | null
  getCampaignFactions?: () => Record<string, FactionSave> | null
  changeFactionRelation?: (factionId: string, delta: number, reason?: string) => void
  getCurrentWorldId?: () => string | null
  travelThroughPortal?: (portal: ResourceEntity, color: 'blue' | 'yellow' | 'red') => void
}

export type AudibleInstanceLike = {
  x?: number
  y?: number
  owner?: { isPlayed?: boolean; owner?: { isPlayed?: boolean }; visible?: boolean }
  target?: { visible?: boolean }
  visible?: boolean
}
