import type {
  KnownVisionOccupant,
  SerializedViewCell,
  SerializedVisionGrid,
  VisionViewer,
  VisionViewerRef,
} from '../types/vision'

export class VisionGrid {
  static EMPTY_VIEWERS: ReadonlySet<VisionViewerRef> = Object.freeze(new Set<VisionViewerRef>())

  activeSpaceId: string
  explored: Uint8Array
  exploredBySpace: Map<string, Uint8Array>
  knownOccupants: Map<number, KnownVisionOccupant>
  knownOccupantsBySpace: Map<string, Map<number, KnownVisionOccupant>>
  length: number
  onViewed: ((i: number, j: number) => void) | null
  onVisibilityChange: ((i: number, j: number) => void) | null
  size: number
  stride: number
  visibleBy: Map<number, Set<VisionViewerRef>>
  visibleBySpace: Map<string, Map<number, Set<VisionViewerRef>>>
  visibleCount: Uint16Array
  visibleCountBySpace: Map<string, Uint16Array>

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
    this.explored = new Uint8Array(this.length)
    this.exploredBySpace = new Map()
    this.visibleCount = new Uint16Array(this.length)
    this.visibleCountBySpace = new Map()
    this.visibleBy = new Map()
    this.visibleBySpace = new Map()
    this.knownOccupants = new Map()
    this.knownOccupantsBySpace = new Map()
    this.onViewed = onViewed
    this.onVisibilityChange = onVisibilityChange

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

  private getExplored(): Uint8Array {
    if (this.isOutsideSpace()) return this.explored
    let explored = this.exploredBySpace.get(this.activeSpaceId)
    if (!explored) {
      explored = new Uint8Array(this.length)
      this.exploredBySpace.set(this.activeSpaceId, explored)
    }
    return explored
  }

  private getVisibleCount(): Uint16Array {
    if (this.isOutsideSpace()) return this.visibleCount
    let visibleCount = this.visibleCountBySpace.get(this.activeSpaceId)
    if (!visibleCount) {
      visibleCount = new Uint16Array(this.length)
      this.visibleCountBySpace.set(this.activeSpaceId, visibleCount)
    }
    return visibleCount
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

  isViewed(i: number, j: number): boolean {
    return this.inBounds(i, j) && this.getExplored()[this.index(i, j)] === 1
  }

  setViewed(i: number, j: number, viewed = true, notify = true): boolean {
    if (!this.inBounds(i, j)) return false
    const index = this.index(i, j)
    const next = viewed ? 1 : 0
    const explored = this.getExplored()
    if (explored[index] === next) return false
    explored[index] = next
    if (next && notify) this.onViewed?.(i, j)
    return true
  }

  isVisible(i: number, j: number): boolean {
    return this.inBounds(i, j) && this.getVisibleCount()[this.index(i, j)] > 0
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
    this.getVisibleCount()[index] = viewers.size
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
    this.getVisibleCount()[index] = viewers.size
    if (!viewers.size) visibleBy.delete(index)
    this.onVisibilityChange?.(i, j)
    return true
  }

  removeViewerEverywhere(instance: VisionViewer): number[] {
    const changed: number[] = []
    const visibleBy = this.getVisibleBy()
    const visibleCount = this.getVisibleCount()
    for (const [index, viewers] of visibleBy) {
      if (!viewers.delete(instance)) continue
      visibleCount[index] = viewers.size
      if (!viewers.size) visibleBy.delete(index)
      changed.push(index)
      const [i, j] = this.coordinates(index)
      this.onVisibilityChange?.(i, j)
    }
    return changed
  }

  clearVisibility(): void {
    this.getVisibleBy().clear()
    this.getVisibleCount().fill(0)
  }

  clearExploration(): void {
    this.getExplored().fill(0)
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
    const visibleCount = this.getVisibleCount()
    for (const [index, viewers] of visibleBy) {
      const restored = new Set<VisionViewer>()
      for (const viewer of viewers) {
        const instance = typeof viewer === 'string' ? resolve(viewer) : viewer
        if (instance) restored.add(instance)
      }
      if (restored.size) {
        visibleBy.set(index, restored)
        visibleCount[index] = restored.size
      } else {
        visibleBy.delete(index)
        visibleCount[index] = 0
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
