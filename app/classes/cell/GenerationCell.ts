import { Assets } from 'pixi.js'
import type { ContainerChild } from 'pixi.js'
import { cartesianToIsometric, getDeterministicCellVariant, textureRefToString } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory, RuntimeCell } from '../../types/map'
import type { VisionViewerRef } from '../../types/vision'
import type { TextureRef } from '../../lib'
import type { CellFog } from './CellFog'
import {
  addCellFogBuilding,
  ensureCellFog,
  removeCellFog,
  removeCellFogBuilding,
  setCellFog,
  setCellFogChildren,
} from './CellFog'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'

type GenerationCellContext = {
  map: {
    seed?: string | number
    randomItem<T>(items: T[]): T
    invalidateReliefCoastDistances(): void
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

type GenerationCellOptions = {
  i: number
  j: number
  z?: number
  type: string
  textureName?: TextureRef
  definition?: CellDefinition
}

type CellDefinition = {
  category?: string
  color?: string | number
  assets?: TextureRef[]
  [key: string]: string | TextureRef | TextureRef[] | number | boolean | undefined
}

type TerrainAppearance = {
  patchBorders: Set<string> | null
  patchBorderGroundType?: 'Desert' | 'Dirt' | 'Snow' | null
  relief: { index: number; elevation: number } | null
  waterBorder: { resourceName: string; index: number } | null
}

type TerrainDecoration = ContainerChild & {
  label?: string
}

export class GenerationCell implements RuntimeCell {
  context: GenerationCellContext
  map: GenerationCellContext['map']
  family: string
  i: number
  j: number
  z: number
  type: string
  solid: boolean
  visible: boolean
  inclined: boolean
  border: boolean
  waterBorder: boolean
  terrainHidden: boolean
  viewed: boolean
  viewBy: Set<VisionViewerRef>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  children: TerrainDecoration[]
  terrainSet: ContainerChild | null
  _hasFog: boolean
  _fogChunks: Array<object> | null
  _terrainAppearance: TerrainAppearance
  category?: string
  color?: string | number
  assets: TextureRef[]
  terrainTextureName: string
  x: number
  y: number
  zIndex: number
  cellFog: CellFog | null
  isGenerationCell: boolean

  constructor(options: GenerationCellOptions, context: GenerationCellContext) {
    this.context = context
    this.map = context.map
    this.family = FAMILY_TYPES.cell
    this.i = options.i
    this.j = options.j
    this.z = options.z ?? 0
    this.type = options.type
    this.solid = false
    this.visible = false
    this.inclined = false
    this.border = false
    this.waterBorder = false
    this.terrainHidden = false
    this.viewed = false
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this.children = []
    this.terrainSet = null
    this._hasFog = false
    this._fogChunks = null
    this._terrainAppearance = {
      patchBorders: null,
      patchBorderGroundType: null,
      relief: null,
      waterBorder: null,
    }

    const definition = options.definition || (Assets.cache.get('config').cells[this.type] as CellDefinition)
    this.category = definition.category
    this.color = definition.color
    this.assets = definition.assets ?? []
    const textureRef =
      options.textureName || getDeterministicCellVariant(this.assets, this.i, this.j, this.map?.seed) || this.assets[0]
    this.terrainTextureName = textureRef ? textureRefToString(textureRef) : ''
    const [x, y] = cartesianToIsometric(this.i, this.j)
    this.x = x
    this.y = y - this.z * CELL_DEPTH
    this.zIndex = this.i + this.j
    this.cellFog = null
    this.isGenerationCell = true
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

  addChild<T extends TerrainDecoration>(child: T): T {
    if (!this.children.includes(child)) this.children.push(child)
    return child
  }

  removeChild<T extends TerrainDecoration>(child: T): T {
    const index = this.children.indexOf(child)
    if (index >= 0) this.children.splice(index, 1)
    return child
  }

  getChildByLabel(label: string): TerrainDecoration | null {
    return this.children.find(child => child.label === label) || null
  }

  resetTerrainAppearance({ preserveWaterBorder = false }: { preserveWaterBorder?: boolean } = {}): void {
    const [x, y] = cartesianToIsometric(this.i, this.j)
    this.x = x
    this.y = y - this.z * CELL_DEPTH
    this.inclined = false
    if (!preserveWaterBorder) {
      if (this.waterBorder && !this.has) this.solid = false
      this.border = false
      this.waterBorder = false
    }
    this._terrainAppearance.patchBorders = null
    this._terrainAppearance.patchBorderGroundType = null
    this._terrainAppearance.relief = null
    if (!preserveWaterBorder) this._terrainAppearance.waterBorder = null
  }

  setTerrainType(type: string): void {
    const definition = Assets.cache.get('config').cells[type] as CellDefinition | undefined
    if (!definition) return
    const wasWater = this.category === 'Water'
    this.type = type
    Object.assign(this, definition)
    this.assets = definition.assets ?? []
    const textureRef = this.assets.length ? this.map.randomItem(this.assets) : null
    this.terrainTextureName = textureRef ? textureRefToString(textureRef) : ''
    if (wasWater !== (this.category === 'Water')) this.map.invalidateReliefCoastDistances()
  }

  setWater(): void {
    this.setTerrainType('Water')
  }

  setWaterBorder(resourceName: string, index: number): void {
    this.border = true
    this.waterBorder = true
    this._terrainAppearance.waterBorder = { resourceName, index }
    if (this.has && typeof this.has.die === 'function') this.has.die()
    this.solid = false
  }

  setReliefBorder(index: number, elevation: number = 0): void {
    this._terrainAppearance.relief = { index, elevation }
    if (elevation) this.y -= elevation
    this.inclined = true
  }

  setPatchBorder(direction: string, groundType: 'Desert' | 'Dirt' | 'Snow' = 'Desert'): void {
    if (!this._terrainAppearance.patchBorders) this._terrainAppearance.patchBorders = new Set()
    this._terrainAppearance.patchBorders.add(direction)
    this._terrainAppearance.patchBorderGroundType = groundType
  }

  setFog(init: boolean): void {
    return setCellFog(this, init)
  }
  removeFog(): void {
    return removeCellFog(this)
  }
  addFogBuilding(textureSheet: string, colorName?: string): void {
    return addCellFogBuilding(this, textureSheet, colorName)
  }
  removeFogBuilding(instance?: RuntimeEntity): void {
    return removeCellFogBuilding(this, instance)
  }
  setFogChildren(instance: RuntimeEntity, init: boolean): void {
    return setCellFogChildren(this, instance, init)
  }
  _ensureCellFog(): CellFog {
    return ensureCellFog(this)
  }

  getTerrainDecorations(): TerrainDecoration[] {
    return this.children.filter(child => child.label === LABEL_TYPES.floor || child.label === LABEL_TYPES.set)
  }
}
