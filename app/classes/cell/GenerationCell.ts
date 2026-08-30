import { Assets } from 'pixi.js'
import type { ContainerChild } from 'pixi.js'
import { getDeterministicCellVariant, textureRefToString } from '../../lib'
import { CELL_DEPTH, CELL_HEIGHT, CELL_WIDTH, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
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
import { LogicalCell } from './LogicalCell'

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

type TerrainDecoration = ContainerChild & {
  label?: string
}

export class GenerationCell extends LogicalCell implements RuntimeCell {
  override map: GenerationCellContext['map']
  children: TerrainDecoration[]
  cellFog: CellFog | null
  isGenerationCell: boolean

  constructor(options: GenerationCellOptions, context: GenerationCellContext) {
    const definition = options.definition || (Assets.cache.get('config').cells[options.type] as CellDefinition)
    const z = options.z ?? 0
    const textureRef =
      options.textureName ||
      getDeterministicCellVariant(definition.assets ?? [], options.i, options.j, context.map?.seed) ||
      definition.assets?.[0]
    const x = Math.floor(((options.i - options.j) * CELL_WIDTH) / 2)
    const y = Math.floor(((options.i + options.j) * CELL_HEIGHT) / 2)
    super({
      context,
      map: context.map,
      i: options.i,
      j: options.j,
      x,
      y: y - z * CELL_DEPTH,
      z,
      zIndex: options.i + options.j,
      type: options.type,
      category: definition.category,
      color: definition.color,
      assets: definition.assets ?? [],
      terrainTextureName: textureRef ? textureRefToString(textureRef) : '',
      _terrainAppearance: {
        patchBorders: null,
        patchBorderGroundType: null,
        relief: null,
        waterBorder: null,
      },
    })
    this.map = context.map
    this.children = []
    this.cellFog = null
    this.isGenerationCell = true
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
    const x = Math.floor(((this.i - this.j) * CELL_WIDTH) / 2)
    const y = Math.floor(((this.i + this.j) * CELL_HEIGHT) / 2)
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
