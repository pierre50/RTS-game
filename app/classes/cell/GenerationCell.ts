import { Assets } from 'pixi.js'
import type { ContainerChild } from 'pixi.js'
import { cartesianToIsometric, getDeterministicCellVariant, updateInstanceRenderVisibility } from '../../lib'
import { CELL_DEPTH, FAMILY_TYPES, LABEL_TYPES } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { FogSpriteMemory } from '../../types/map'
import { CellFog } from './CellFog'

type GenerationCellContext = {
  map: {
    seed?: string | number
    randomItem<T>(items: T[]): T
    invalidateReliefCoastDistances(): void
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean } }
}

type GenerationCellOptions = {
  i: number
  j: number
  z?: number
  type: string
  textureName?: string
  definition?: CellDefinition
}

type CellDefinition = {
  category?: string
  color?: unknown
  assets: string[]
  [key: string]: unknown
}

type TerrainAppearance = {
  desertBorders: Set<string> | null
  deepWaterBorders: Set<string> | null
  relief: { index: number; elevation: number } | null
  waterBorder: { resourceName: string; index: number } | null
}

type TerrainDecoration = ContainerChild & {
  label?: string
}

export class GenerationCell {
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
  viewed: boolean
  viewBy: Set<unknown>
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  children: TerrainDecoration[]
  terrainSet: ContainerChild | null
  _hasFog: boolean
  _fogChunks: unknown
  _terrainAppearance: TerrainAppearance
  category?: string
  color?: unknown
  assets: string[]
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
    this.viewed = false
    this.viewBy = new Set()
    this.has = null
    this.corpses = new Set()
    this.fogSprites = []
    this.children = []
    this.terrainSet = null
    this._hasFog = false
    this._fogChunks = null
    this._terrainAppearance = { desertBorders: null, deepWaterBorders: null, relief: null, waterBorder: null }

    const definition = options.definition || (Assets.cache.get('config').cells[this.type] as CellDefinition)
    this.category = definition.category
    this.color = definition.color
    this.assets = definition.assets
    this.terrainTextureName =
      options.textureName ||
      getDeterministicCellVariant(this.assets, this.i, this.j, this.map?.seed) ||
      this.assets[0]
    const [x, y] = cartesianToIsometric(this.i, this.j)
    this.x = x
    this.y = y - this.z * CELL_DEPTH
    this.zIndex = this.i + this.j
    this.cellFog = null
    this.isGenerationCell = true
  }

  _updateChild(instance: RuntimeEntity): void {
    updateInstanceRenderVisibility(instance as unknown as Parameters<typeof updateInstanceRenderVisibility>[0])
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
      this.border = false
      this.waterBorder = false
    }
    this._terrainAppearance.desertBorders = null
    this._terrainAppearance.deepWaterBorders = null
    this._terrainAppearance.relief = null
    if (!preserveWaterBorder) this._terrainAppearance.waterBorder = null
  }

  setDeepWaterBorder(direction: string): void {
    if (!this._terrainAppearance.deepWaterBorders) this._terrainAppearance.deepWaterBorders = new Set()
    this._terrainAppearance.deepWaterBorders.add(direction)
  }

  setTerrainType(type: string): void {
    const definition = Assets.cache.get('config').cells[type] as CellDefinition | undefined
    if (!definition) return
    const wasWater = this.category === 'Water'
    this.type = type
    Object.assign(this, definition)
    this.terrainTextureName = this.map.randomItem(this.assets)
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
  }

  setReliefBorder(index: number, elevation: number = 0): void {
    this._terrainAppearance.relief = { index, elevation }
    if (elevation) this.y -= elevation
    this.inclined = true
  }

  setDesertBorder(direction: string): void {
    if (!this._terrainAppearance.desertBorders) this._terrainAppearance.desertBorders = new Set()
    this._terrainAppearance.desertBorders.add(direction)
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

  _ensureCellFog(): CellFog {
    if (!this.cellFog) this.cellFog = new CellFog(this as unknown as ConstructorParameters<typeof CellFog>[0])
    return this.cellFog
  }

  getTerrainDecorations(): TerrainDecoration[] {
    return this.children.filter(child => child.label === LABEL_TYPES.floor || child.label === LABEL_TYPES.set)
  }
}
