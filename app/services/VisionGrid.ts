import type {
  KnownVisionOccupant,
  SerializedViewCell,
  SerializedVisionGrid,
  VisionViewer,
  VisionViewerRef,
} from '../types/vision'

export class VisionGrid {
  static EMPTY_VIEWERS: ReadonlySet<VisionViewerRef> = Object.freeze(new Set<VisionViewerRef>())

  explored: Uint8Array
  knownOccupants: Map<number, KnownVisionOccupant>
  length: number
  onViewed: ((i: number, j: number) => void) | null
  size: number
  stride: number
  visibleBy: Map<number, Set<VisionViewerRef>>
  visibleCount: Uint16Array

  constructor(
    size: number,
    savedViews: SerializedVisionGrid = [],
    onViewed: ((i: number, j: number) => void) | null = null,
    revealTerrain = false
  ) {
    this.size = size
    this.stride = size + 1
    this.length = this.stride * this.stride
    this.explored = new Uint8Array(this.length)
    this.visibleCount = new Uint16Array(this.length)
    this.visibleBy = new Map()
    this.knownOccupants = new Map()
    this.onViewed = onViewed

    for (let i = 0; i < this.stride; i++) {
      for (let j = 0; j < this.stride; j++) {
        const saved = savedViews?.[i]?.[j]
        const index = this.index(i, j)
        if (revealTerrain || saved?.viewed) this.explored[index] = 1
        if (saved?.viewBy?.length) {
          const viewers = new Set<VisionViewerRef>(saved.viewBy)
          this.visibleBy.set(index, viewers)
          this.visibleCount[index] = viewers.size
        }
      }
    }
  }

  index(i: number, j: number): number {
    return i * this.stride + j
  }

  coordinates(index: number): [number, number] {
    return [Math.floor(index / this.stride), index % this.stride]
  }

  inBounds(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.stride && j < this.stride
  }

  isViewed(i: number, j: number): boolean {
    return this.inBounds(i, j) && this.explored[this.index(i, j)] === 1
  }

  setViewed(i: number, j: number, viewed = true, notify = true): boolean {
    if (!this.inBounds(i, j)) return false
    const index = this.index(i, j)
    const next = viewed ? 1 : 0
    if (this.explored[index] === next) return false
    this.explored[index] = next
    if (next && notify) this.onViewed?.(i, j)
    return true
  }

  isVisible(i: number, j: number): boolean {
    return this.inBounds(i, j) && this.visibleCount[this.index(i, j)] > 0
  }

  addViewer(i: number, j: number, instance: VisionViewer): boolean {
    if (!this.inBounds(i, j) || !instance) return false
    const index = this.index(i, j)
    let viewers = this.visibleBy.get(index)
    if (!viewers) {
      viewers = new Set()
      this.visibleBy.set(index, viewers)
    }
    const before = viewers.size
    viewers.add(instance)
    this.visibleCount[index] = viewers.size
    return viewers.size !== before
  }

  removeViewer(i: number, j: number, instance: VisionViewer): boolean {
    if (!this.inBounds(i, j)) return false
    const index = this.index(i, j)
    const viewers = this.visibleBy.get(index)
    if (!viewers?.delete(instance)) return false
    this.visibleCount[index] = viewers.size
    if (!viewers.size) this.visibleBy.delete(index)
    return true
  }

  hasViewer(i: number, j: number, instance: VisionViewer): boolean {
    return this.inBounds(i, j) && (this.visibleBy.get(this.index(i, j))?.has(instance) ?? false)
  }

  getViewers(i: number, j: number): ReadonlySet<VisionViewerRef> {
    if (!this.inBounds(i, j)) return VisionGrid.EMPTY_VIEWERS
    return this.visibleBy.get(this.index(i, j)) ?? VisionGrid.EMPTY_VIEWERS
  }

  getKnownOccupant(i: number, j: number): KnownVisionOccupant | null {
    if (!this.inBounds(i, j)) return null
    return this.knownOccupants.get(this.index(i, j)) ?? null
  }

  setKnownOccupant(i: number, j: number, occupant: KnownVisionOccupant | null): void {
    if (!this.inBounds(i, j)) return
    const index = this.index(i, j)
    if (occupant) this.knownOccupants.set(index, occupant)
    else this.knownOccupants.delete(index)
  }

  restoreViewers(resolve: (label: string) => VisionViewer | null): void {
    for (const [index, viewers] of this.visibleBy) {
      const restored = new Set<VisionViewer>()
      for (const viewer of viewers) {
        const instance = typeof viewer === 'string' ? resolve(viewer) : viewer
        if (instance) restored.add(instance)
      }
      if (restored.size) {
        this.visibleBy.set(index, restored)
        this.visibleCount[index] = restored.size
      } else {
        this.visibleBy.delete(index)
        this.visibleCount[index] = 0
      }
    }
  }

  toJSON(): SerializedVisionGrid {
    return Array.from({ length: this.stride }, (_, i) =>
      Array.from({ length: this.stride }, (_, j) => {
        const out: SerializedViewCell = {}
        if (this.isViewed(i, j)) out.viewed = true
        const viewBy = [...this.getViewers(i, j)]
          .map(instance =>
            instance && typeof instance === 'object' && 'label' in instance ? instance.label : instance
          )
          .filter(Boolean)
        if (viewBy.length) out.viewBy = viewBy
        return out
      })
    )
  }
}
