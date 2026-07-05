import type { PlayerLike } from './player'
import type { RuntimeEntity } from './entities'
import type { RuntimeCell } from './map'
import type { PlayerSetupConfig } from './save'
import type { GameContextLike } from './context'

export interface MapEditorPlacementSelection {
  owner: PlayerLike
  type: string
  kind: string
}

export interface MapEditorLike {
  handleEntityInteraction(entity: RuntimeEntity): boolean
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

interface MapEditorHudLike {
  sync(): void
  setBottombar(selection?: RuntimeEntity | null): void
  updateStatus(cell: RuntimeCell | null): void
  updateResourcesMiniMap(): void
  revealTerrainMinimap(): void
  updateCameraMiniMap(): void
  init(): void
  destroy(): void
}

export interface MapEditorContextLike extends GameContextLike {
  editor: MapEditorLike
  editorConfig: { players: EditorPlayerConfig[] }
  editorState: MapEditorUiState
  hud: MapEditorHudLike | null
}
