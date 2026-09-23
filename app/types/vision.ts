import type { RuntimeEntity } from './entities'

export type VisionViewer = { label: string }
export type VisionViewerRef = VisionViewer | string

export type SerializedViewCell = {
  viewed?: boolean
  viewBy?: VisionViewerRef[]
}

export type CompactVisionGrid = {
  version: 1
  stride: number
  chunkSize: 64
  explored: { i: number; j: number; bits: string }[]
  visible: { index: number; viewBy: string[] }[]
}

export type SerializedVisionGrid = SerializedViewCell[][] | CompactVisionGrid

export type KnownVisionOccupant = RuntimeEntity
