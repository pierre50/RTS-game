import { beginLoadTrace } from '../../../lib/loadDiagnostics'
import type { Bounds, Viewport } from '../../../types/geometry'

type TileHandle = { renderable: boolean; destroy(): void }
type Entry = { handle: TileHandle; lastUsed: number; bytes: number }

/** Only resident tiles have entries. Evict before allocating to bound peak texture memory. */
export class TerrainTextureCache {
  readonly entries = new Map<string, Entry>()
  bytes = 0
  resolution = 1
  private clock = 0

  constructor(
    private readonly bounds: Bounds,
    private readonly create: (bounds: Bounds, resolution: number) => TileHandle,
    readonly budget = 128 * 1024 * 1024,
    readonly tileSize = 1024,
    private readonly margin = 256
  ) {}

  update(viewport: Viewport): void {
    const size = this.tileSize
    const left = Math.max(this.bounds.minX, viewport.visibleLeft - this.margin)
    const top = Math.max(this.bounds.minY, viewport.visibleTop - this.margin)
    const right = Math.min(
      this.bounds.minX + this.bounds.width,
      viewport.visibleLeft + viewport.visibleWidth + this.margin
    )
    const bottom = Math.min(
      this.bounds.minY + this.bounds.height,
      viewport.visibleTop + viewport.visibleHeight + this.margin
    )
    const required = new Map<string, Bounds>()
    if (right > left && bottom > top) {
      for (let x = Math.floor(left / size); x < Math.ceil(right / size); x++) {
        for (let y = Math.floor(top / size); y < Math.ceil(bottom / size); y++) {
          required.set(`${x}:${y}`, { minX: x * size, minY: y * size, width: size, height: size })
        }
      }
    }
    let resolution = 1
    while (required.size * (size * resolution) ** 2 * 4 > this.budget) resolution /= 2
    if (resolution !== this.resolution) {
      this.destroy()
      this.resolution = resolution
    }
    const bytes = (size * resolution) ** 2 * 4
    const tick = ++this.clock
    for (const [key, entry] of this.entries) {
      entry.handle.renderable = required.has(key)
      if (required.has(key)) entry.lastUsed = tick
    }
    const missing = [...required].filter(([key]) => !this.entries.has(key))
    const trace = missing.length
      ? beginLoadTrace('terrain.textureCache', {
          residentTiles: this.entries.size,
          residentMiB: this.bytes / 1048576,
          budgetMiB: this.budget / 1048576,
          requiredTiles: required.size,
          missingTiles: missing.length,
          resolution,
        })
      : null
    let evicted = 0
    try {
      const cold = [...this.entries].filter(([key]) => !required.has(key)).sort((a, b) => a[1].lastUsed - b[1].lastUsed)
      for (const [key, entry] of cold) {
        if (this.bytes + missing.length * bytes <= this.budget) break
        evicted++
        entry.handle.destroy()
        this.entries.delete(key)
        this.bytes -= entry.bytes
      }
      for (const [key, bounds] of missing) {
        const handle = this.create(bounds, resolution)
        handle.renderable = true
        this.entries.set(key, { handle, lastUsed: tick, bytes })
        this.bytes += bytes
      }
      trace?.end({ residentTiles: this.entries.size, residentMiB: this.bytes / 1048576, evicted })
    } catch (error) {
      trace?.fail(error)
      throw error
    }
  }

  destroy(): void {
    for (const entry of this.entries.values()) entry.handle.destroy()
    this.entries.clear()
    this.bytes = 0
  }
}
