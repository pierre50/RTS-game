import { Assets, Sprite, Texture } from 'pixi.js'
import type { ContainerChild } from 'pixi.js'
import { cartesianToIsometric, getTexture, textureRefToString } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell as MapRuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
import type { FogCellLike } from './CellFog'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'

type TerrainBakeMap = {
  grid: MapRuntimeCell[][]
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

export type TerrainBakeCellContext = {
  map: TerrainBakeMap
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type TerrainBakeCellSource = MapRuntimeCell & {
  context?: unknown
  terrainTextureName?: string
  fogSprites?: FogSpriteMemory[]
  _hasFog?: boolean
}

type CellConfig = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
}

export class TerrainBakeCell implements MapRuntimeCell, FogCellLike, TerrainCellLike {
  context: TerrainBakeCellContext
  family: string
  map: TerrainBakeMap
  children: ContainerChild[]
  parent: TerrainCellLike['parent']
  x: number
  y: number
  visible: boolean
  zIndex: number
  sortableChildren: boolean
  eventMode: string
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
  terrainHidden: boolean
  z: number
  viewed: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  _hasFog: boolean
  terrainTextureName: string
  terrainSet: ContainerChild | null
  sprite: Sprite | null
  cellFog: null
  cellTerrain: CellTerrain
  unregisterWaterBorderSurface: (() => void) | null
  _terrainAppearance: {
    patchBorders: Set<string> | null
    patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
    relief: { index: number; elevation: number } | null
    waterBorder: { resourceName: string; index: number } | null
  }

  constructor(source: TerrainBakeCellSource, context: TerrainBakeCellContext) {
    this.context = context
    this.map = this.context.map
    this.parent = this.map as unknown as TerrainCellLike['parent']
    this.children = []
    this.family = FAMILY_TYPES.cell
    this.i = source.i
    this.j = source.j
    this.type = source.type
    this.z = source.z ?? 0
    this.solid = source.solid ?? false
    this.inclined = source.inclined ?? false
    this.border = source.border ?? false
    this.waterBorder = source.waterBorder ?? false
    this.terrainHidden = source.terrainHidden ?? false
    this.viewed = source.viewed ?? false
    this.viewBy = source.viewBy ?? new Set()
    this.has = source.has ?? null
    this.corpses = source.corpses ?? new Set()
    this.fogSprites = source.fogSprites ?? []
    this._hasFog = source._hasFog ?? false
    this.assets = []
    this.terrainTextureName = ''
    this.terrainSet = null
    this.cellFog = null
    this.unregisterWaterBorderSurface = null
    this._terrainAppearance = {
      patchBorders: null,
      patchBorderGroundType: null,
      relief: null,
      waterBorder: null,
    }

    const definition = Assets.cache.get('config')?.cells?.[this.type] as CellConfig | undefined
    if (definition) Object.assign(this, definition)

    const pos = cartesianToIsometric(this.i, this.j)
    this.x = pos[0]
    this.y = pos[1] - this.z * CELL_DEPTH
    this.visible = source.visible ?? false
    this.zIndex = this.i + this.j
    this.sortableChildren = true

    const textureRef = source.terrainTextureName || (this.assets.length ? this.map.randomItem(this.assets) : null)
    this.terrainTextureName = textureRef ? textureRefToString(textureRef) : ''
    const texture = textureRef ? getTexture(textureRef, Assets) : Texture.EMPTY
    this.sprite = new Sprite(texture)
    this.sprite.zIndex = 0
    this.sprite.label = LABEL_TYPES.sprite
    this.sprite.anchor.set(
      Math.floor(texture.width / 2) / texture.width,
      Math.floor(texture.height / 2) / texture.height
    )
    this.sprite.roundPixels = true
    this.sprite.eventMode = 'none'
    this.sprite.renderable = !this.terrainHidden && this.category !== 'Water'
    this.addChild(this.sprite)

    this.cellTerrain = new CellTerrain(this)
    this.eventMode = 'none'
  }

  getChildByLabel(label: string): ContainerChild | null {
    return this.children.find(child => child.label === label) ?? null
  }

  addChild<T extends ContainerChild>(child: T): T {
    this.children.push(child)
    return child
  }

  removeChild<T extends ContainerChild>(child: T): T {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }

  getTerrainBakeChildren(): ContainerChild[] {
    const baseZIndex = this.zIndex * 100
    return this.children.map(child => {
      child.x += this.x
      child.y += this.y
      child.zIndex = baseZIndex + (child.zIndex ?? 0)
      return child
    })
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

  _ensureCellFog(): never {
    throw new Error('TerrainBakeCell does not create fog sprites')
  }

  setFog(): void {}
  removeFog(): void {}
  addFogBuilding(): void {}
  removeFogBuilding(): void {}
  setFogChildren(): void {}

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

  destroy(options?: Parameters<ContainerChild['destroy']>[0]): void {
    this.unregisterWaterBorderSurface?.()
    this.unregisterWaterBorderSurface = null
    for (const child of this.children.splice(0)) {
      child.destroy?.(options)
    }
  }
}
