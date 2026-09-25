import { createPackedBlueprintGrid } from '../../serialization/PackedBlueprintGrid'
import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH, FAMILY_TYPES } from '../../constants'
import { createDeterministicCellVariantPicker } from '../../lib/random'
import { textureRefToString } from '../../lib/graphics/textures'
import { packedCellStores } from './PackedCellRegistry'
import { TERRAIN_TYPES } from '../../constants/blueprintTerrain'
import { createEmptyTerrainAppearance } from './CellTypes'
import type { GenerationCell } from './GenerationCell'
import type { RuntimeCell } from '../../types/map'

// Stable cell handles keep existing occupancy/path references valid. Only the index is
// stored on each handle; terrain and flags live in byte arrays, exceptional state is sparse.
type Handle = GenerationCell & { packedIndex: number }
type Extra = Partial<GenerationCell>
type Context = ConstructorParameters<typeof GenerationCell>[1]
type Definition = NonNullable<ConstructorParameters<typeof GenerationCell>[0]['definition']>
const FLAGS = ['solid', 'visible', 'inclined', 'border', 'waterBorder', 'terrainHidden'] as const

export const PACKED_TERRAIN_CHUNK_SIZE = 32
type SpatialBounds = { minX: number; minY: number; maxX: number; maxY: number }

