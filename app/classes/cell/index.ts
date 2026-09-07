import { Assets } from 'pixi.js'
import type { Sprite } from 'pixi.js'
import { cartesianToIsometric } from '../../lib'
import { CELL_DEPTH } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { TextureRef } from '../../lib'
import { CellFog, type FogCellLike } from './CellFog'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'
import { createCellTerrainSprite } from './CellSpriteFactory'
import { type CellConfig, type CellContextLike } from './CellTypes'
import { CellBase } from './CellBase'
export { GenerationCell } from './GenerationCell'

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

export class Cell extends CellBase implements RuntimeCell, FogCellLike, TerrainCellLike {
  cellFog: CellFog | null
  _terrainRenderResourcesReleased?: boolean

  constructor(options: CellOptions, context: CellContext) {
    super(context, options)

    const map = context.map
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

  override destroy(options?: Parameters<CellBase['destroy']>[0]): void {
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

}
