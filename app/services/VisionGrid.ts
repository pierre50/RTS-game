import { ExplorationSaveChunks, readCompactVision, VISION_CHUNK_SIZE } from '../serialization/CompactVision'
import type {
  KnownVisionOccupant,
  CompactVisionGrid,
  SerializedVisionGrid,
  VisionViewer,
  VisionViewerRef,
} from '../types/vision'

export class VisionGrid {
  static EMPTY_VIEWERS: ReadonlySet<VisionViewerRef> = Object.freeze(new Set<VisionViewerRef>())

  private explorationChunks = new Map<string, ExplorationSaveChunks>()

  activeSpaceId: string
  knownOccupants: Map<number, KnownVisionOccupant>
  knownOccupantsBySpace: Map<string, Map<number, KnownVisionOccupant>>
  length: number
  onViewed: ((i: number, j: number) => void) | null
  onVisibilityChange: ((i: number, j: number) => void) | null
  size: number
  stride: number
  visibleBy: Map<number, Set<VisionViewerRef>>
  visibleBySpace: Map<string, Map<number, Set<VisionViewerRef>>>

  constructor(
    size: number,
    savedViews: SerializedVisionGrid = [],
    onViewed: ((i: number, j: number) => void) | null = null,
    revealTerrain = false,
    onVisibilityChange: ((i: number, j: number) => void) | null = null
  ) {
    this.size = size
    this.stride = size + 1
    this.length = this.stride * this.stride
    this.activeSpaceId = 'outside'
    this.visibleBy = new Map()
    this.visibleBySpace = new Map()
    this.knownOccupants = new Map()
    this.knownOccupantsBySpace = new Map()
    this.onViewed = onViewed
    this.onVisibilityChange = onVisibilityChange

    if (revealTerrain) {
      this.getExplorationChunks().revealAll(this.stride)
    }
    if (Array.isArray(savedViews)) {
      for (let i = 0; i < Math.min(savedViews.length, this.stride); i++) {
        const row = savedViews[i] ?? []
        for (let j = 0; j < Math.min(row.length, this.stride); j++) {
          const saved = row[j]
          if (saved?.viewed) this.setViewed(i, j, true, false)
          if (saved?.viewBy?.length) {
            const index = this.index(i, j)
            const viewers = new Set<VisionViewerRef>(saved.viewBy)
            this.visibleBy.set(index, viewers)
          }
        }
      }
    } else {
      const data = readCompactVision(savedViews, this.stride)
      if (!revealTerrain) this.getExplorationChunks().restore(data.chunks)
      for (const entry of data.visible) {
        this.visibleBy.set(entry.index, new Set(entry.viewBy))
      }
    }
  }

  private getExplorationChunks(): ExplorationSaveChunks {
    let chunks = this.explorationChunks.get(this.activeSpaceId)
    if (!chunks) {
      chunks = new ExplorationSaveChunks()
      this.explorationChunks.set(this.activeSpaceId, chunks)
    }
    return chunks
  }

  index(i: number, j: number): number {
    return i * this.stride + j
  }

  coordinates(index: number): [number, number] {
    return [Math.floor(index / this.stride), index % this.stride]
  }

  withSpace<T>(spaceId: string | null | undefined, callback: () => T): T {
    const previousSpaceId = this.activeSpaceId
    this.activeSpaceId = spaceId || 'outside'
    try {
      return callback()
    } finally {
      this.activeSpaceId = previousSpaceId
    }
  }

  private isOutsideSpace(): boolean {
    return this.activeSpaceId === 'outside'
  }

  private getVisibleBy(): Map<number, Set<VisionViewerRef>> {
    if (this.isOutsideSpace()) return this.visibleBy
    let visibleBy = this.visibleBySpace.get(this.activeSpaceId)
    if (!visibleBy) {
      visibleBy = new Map()
      this.visibleBySpace.set(this.activeSpaceId, visibleBy)
    }
    return visibleBy
  }

  private getKnownOccupants(): Map<number, KnownVisionOccupant> {
    if (this.isOutsideSpace()) return this.knownOccupants
    let knownOccupants = this.knownOccupantsBySpace.get(this.activeSpaceId)
    if (!knownOccupants) {
      knownOccupants = new Map()
      this.knownOccupantsBySpace.set(this.activeSpaceId, knownOccupants)
    }
    return knownOccupants
  }

  inBounds(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.stride && j < this.stride
  }

