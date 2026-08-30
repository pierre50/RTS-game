import { Container, Assets } from 'pixi.js'
import type { Sprite } from 'pixi.js'
import { cartesianToIsometric } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { CellFog, type FogCellLike } from './CellFog'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'
import { createCellTerrainSprite } from './CellSpriteFactory'
import {
  assignCellCommonState,
  createEmptyTerrainAppearance,
  type CellConfig,
  type CellContextLike,
  type CellMapLike,
} from './CellTypes'
export { GenerationCell } from './GenerationCell'

type CellMap = CellMapLike
type CellContext = CellContextLike

type CellOptions = {
  i: number
  j: number
  z?: number
  type: string
  textureName?: TextureRef
  terrainHidden?: boolean
  skipFog?: boolean
  fogSprites?: FogSpriteMemory[]
}

type SavedFogSprite = FogSpriteMemory & {
  colorSheet?: string
}

type CellSprite = Sprite

export class Cell extends Container implements RuntimeCell, FogCellLike, TerrainCellLike {
  context: CellContext
  family: string
  map: CellMap
  i: number
  j: number
  type: string
  category?: string
  color?: string | number
  assets: TextureRef[]
  solid!: boolean
  inclined!: boolean
  border!: boolean
  waterBorder!: boolean
  terrainHidden!: boolean
  z: number
  viewed!: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  _hasFog!: boolean
  terrainTextureName: string
  sprite: CellSprite | null
  cellFog: CellFog | null
  cellTerrain: CellTerrain
  unregisterWaterBorderSurface!: (() => void) | null
  _terrainRenderResourcesReleased?: boolean
  _terrainAppearance: {
    patchBorders: Set<string> | null
    patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
    relief: { index: number; elevation: number } | null
    waterBorder: { resourceName: string; index: number } | null
  }

  constructor(options: CellOptions, context: CellContext) {
    super()

    this.context = context

    const map = context.map
    this.family = FAMILY_TYPES.cell
    this.map = map
    this.i = 0
    this.j = 0
    this.type = ''
    this.z = 0
    this.assets = []
    this.corpses = new Set()
    this.fogSprites = []
    this.has = null
    this.terrainTextureName = ''
    this.viewBy = new Set()
    this._terrainAppearance = createEmptyTerrainAppearance()
    assignCellCommonState(this, options)

    Object.assign(this, options)
    const definition = Assets.cache.get('config').cells[this.type] as CellConfig
    Object.assign(this, definition)
    const pos = cartesianToIsometric(this.i, this.j)

    this.x = pos[0]
    this.y = pos[1] - this.z * CELL_DEPTH
    // Terrain tiles need an isometric draw order so taller relief variants are not hidden
    // behind neighboring cells that happened to be added later to the map container.
    this.zIndex = this.i + this.j
    this.sortableChildren = true

    this.sprite = createCellTerrainSprite(this, map, options.textureName) as CellSprite
    this.addChild(this.sprite)

    this.cellFog = options.skipFog ? null : new CellFog(this)
    this.cellTerrain = new CellTerrain(this)

    // Replay last-seen building snapshots loaded from a save.
    const savedFogSprites = this.fogSprites
    this.fogSprites = []
    if (this.cellFog) {
      savedFogSprites.forEach((s: SavedFogSprite) =>
        this.cellFog!.addFogBuilding(s.textureSheet, s.colorName ?? s.colorSheet)
      )
    } else {
      this.fogSprites = savedFogSprites
    }

    this.eventMode = 'none'
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

  releaseTerrainRenderResources(): void {
    if (this._terrainRenderResourcesReleased) return
    this._terrainRenderResourcesReleased = true
    this.unregisterWaterBorderSurface?.()
    this.unregisterWaterBorderSurface = null
    for (const child of this.removeChildren()) {
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    this.sprite = null
  }

  override destroy(options?: Parameters<Container['destroy']>[0]): void {
    this.unregisterWaterBorderSurface?.()
    this.unregisterWaterBorderSurface = null
    super.destroy(options)
  }

  _ensureCellFog(): CellFog {
    if (!this.cellFog) this.cellFog = new CellFog(this)
    return this.cellFog
  }

  // Fog delegates
  setFog(init: boolean): void {
    const fog = this._ensureCellFog()
    fog.setFog(init)
  }
  removeFog(): void {
    const fog = this._ensureCellFog()
    fog.removeFog()
  }
  addFogBuilding(textureSheet: string, colorName?: string): void {
    const fog = this._ensureCellFog()
    fog.addFogBuilding(textureSheet, colorName)
  }
  removeFogBuilding(instance?: RuntimeEntity): void {
    const fog = this._ensureCellFog()
    fog.removeFogBuilding(instance)
  }
  setFogChildren(instance: RuntimeEntity, init: boolean): void {
    const fog = this._ensureCellFog()
    fog.setFogChildren(instance, init)
  }

  // Terrain delegates
  setPatchBorder(direction: string, groundType?: 'Desert' | 'Dirt' | 'Snow'): void {
    return this.cellTerrain.setPatchBorder(direction, groundType)
  }
  resetTerrainAppearance(): void {
    return this.cellTerrain.resetTerrainAppearance()
  }
  setTerrainType(type: string): void {
    this.cellTerrain.setTerrainType(type)
    this.map.invalidateWaterOverlay?.()
  }
  setWaterBorder(resourceName: string, index: number): void {
    this.cellTerrain.setWaterBorder(resourceName, index)
    this.map.invalidateWaterOverlay?.()
  }
  setReliefBorder(index: number, elevation?: number): void {
    return this.cellTerrain.setReliefBorder(index, elevation)
  }
  setWater(): void {
    this.cellTerrain.setWater()
    this.map.invalidateWaterOverlay?.()
  }
  fillReliefCellsAroundCell(): void {
    return this.cellTerrain.fillReliefCellsAroundCell()
  }
  setCellLevel(level: number, cpt?: number): void {
    return this.cellTerrain.setCellLevel(level, cpt)
  }
}
