import { Container, Assets, Sprite } from 'pixi.js'
import { cartesianToIsometric, getTexture, textureRefToString, updateInstanceRenderVisibility } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { CellFog, type FogCellLike } from './CellFog'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
export { GenerationCell } from './GenerationCell'

type CellMap = {
  grid: RuntimeCell[][]
  size: number
  revealEverything?: boolean
  seed?: string | number
  randomRange(min: number, max: number): number
  randomItem<T>(items: T[]): T
  invalidateReliefCoastDistances?: () => void
}

type CellContext = {
  map: CellMap
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type CellOptions = {
  i: number
  j: number
  z?: number
  type: string
  textureName?: TextureRef
  skipFog?: boolean
  fogSprites?: FogSpriteMemory[]
}

type CellConfig = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
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
  solid: boolean
  inclined: boolean
  border: boolean
  waterBorder: boolean
  z: number
  viewed: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  _hasFog: boolean
  terrainTextureName: string
  sprite: CellSprite | null
  cellFog: CellFog | null
  cellTerrain: CellTerrain
  _terrainRenderResourcesReleased?: boolean

  constructor(options: CellOptions, context: CellContext) {
    super()

    this.context = context

    const map = context.map
    this.family = FAMILY_TYPES.cell
    this.map = map

    this.solid = false
    this.visible = false
    this.zIndex = 0
    this.inclined = false
    this.border = false
    this.waterBorder = false
    this.z = 0
    this.viewed = false
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this._hasFog = false
    this.i = options.i
    this.j = options.j
    this.z = options.z ?? this.z
    this.type = options.type
    this.assets = []
    this.terrainTextureName = ''

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

    const textureRef = options.textureName || map.randomItem(this.assets)
    this.terrainTextureName = textureRefToString(textureRef)
    const texture = getTexture(textureRef, Assets)
    this.sprite = new Sprite(texture) as CellSprite
    this.sprite.zIndex = 0
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.anchor.set(
      Math.floor(texture.width / 2) / texture.width,
      Math.floor(texture.height / 2) / texture.height
    )
    this.sprite.roundPixels = true
    this.sprite.eventMode = 'none'
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
    updateInstanceRenderVisibility(instance)
  }

  updateVisible(): void {
    const { player } = this.context
    const { map } = this
    if (!player?.views) return
    if (!map.revealEverything && !player.views.isViewed(this.i, this.j)) {
      return
    }
    this.visible = true
    if (this.has) {
      this._updateChild(this.has)
    }
    for (const corpse of this.corpses) {
      this._updateChild(corpse)
    }
  }

  place(entity: RuntimeEntity): void {
    this.has = entity
    this.updateVisible()
  }

  releaseTerrainRenderResources(): void {
    if (this._terrainRenderResourcesReleased) return
    this._terrainRenderResourcesReleased = true
    for (const child of this.removeChildren()) {
      child.destroy?.({ children: true, texture: false, textureSource: false })
    }
    this.sprite = null
  }

  _ensureCellFog(): CellFog {
    if (!this.cellFog) this.cellFog = new CellFog(this)
    return this.cellFog
  }

  // Fog delegates
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

  // Terrain delegates
  setDesertBorder(direction: string): void {
    return this.cellTerrain.setDesertBorder(direction)
  }
  setDeepWaterBorder(direction: string): void {
    return this.cellTerrain.setDeepWaterBorder(direction)
  }
  resetTerrainAppearance(): void {
    return this.cellTerrain.resetTerrainAppearance()
  }
  setTerrainType(type: string): void {
    return this.cellTerrain.setTerrainType(type)
  }
  setWaterBorder(resourceName: string, index: number): void {
    return this.cellTerrain.setWaterBorder(resourceName, index)
  }
  setReliefBorder(index: number, elevation?: number): void {
    return this.cellTerrain.setReliefBorder(index, elevation)
  }
  setWater(): void {
    return this.cellTerrain.setWater()
  }
  fillReliefCellsAroundCell(): void {
    return this.cellTerrain.fillReliefCellsAroundCell()
  }
  setCellLevel(level: number, cpt?: number): void {
    return this.cellTerrain.setCellLevel(level, cpt)
  }
}
