import type { Container, Sprite } from 'pixi.js'
import type { TextureRef } from '../../../lib'
import type { GridPosition } from '../../../types/grid'
import type * as MapTypes from '../../../types/map'

export type PatchBorderGroundType = 'Desert' | 'Dirt' | 'Snow'

export type TerrainCell = MapTypes.RuntimeCell & {
  category?: string
  color?: string | number
  assets?: TextureRef[]
  terrainTextureName?: string
  has?: MapTypes.RuntimeCell['has']
  sprite?: Sprite | null
  setTerrainType?(type: string): void
  setWater?(): void
  setWaterBorder?(resourceName: string, frame: string): void
  setReliefBorder?(frame: string, elevation?: number): void
  setPatchBorder?(direction: string, groundType?: PatchBorderGroundType): void
  resetTerrainAppearance?(options?: { preserveWaterBorder?: boolean }): void
}

export type TerrainMap = Container & {
  size: number
  seed?: string | number
  environment?: string
  grid: TerrainCell[][]
  playersPos: Array<GridPosition | null>
  terrainBackfill?: Container | null
  generationTimings?: Record<string, number>
  blueprintWaterBorderReady?: boolean
  pregeneratedBlueprintId?: string | number | null
  getReliefCoastDistances(): Int16Array
  getMaxReliefLevelFromCoastDistance(distance: number): number
  getMinReliefLevelFromCoastDistance(distance: number): number
  setCellReliefLevelDirect(cell: TerrainCell, level: number): void
  clampReliefAroundWater(dist?: Int16Array): void
  flattenPlayerStartZones(radius?: number): void
  formatCellsWaterBorder(): void
  clampReliefAroundWaterLevels(): ReliefLevelBounds
  enforceReliefStepContinuity(
    dist?: Int16Array,
    protectedCells?: Set<TerrainCell>,
    levelBounds?: ReliefLevelBounds
  ): void
  formatCellsRelief(): void
  formatCellsWaterBorderOverlays(): void
  formatCellsPatchBorders(): void
}

export type ReliefLevelBounds = {
  minLevels: Int16Array
  maxLevels: Int16Array
}
