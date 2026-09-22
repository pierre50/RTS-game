import { Assets } from 'pixi.js'
import type { ContainerChild, Sprite } from 'pixi.js'
import { cartesianToIsometric } from '../../lib'
import { CELL_DEPTH } from '../../constants'
import type { RuntimeEntity } from '../../types/entities'
import type { RuntimeCell as MapRuntimeCell } from '../../types/map'
import { CellTerrain, type TerrainCellLike } from './CellTerrain'
import { placeCellEntity, updateCellChildVisibility, updateCellVisible } from './CellVisibility'
import { createCellTerrainSprite } from './CellSpriteFactory'
import { type CellConfig, type CellContextLike } from './CellTypes'
import { CellBase } from './CellBase'

export type TerrainBakeCellContext = CellContextLike

type TerrainBakeCellSource = MapRuntimeCell & {
  context?: unknown
  terrainTextureName?: string
}

export class TerrainBakeCell extends CellBase implements MapRuntimeCell, TerrainCellLike {
  terrainSet: ContainerChild | null
  override sprite: Sprite | null

  constructor(source: TerrainBakeCellSource, context: TerrainBakeCellContext) {
    super(context, source)
    this.map = this.context.map
    ;(this as unknown as { parent: TerrainCellLike['parent'] }).parent = this
      .map as unknown as TerrainCellLike['parent']
    this.terrainSet = null

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

  override destroy(options?: Parameters<ContainerChild['destroy']>[0]): void {
    super.destroy(options)
  }
}
