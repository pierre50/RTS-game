import type { Texture } from 'pixi.js'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'

export type CellMapLike = {
  grid: RuntimeCell[][]
  size: number
  revealEverything?: boolean
  seed?: string | number
  randomRange(min: number, max: number): number
  randomItem<T>(items: T[]): T
  invalidateReliefCoastDistances?: () => void
  invalidateWaterOverlay?: () => void
  registerWaterBorderSurface?: (
    sprite: { texture: Texture; destroyed?: boolean },
    frames: Texture[],
    initialFrame?: number
  ) => () => void
}

export type CellContextLike = {
  map: CellMapLike
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

export type CellTerrainAppearance = {
  patchBorders: Set<string> | null
  patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
  relief: { index: number; elevation: number } | null
  waterBorder: { resourceName: string; index: number } | null
}

export type CellConfig = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
}

export type CellCommonStateSource = {
  i: number
  j: number
  z?: number
  type: string
  category?: string
  color?: string | number
  assets?: TextureRef[]
  terrainTextureName?: string
  solid?: boolean
  visible?: boolean
  inclined?: boolean
  border?: boolean
  waterBorder?: boolean
  terrainHidden?: boolean
  viewed?: boolean
  viewBy?: Set<VisionViewerRef>
  has?: RuntimeEntity | null
  corpses?: Set<RuntimeEntity>
  fogSprites?: FogSpriteMemory[]
  _hasFog?: boolean
  _terrainAppearance?: CellTerrainAppearance
}

export type CellCommonStateTarget = CellCommonStateSource & {
  _terrainAppearance: CellTerrainAppearance
  assets: TextureRef[]
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  has: RuntimeEntity | null
  terrainTextureName: string
  viewBy: Set<VisionViewerRef>
  z: number
}

export function createEmptyTerrainAppearance(): CellTerrainAppearance {
  return {
    patchBorders: null,
    patchBorderGroundType: null,
    relief: null,
    waterBorder: null,
  }
}

export function assignCellCommonState(target: CellCommonStateTarget, source: CellCommonStateSource): void {
  target.i = source.i
  target.j = source.j
  target.type = source.type
  target.z = source.z ?? 0
  target.category = source.category
  target.color = source.color
  target.assets = source.assets ?? []
  target.terrainTextureName = source.terrainTextureName ?? ''
  target.solid = source.solid ?? false
  target.visible = source.visible ?? false
  target.inclined = source.inclined ?? false
  target.border = source.border ?? false
  target.waterBorder = source.waterBorder ?? false
  target.terrainHidden = source.terrainHidden ?? false
  target.viewed = source.viewed ?? false
  target.viewBy = source.viewBy ?? new Set()
  target.has = source.has ?? null
  target.corpses = source.corpses ?? new Set()
  target.fogSprites = source.fogSprites ?? []
  target._hasFog = source._hasFog ?? false
  target._terrainAppearance = source._terrainAppearance ?? createEmptyTerrainAppearance()
}
