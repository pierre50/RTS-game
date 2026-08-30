import { FAMILY_TYPES } from '../../constants'
import type { ContainerChild } from 'pixi.js'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'
import {
  assignCellCommonState,
  createEmptyTerrainAppearance,
  type CellCommonStateSource,
  type CellCommonStateTarget,
} from './CellTypes'

export type LogicalCellContext = {
  map: {
    fogMemoryLayer?: { addChild<T extends ContainerChild>(child: T): T }
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

export type TerrainAppearance = {
  patchBorders?: Set<string> | null
  patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
  relief?: { index: number; elevation: number } | null
  waterBorder?: { resourceName: string; index: number } | null
}

export type LogicalCellSource = CellCommonStateSource & {
  context: LogicalCellContext
  map?: object
  x: number
  y: number
  zIndex?: number
  terrainSet?: ContainerChild | null
}

export class LogicalCell {
  context: LogicalCellContext
  family: string
  map?: object
  i: number
  j: number
  x: number
  y: number
  z: number
  zIndex: number
  type: string
  category?: string
  color?: string | number
  assets: TextureRef[]
  terrainTextureName: string
  solid!: boolean
  visible!: boolean
  inclined!: boolean
  border!: boolean
  waterBorder!: boolean
  terrainHidden!: boolean
  viewed!: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  _hasFog!: boolean
  _terrainAppearance: TerrainAppearance
  terrainSet: ContainerChild | null
  _fogChunks: Array<object> | null

  constructor(source: LogicalCellSource) {
    this.context = source.context
    this.family = FAMILY_TYPES.cell
    this.map = source.map ?? source.context.map
    this.i = 0
    this.j = 0
    this.x = source.x
    this.y = source.y
    this.zIndex = source.zIndex ?? source.i + source.j
    this.type = ''
    this.z = 0
    this.assets = []
    this.terrainTextureName = ''
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this._terrainAppearance = createEmptyTerrainAppearance()
    assignCellCommonState(this as CellCommonStateTarget, source)
    this.terrainSet = source.terrainSet ?? null
    this._fogChunks = null
  }

  _updateChild(instance: RuntimeEntity): void {
    updateCellChildVisibility(this, instance)
  }

  updateVisible(): void {
    updateCellVisible(this)
  }

  place(entity: RuntimeEntity): void {
    placeCellEntity(this, entity)
  }
}
