import type { Application, Container, Graphics } from 'pixi.js'
import type { RuntimeMap, RuntimeCell } from './map'
import type { PlayerLike } from './player'
import type { UnitEntity } from './entities'

export interface SchedulerLike {
  elapsedMs?: number
  timeScale?: number
  add(callback: () => void, time: number, name?: string): unknown
  remove(id: unknown): void
}

export interface PerformanceMonitorLike {
  measureSampled<T>(name: string, callback: () => T): T
  measure?<T>(name: string, callback: () => T): T
  record?(name: string, value: number): void
}

export interface MenuLike {
  selection?: unknown
  handleHotkey?(key: string): void
  showMessage(message: string, type?: string): void
  setBottombar(selection: unknown): void
  updateTopbar(): void
  updateTerrainMiniMap?(i: number, j: number): void
  updatePlayerMiniMapEvt?(player: PlayerLike): void
}

export interface ControlsLike extends Container {
  context: GameContextLike
  camera: { x: number; y: number }
  mouse: { x: number; y: number; prevent?: boolean }
  pointerStart?: { x: number; y: number } | null
  mouseBuilding?: (Container & { type?: string; isFree?: boolean }) | null
  mouseRectangle?: SelectionRectangle | null
  screenToLocal(x: number, y: number): { x: number; y: number }
  localToScreen(x: number, y: number): { x: number; y: number }
  getViewportMetrics(): { visibleHeight: number; visibleWidth: number; visibleLeft: number; visibleTop: number }
  removeMouseBuilding(): void
  instanceInCamera?(instance: unknown): boolean
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
  players?: PlayerLike[]
  controls: ControlsLike
  menu: MenuLike
  scheduler?: SchedulerLike
  performance?: PerformanceMonitorLike | null
  editor?: unknown
  paused?: boolean
  devConsoleOpen?: boolean
  victory?: boolean
  defeat?: boolean
  save?: () => unknown
  load?: (event: unknown) => void
}

export type CellCommand = (cell: RuntimeCell) => void
export type SelectedUnits = UnitEntity[]
