import type { Container } from 'pixi.js'
import type { PlayerLike } from './player'
import type { RuntimeEntity } from './entities'
import type { RuntimeCell, RuntimeMap } from './map'
import type { PlayerSetupConfig } from './save'
import type { GameContextLike, MenuLike } from './context'

export interface MapEditorPlacementSelection {
  owner: PlayerLike
  type: string
  kind: string
}

export interface MapEditorLike {
  handleEntityInteraction(entity: RuntimeEntity): boolean
  canSelectEntities(): boolean
  handleUnitsModeMapClick(cell: RuntimeCell): boolean
  canPaintTerrain(): boolean
  applyBrush(cell: RuntimeCell): void
  _canWallUseCell(cell: RuntimeCell, owner: PlayerLike | null, allowExistingWall?: boolean): boolean
  exportMap(): void
  getPlacementOwners(): PlayerLike[]
  setPlacementSelection(ownerLabel: string | null, type: string | null, kind: string | null): void
  getPlacementSelection(): MapEditorPlacementSelection | null
  hasWallDraft(): boolean
  cancelWallDraft(): boolean
  removeEntity(instance: RuntimeEntity): boolean
  updatePlayersConfig(players: PlayerSetupConfig[]): void
}

export interface MapEditorUiState {
  mode: 'terrain' | 'units'
  brushType: string
  brushSize: number
  mapPaint: string
  elevationLevel: number
  placementOwnerLabel: string | null
  placementType: string | null
  placementKind: string | null
}

export type EditorPlayerConfig = PlayerSetupConfig & { age?: number }

export interface EditorConfig {
  players?: EditorPlayerConfig[]
  size?: number
  mapType?: string
  name?: string
}

interface MapEditorHudLike extends MenuLike {
  sync(): void
  updateStatus(cell: RuntimeCell | null): void
  updateCameraMiniMap(): void
  updateResourcesMiniMap(): void
  revealTerrainMinimap(): void
  init(): void
  destroy(): void
}

export interface MapEditorControlsLike extends Container {
  entityPreview?: { set(selection: MapEditorPlacementSelection | null): void }
  getViewportMetrics?(): { visibleHeight: number; visibleWidth: number; visibleLeft: number; visibleTop: number }
}

export interface MapEditorContextLike
  extends Omit<GameContextLike, 'controls' | 'editor' | 'map' | 'menu' | 'player'> {
  editor: MapEditorLike
  editorConfig: { players: EditorPlayerConfig[] }
  editorState: MapEditorUiState
  map: RuntimeMap | null
  menu: MapEditorHudLike | null
  hud: MapEditorHudLike | null
  controls: MapEditorControlsLike | null
  player: PlayerLike | null
}

export interface MapEditorReadyContext extends MapEditorContextLike {
  map: RuntimeMap
  menu: MapEditorHudLike
  hud: MapEditorHudLike
  controls: MapEditorControlsLike
  player: PlayerLike
}
