import type { RuntimeEntity } from './entities'

export type VisionViewer = { label: string }
export type VisionViewerRef = VisionViewer | string

export type SerializedViewCell = {
  viewed?: boolean
  viewBy?: VisionViewerRef[]
}

export type SerializedVisionGrid = SerializedViewCell[][]

export type KnownVisionOccupant = RuntimeEntity
