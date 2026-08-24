import type { ContainerChild } from 'pixi.js'
import { FAMILY_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { CellFog } from './CellFog'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'

export type RuntimeCellContext = {
  map: {
    fogMemoryLayer?: { addChild<T extends ContainerChild>(child: T): T }
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type TerrainAppearance = {
  patchBorders?: Set<string> | null
  // A cell's patch-relief borders (if any) always come from the same source — either an
  // adjacent Desert/Dirt/Snow patch or the generic water-edge overlay — so one value per cell
  // is enough; see CellTerrain#setPatchBorder.
  patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
  relief?: { index: number; elevation: number } | null
  waterBorder?: { resourceName: string; index: number } | null
}

export type RuntimeCellSource = {
  context: RuntimeCellContext
  map?: RuntimeCellContext['map']
  i: number
  j: number
  x: number
  y: number
  z: number
  zIndex: number
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
  viewed?: boolean
  viewBy?: Set<VisionViewerRef>
  has?: RuntimeEntity | null
  corpses?: Set<RuntimeEntity>
  fogSprites?: FogSpriteMemory[]
  _hasFog?: boolean
  _terrainAppearance?: TerrainAppearance
  terrainSet?: ContainerChild | null
}

export class RuntimeCell {
  context: RuntimeCellContext
  family: string
  map: RuntimeCellContext['map']
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
  solid: boolean
  visible: boolean
  inclined: boolean
  border: boolean
  waterBorder: boolean
  viewed: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  _hasFog: boolean
  _terrainAppearance: TerrainAppearance
  terrainSet: ContainerChild | null
  _fogChunks: Array<object> | null
  cellFog: CellFog | null

  constructor(source: RuntimeCellSource) {
    this.context = source.context
    this.family = FAMILY_TYPES.cell
    this.map = source.map ?? source.context.map
    this.i = source.i
    this.j = source.j
    this.x = source.x
    this.y = source.y
    this.z = source.z
    this.zIndex = source.zIndex
    this.type = source.type
    this.category = source.category
    this.color = source.color
    this.assets = source.assets ?? []
    this.terrainTextureName = source.terrainTextureName ?? ''
    this.solid = source.solid ?? false
    this.visible = source.visible ?? false
    this.inclined = source.inclined ?? false
    this.border = source.border ?? false
    this.waterBorder = source.waterBorder ?? false
    this.viewed = source.viewed ?? false
    this.viewBy = source.viewBy ?? new Set()
    this.has = source.has ?? null
    this.corpses = source.corpses ?? new Set()
    this.fogSprites = source.fogSprites ?? []
    this._hasFog = source._hasFog ?? false
    this._terrainAppearance = source._terrainAppearance ?? {}
    this.terrainSet = source.terrainSet || null
    this._fogChunks = null
    this.cellFog = null
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

  getChildByLabel(): null {
    return null
  }

  removeChild(): void {}

  addChild<T extends ContainerChild>(child: T): T {
    this.context.map.fogMemoryLayer?.addChild(child)
    return child
  }

  _ensureCellFog(): CellFog {
    if (!this.cellFog) this.cellFog = new CellFog(this)
    return this.cellFog
  }

  setFog(init: boolean): void { return this._ensureCellFog().setFog(init) }
  removeFog(): void { return this._ensureCellFog().removeFog() }
  addFogBuilding(textureSheet: string, colorName?: string): void { return this._ensureCellFog().addFogBuilding(textureSheet, colorName) }
  removeFogBuilding(instance?: RuntimeEntity): void { return this._ensureCellFog().removeFogBuilding(instance) }
  setFogChildren(instance: RuntimeEntity, init: boolean): void { return this._ensureCellFog().setFogChildren(instance, init) }
}
