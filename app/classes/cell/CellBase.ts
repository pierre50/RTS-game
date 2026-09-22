import { Container, type ContainerChild } from 'pixi.js'
import type { Sprite } from 'pixi.js'
import { FAMILY_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { TextureRef } from '../../lib'
import type { CellTerrain } from './CellTerrain'
import type { CellCommonStateSource, CellContextLike, CellMapLike } from './CellTypes'
import { assignCellCommonState, createEmptyTerrainAppearance } from './CellTypes'

type PatchBorderGroundType = 'Desert' | 'DarkForest' | 'Dirt' | 'Jungle' | 'Snow'

class HeadlessCellContainer {
  children: ContainerChild[] = []
  parent: Container | null = null
  x = 0
  y = 0
  zIndex = 0
  sortableChildren = false
  eventMode = 'none'
  visible = false

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

  removeChildren(): ContainerChild[] {
    return this.children.splice(0)
  }

  destroy(options?: Parameters<ContainerChild['destroy']>[0]): void {
    for (const child of this.removeChildren()) {
      child.destroy?.(options)
    }
  }
}

const RuntimeCellContainer = (Container ?? HeadlessCellContainer) as typeof Container

export class CellBase extends RuntimeCellContainer {
  context: CellContextLike
  family: string
  map: CellMapLike
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
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  terrainTextureName: string
  sprite: Sprite | null
  cellTerrain!: CellTerrain
  unregisterWaterBorderSurface: (() => void) | null
  _terrainAppearance: {
    patchBorders: Set<string> | null
    patchBorderGroundType?: PatchBorderGroundType | null
    relief: { index: number; elevation: number } | null
    waterBorder: { resourceName: string; index: number } | null
  }

  constructor(context: CellContextLike, source: CellCommonStateSource) {
    super()
    this.context = context
    this.family = FAMILY_TYPES.cell
    this.map = context.map
    this.i = 0
    this.j = 0
    this.type = ''
    this.z = 0
    this.assets = []
    this.corpses = new Set()
    this.has = null
    this.terrainTextureName = ''
    this.sprite = null
    this.unregisterWaterBorderSurface = null
    this._terrainAppearance = createEmptyTerrainAppearance()
    assignCellCommonState(this, source)
  }

  setPatchBorder(direction: string, groundType?: PatchBorderGroundType): void {
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

  override destroy(options?: Parameters<ContainerChild['destroy']>[0]): void {
    this.unregisterWaterBorderSurface?.()
    this.unregisterWaterBorderSurface = null
    super.destroy(options)
  }
}