  forEachViewed(callback: (i: number, j: number) => void): void {
    this.getExplorationChunks().forEachViewed(callback)
  }

  isViewed(i: number, j: number): boolean {
    return this.inBounds(i, j) && this.getExplorationChunks().has(i, j)
  }

  setViewed(i: number, j: number, viewed = true, notify = true): boolean {
    if (!this.inBounds(i, j)) return false
    if (this.getExplorationChunks().has(i, j) === viewed) return false
    this.getExplorationChunks().set(i, j, viewed)
    if (viewed && notify) this.onViewed?.(i, j)
    return true
  }

  isVisible(i: number, j: number): boolean {
    return this.inBounds(i, j) && (this.getVisibleBy().get(this.index(i, j))?.size ?? 0) > 0
  }

  addViewer(i: number, j: number, instance: VisionViewer): boolean {
    if (!this.inBounds(i, j) || !instance) return false
    const index = this.index(i, j)
    const visibleBy = this.getVisibleBy()
    let viewers = visibleBy.get(index)
    if (!viewers) {
      viewers = new Set()
      visibleBy.set(index, viewers)
    }
    const before = viewers.size
    viewers.add(instance)
    const changed = viewers.size !== before
    if (changed) this.onVisibilityChange?.(i, j)
    return changed
  }

  removeViewer(i: number, j: number, instance: VisionViewer): boolean {
    if (!this.inBounds(i, j)) return false
    const index = this.index(i, j)
    const visibleBy = this.getVisibleBy()
    const viewers = visibleBy.get(index)
    if (!viewers?.delete(instance)) return false
    if (!viewers.size) visibleBy.delete(index)
    this.onVisibilityChange?.(i, j)
    return true
  }

  removeViewerEverywhere(instance: VisionViewer): number[] {
    const changed: number[] = []
    const visibleBy = this.getVisibleBy()
    for (const [index, viewers] of visibleBy) {
      if (!viewers.delete(instance)) continue
      if (!viewers.size) visibleBy.delete(index)
      changed.push(index)
      const [i, j] = this.coordinates(index)
      this.onVisibilityChange?.(i, j)
    }
    return changed
  }

  clearVisibility(): void {
    this.getVisibleBy().clear()
  }

  clearExploration(): void {
    this.getExplorationChunks().clear()
    this.getKnownOccupants().clear()
  }

  hasViewer(i: number, j: number, instance: VisionViewer): boolean {
    return this.inBounds(i, j) && (this.getVisibleBy().get(this.index(i, j))?.has(instance) ?? false)
  }

  getViewers(i: number, j: number): ReadonlySet<VisionViewerRef> {
    if (!this.inBounds(i, j)) return VisionGrid.EMPTY_VIEWERS
    return this.getVisibleBy().get(this.index(i, j)) ?? VisionGrid.EMPTY_VIEWERS
  }

  getKnownOccupant(i: number, j: number): KnownVisionOccupant | null {
    if (!this.inBounds(i, j)) return null
    return this.getKnownOccupants().get(this.index(i, j)) ?? null
  }

  setKnownOccupant(i: number, j: number, occupant: KnownVisionOccupant | null): void {
    if (!this.inBounds(i, j)) return
    const index = this.index(i, j)
    const knownOccupants = this.getKnownOccupants()
    if (occupant) knownOccupants.set(index, occupant)
    else knownOccupants.delete(index)
  }

  restoreViewers(resolve: (label: string) => VisionViewer | null): void {
    const visibleBy = this.getVisibleBy()
    for (const [index, viewers] of visibleBy) {
      const restored = new Set<VisionViewer>()
      for (const viewer of viewers) {
        const instance = typeof viewer === 'string' ? resolve(viewer) : viewer
        if (instance) restored.add(instance)
      }
      if (restored.size) {
        visibleBy.set(index, restored)
      } else {
        visibleBy.delete(index)
      }
    }
  }

  toJSON(): CompactVisionGrid {
    return {
      version: 1,
      stride: this.stride,
      chunkSize: VISION_CHUNK_SIZE,
      explored: this.getExplorationChunks().snapshot(),
      visible: [...this.getVisibleBy()].map(([index, viewers]) => ({
        index,
        viewBy: [
          ...new Set([...viewers].map(viewer => (typeof viewer === 'string' ? viewer : viewer.label)).filter(Boolean)),
        ],
      })),
    }
  }
}
