import { Assets } from 'pixi.js'
import type { ContainerChild, Sprite } from 'pixi.js'
import { cartesianToIsometric } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell as MapRuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
import type { FogCellLike } from './CellFog'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'
import { createCellTerrainSprite } from './CellSpriteFactory'
import {
  assignCellCommonState,
  createEmptyTerrainAppearance,
  type CellConfig,
  type CellContextLike,
  type CellMapLike,
} from './CellTypes'

type TerrainBakeMap = CellMapLike

export type TerrainBakeCellContext = CellContextLike

type TerrainBakeCellSource = MapRuntimeCell & {
  context?: unknown
  terrainTextureName?: string
  fogSprites?: FogSpriteMemory[]
  _hasFog?: boolean
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
  solid!: boolean; inclined!: boolean; border!: boolean
  waterBorder!: boolean; terrainHidden!: boolean
  z: number
  viewed!: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null; corpses: Set<RuntimeEntity>; fogSprites: FogSpriteMemory[]
  _hasFog!: boolean
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
    this.i = 0
    this.j = 0
    this.type = ''
    this.z = 0
    this.assets = []
    this.corpses = new Set()
    this.fogSprites = []
    this.has = null
    this.terrainTextureName = ''
    this.terrainSet = null
    this.cellFog = null
    this.unregisterWaterBorderSurface = null
    this.viewBy = new Set()
    this._terrainAppearance = createEmptyTerrainAppearance()
    assignCellCommonState(this, source)

    const definition = Assets.cache.get('config')?.cells?.[this.type] as CellConfig | undefined
    if (definition) Object.assign(this, definition)

    const pos = cartesianToIsometric(this.i, this.j)
    this.x = pos[0]
    this.y = pos[1] - this.z * CELL_DEPTH
    this.visible = source.visible ?? false
    this.zIndex = this.i + this.j
    this.sortableChildren = true

    this.sprite = createCellTerrainSprite(this, this.map, source.terrainTextureName)
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

  setPatchBorder(direction: string, groundType?: 'Desert' | 'Dirt' | 'Snow'): void { return this.cellTerrain.setPatchBorder(direction, groundType) }
  resetTerrainAppearance(): void { return this.cellTerrain.resetTerrainAppearance() }
  setTerrainType(type: string): void { this.cellTerrain.setTerrainType(type); this.map.invalidateWaterOverlay?.() }
  setWaterBorder(resourceName: string, index: number): void { this.cellTerrain.setWaterBorder(resourceName, index); this.map.invalidateWaterOverlay?.() }
  setReliefBorder(index: number, elevation?: number): void { return this.cellTerrain.setReliefBorder(index, elevation) }
  setWater(): void { this.cellTerrain.setWater(); this.map.invalidateWaterOverlay?.() }
  fillReliefCellsAroundCell(): void { return this.cellTerrain.fillReliefCellsAroundCell() }
  setCellLevel(level: number, cpt?: number): void { return this.cellTerrain.setCellLevel(level, cpt) }

  destroy(options?: Parameters<ContainerChild['destroy']>[0]): void {
    this.unregisterWaterBorderSurface?.()
    this.unregisterWaterBorderSurface = null
    for (const child of this.children.splice(0)) {
      child.destroy?.(options)
    }
  }
}
