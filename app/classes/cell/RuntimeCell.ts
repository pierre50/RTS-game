import type { ContainerChild } from 'pixi.js'
import type { RuntimeEntity } from '../../types/entities'
import type { CellFog } from './CellFog'
import {
  addCellFogBuilding,
  ensureCellFog,
  removeCellFog,
  removeCellFogBuilding,
  setCellFog,
  setCellFogChildren,
} from './CellFog'
import { LogicalCell, type LogicalCellSource } from './LogicalCell'

export type RuntimeCellContext = {
  map: {
    fogMemoryLayer?: { addChild<T extends ContainerChild>(child: T): T }
    revealEverything?: boolean
  }
  player?: { views?: { isViewed(i: number, j: number): boolean; isVisible(i: number, j: number): boolean } }
}

export type RuntimeCellSource = LogicalCellSource & {
  context: RuntimeCellContext
  map?: RuntimeCellContext['map']
}

export class RuntimeCell extends LogicalCell {
  override map: RuntimeCellContext['map']
  cellFog: CellFog | null

  constructor(source: RuntimeCellSource) {
    super(source)
    this.map = source.map ?? source.context.map
    this.cellFog = null
  }

  getChildByLabel(): null {
    return null
  }

  removeChild(): void {}

  addChild<T extends ContainerChild>(child: T): T {
    this.context.map.fogMemoryLayer?.addChild(child)
    return child
  }

  _ensureCellFog(): CellFog {
    return ensureCellFog(this)
  }

  setFog = (init: boolean): void => setCellFog(this, init)
  removeFog = (): void => removeCellFog(this)
  addFogBuilding = (textureSheet: string, colorName?: string): void => addCellFogBuilding(this, textureSheet, colorName)
  removeFogBuilding = (instance?: RuntimeEntity): void => removeCellFogBuilding(this, instance)
  setFogChildren = (instance: RuntimeEntity, init: boolean): void => setCellFogChildren(this, instance, init)
}
