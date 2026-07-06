import type { ContainerChild } from 'pixi.js'
import { updateInstanceRenderVisibility } from '../../lib'
import { FAMILY_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import { CellFog } from './CellFog'

type RuntimeCellContext = {
  map: {
    fogMemoryLayer?: { addChild<T extends ContainerChild>(child: T): T }
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type TerrainAppearance = {
  desertBorders?: Set<string> | null
  deepWaterBorders?: Set<string> | null
  relief?: { index: number; elevation: number } | null
  waterBorder?: { resourceName: string; index: number } | null
}

type RuntimeCellSource = {
  context: RuntimeCellContext
  map: RuntimeCellContext['map']
  i: number
  j: number
  x: number
  y: number
  z: number
  zIndex: number
  type: string
  category?: string
  color?: unknown
  assets?: string[]
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
  color?: unknown
  assets: string[]
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
  _fogChunks: unknown
  cellFog: CellFog | null

  constructor(source: RuntimeCellSource) {
    this.context = source.context
    this.family = FAMILY_TYPES.cell
    this.map = source.map
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
    updateInstanceRenderVisibility(instance)
  }

  updateVisible(): void {
    const { map, player } = this.context
    if (!player?.views) return
    if (!map.revealEverything && !player.views.isViewed(this.i, this.j)) return
    this.visible = true
    if (this.has) this._updateChild(this.has)
    for (const corpse of this.corpses) this._updateChild(corpse)
  }

  place(entity: RuntimeEntity): void {
    this.has = entity
    this.updateVisible()
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

  setFog(init: boolean): void {
    return this._ensureCellFog().setFog(init)
  }

  removeFog(): void {
    return this._ensureCellFog().removeFog()
  }

  addFogBuilding(textureSheet: string, colorName?: string): void {
    return this._ensureCellFog().addFogBuilding(textureSheet, colorName)
  }

  removeFogBuilding(instance?: RuntimeEntity): void {
    return this._ensureCellFog().removeFogBuilding(instance)
  }

  setFogChildren(instance: RuntimeEntity, init: boolean): void {
    return this._ensureCellFog().setFogChildren(instance, init)
  }
}