function includePoint(bounds: SpatialBounds, x: number, y: number): void {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

export class PackedCellStore {
  private readonly baseChunks: Array<SpatialBounds | undefined> = []
  private readonly baseBounds: SpatialBounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  private minElevationOffset = 0
  private maxElevationOffset = 0
  materializedCount = 0
  resourceAt?: (index: number) => RuntimeCell['has']
  readonly flags: Uint8Array
  readonly extras = new Map<number, Extra>()
  readonly prototype: GenerationCell

  constructor(
    readonly types: Uint8Array,
    readonly heights: Int8Array,
    readonly stride: number,
    readonly context: Context,
    readonly definitions: Record<string, Definition>,
    cellPrototype: GenerationCell
  ) {
    this.flags = new Uint8Array(types.length)
    // Accessors receive the cell as `this`; their backing store is shared by the prototype.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const store = this
    const picker = createDeterministicCellVariantPicker(context.map.seed ?? 0)
    const prototype = Object.create(cellPrototype) as GenerationCell
    this.prototype = prototype
    const accessor = (name: string, get: (cell: Handle) => unknown, set?: (cell: Handle, value: never) => void) => {
      Object.defineProperty(prototype, name, {
        configurable: true,
        get(this: Handle) {
          return get(this)
        },
        set(this: Handle, value: never) {
          if (set) set(this, value)
          else store.extra(this.packedIndex)[name as keyof Extra] = value
        },
      })
    }
    const optional = <K extends keyof Extra>(cell: Handle, key: K, fallback: () => Extra[K]): Extra[K] =>
      store.extras.get(cell.packedIndex)?.[key] ?? fallback()
    const type = (cell: Handle) => {
      const value = store.types[cell.packedIndex]
      return value === 6 ? 'Water' : TERRAIN_TYPES[value] || 'Grass'
    }
    const definition = (cell: Handle) => store.definitions[cell.type] ?? {}
    Object.defineProperties(prototype, {
      context: { value: context },
      map: { value: context.map },
      family: { value: FAMILY_TYPES.cell },
      isGenerationCell: { value: true },
    })
    accessor(
      'i',
      cell => Math.floor(cell.packedIndex / stride),
      () => {
        throw new Error('Cell coordinates are immutable')
      }
    )
    accessor(
      'j',
      cell => cell.packedIndex % stride,
      () => {
        throw new Error('Cell coordinates are immutable')
      }
    )
    accessor(
      'type',
      cell => optional(cell, 'type', () => type(cell)),
      (cell, value: string) => {
        const code = TERRAIN_TYPES.indexOf(value)
        if (code >= 0) {
          store.types[cell.packedIndex] = code
          if (store.extras.has(cell.packedIndex)) delete store.extra(cell.packedIndex).type
        } else store.extra(cell.packedIndex).type = value
      }
    )
    accessor(
      'z',
      cell => optional(cell, 'z', () => store.heights[cell.packedIndex]),
      (cell, value: number) => {
        // Like GenerationCell, changing elevation alone does not move its rendered
        // origin until resetTerrainAppearance is called.
        if (value !== cell.z) store.extra(cell.packedIndex).y = cell.y
        if (Number.isInteger(value) && value >= -128 && value <= 127) {
          store.heights[cell.packedIndex] = value
          if (store.extras.has(cell.packedIndex)) delete store.extra(cell.packedIndex).z
        } else store.extra(cell.packedIndex).z = value
      }
    )
    accessor('x', cell => optional(cell, 'x', () => ((cell.i - cell.j) * CELL_WIDTH) / 2))
    accessor('y', cell => optional(cell, 'y', () => ((cell.i + cell.j) * CELL_HEIGHT) / 2 - cell.z * CELL_DEPTH))
    accessor('zIndex', cell => optional(cell, 'zIndex', () => cell.i + cell.j))
    for (const key of ['category', 'color', 'assets'] as const) {
      accessor(key, cell => optional(cell, key, () => definition(cell)[key] as Extra[typeof key]))
    }
    accessor('terrainTextureName', cell =>
      optional(cell, 'terrainTextureName', () => {
        const texture = picker(cell.assets, cell.i, cell.j)
        return texture ? textureRefToString(texture) : ''
      })
    )
    for (const [bit, key] of FLAGS.entries()) {
      accessor(
        key,
        cell => Boolean(store.flags[cell.packedIndex] & (1 << bit)),
        (cell, value: boolean) => {
          if (value) store.flags[cell.packedIndex] |= 1 << bit
          else store.flags[cell.packedIndex] &= ~(1 << bit)
        }
      )
    }
    for (const key of ['has', 'terrainSet'] as const) {
      accessor(
        key,
        cell => {
          const extra = store.extras.get(cell.packedIndex)
          if (extra && key in extra) return extra[key] ?? null
          return key === 'has' ? (store.resourceAt?.(cell.packedIndex) ?? null) : null
        },
        (cell, value) => {
          if (value != null || store.extras.has(cell.packedIndex)) store.extra(cell.packedIndex)[key] = value
        }
      )
    }
    accessor('corpses', cell => (store.extra(cell.packedIndex).corpses ??= new Set()))
    accessor('children', cell => (store.extra(cell.packedIndex).children ??= []))
    accessor(
      '_terrainAppearance',
      cell => (store.extra(cell.packedIndex)._terrainAppearance ??= createEmptyTerrainAppearance())
    )
    // Queries and resets during whole-map preparation must not create empty sidecars.
    prototype.getChildByLabel = function (this: Handle, label) {
      return store.extras.get(this.packedIndex)?.children?.find(child => child.label === label) ?? null
    }
    prototype.getTerrainDecorations = function (this: Handle) {
      return (
        store.extras
          .get(this.packedIndex)
          ?.children?.filter(child => child.label === 'floor' || child.label === 'set') ?? []
      )
    }
    prototype.resetTerrainAppearance = function (this: Handle, { preserveWaterBorder = false } = {}) {
      const extra = store.extras.get(this.packedIndex)
      if (extra) {
        delete extra.x
        delete extra.y
        if (extra._terrainAppearance) {
          const water = preserveWaterBorder ? extra._terrainAppearance.waterBorder : null
          extra._terrainAppearance = { ...createEmptyTerrainAppearance(), waterBorder: water }
        }
      }
      this.inclined = false
      if (!preserveWaterBorder) {
        if (this.waterBorder && !this.has) this.solid = false
        this.border = false
        this.waterBorder = false
      }
    }
  }

  private extra(index: number): Extra {
    let extra = this.extras.get(index)
    if (!extra) {
      extra = {}
      this.extras.set(index, extra)
    }
    return extra
  }

  create(i: number, j: number): GenerationCell {
    const cell = Object.create(this.prototype) as Handle
    cell.packedIndex = i * this.stride + j
    this.materializedCount++
    this.includeTerrainCell(i, j)
    return cell
  }

  private includeTerrainCell(i: number, j: number): void {
    const x = ((i - j) * CELL_WIDTH) / 2
    const offset = -this.heights[i * this.stride + j] * CELL_DEPTH
    const y = ((i + j) * CELL_HEIGHT) / 2 + offset
    this.minElevationOffset = Math.min(this.minElevationOffset, offset)
    this.maxElevationOffset = Math.max(this.maxElevationOffset, offset)
    includePoint(this.baseBounds, x, y)
    const key =
      Math.floor(i / PACKED_TERRAIN_CHUNK_SIZE) * Math.ceil(this.stride / PACKED_TERRAIN_CHUNK_SIZE) +
      Math.floor(j / PACKED_TERRAIN_CHUNK_SIZE)
    const bounds = this.baseChunks[key]
    if (bounds) includePoint(bounds, x, y)
    else this.baseChunks[key] = { minX: x, minY: y, maxX: x, maxY: y }
  }

  /** Index compact bytes without creating runtime cell objects. */
  indexTerrainRow(i: number): number {
    let count = 0
    for (let j = 0; j < this.stride; j++) {
      if (this.types[i * this.stride + j] === 255) continue
      this.includeTerrainCell(i, j)
      count++
    }
    return count
  }

  createLazyGrid(): RuntimeCell[][] {
    const grid = createPackedBlueprintGrid(
      this.types,
      this.stride,
      (_value, index) => this.create(Math.floor(index / this.stride), index % this.stride) as unknown as RuntimeCell,
      index => this.types[index] !== 255,
      true
    )
    this.attach(grid)
    return grid
  }

  attach(grid: RuntimeCell[][]): void {
    packedCellStores.set(grid, this)
  }

  /** The dense flags have no per-cell allocation. */
  markVisible(): void {
    for (let index = 0; index < this.flags.length; index++) this.flags[index] |= 2
  }

  resetAppearance(): void {
    for (let index = 0; index < this.flags.length; index++) {
      if (this.flags[index] & 16 && !this.extras.get(index)?.has) this.flags[index] &= ~1
      this.flags[index] &= ~(4 | 8 | 16)
    }
    for (const extra of this.extras.values()) {
      delete extra.x
      delete extra.y
      if (extra._terrainAppearance) extra._terrainAppearance = createEmptyTerrainAppearance()
    }
  }

  /** Conservative bounds: sparse edits can expand them without scanning the grid. */
  spatialBounds(): {
    bounds: SpatialBounds
    chunks: Array<SpatialBounds | undefined>
    minOffset: number
    maxOffset: number
  } {
    const bounds = { ...this.baseBounds }
    const chunks = this.baseChunks.map(chunk => chunk && { ...chunk })
    let minOffset = this.minElevationOffset
    let maxOffset = this.maxElevationOffset
    const chunkCount = Math.ceil(this.stride / PACKED_TERRAIN_CHUNK_SIZE)
    for (const [index, extra] of this.extras) {
      const i = Math.floor(index / this.stride),
        j = index % this.stride
      const x = extra.x ?? ((i - j) * CELL_WIDTH) / 2
      const baseY = ((i + j) * CELL_HEIGHT) / 2
      const y = extra.y ?? baseY - (extra.z ?? this.heights[index]) * CELL_DEPTH
      includePoint(bounds, x, y)
      minOffset = Math.min(minOffset, y - baseY)
      maxOffset = Math.max(maxOffset, y - baseY)
      const key = Math.floor(i / PACKED_TERRAIN_CHUNK_SIZE) * chunkCount + Math.floor(j / PACKED_TERRAIN_CHUNK_SIZE)
      const chunk = chunks[key]
      if (chunk) includePoint(chunk, x, y)
      else chunks[key] = { minX: x, minY: y, maxX: x, maxY: y }
    }
    return { bounds, chunks, minOffset, maxOffset }
  }

  elevationBounds(): { min: number; max: number } {
    const bounds = this.spatialBounds()
    return { min: bounds.minOffset, max: bounds.maxOffset }
  }

  *changedCells<T extends RuntimeCell>(grid: T[][]): Iterable<T> {
    for (const index of this.extras.keys()) {
      const cell = grid[Math.floor(index / this.stride)]?.[index % this.stride]
      if (cell) yield cell
    }
  }
}
