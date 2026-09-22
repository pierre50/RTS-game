import type { ContainerChild } from 'pixi.js'
import { LogicalCell, type LogicalCellSource } from './LogicalCell'

export type RuntimeCellContext = {
  map: {
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

  constructor(source: RuntimeCellSource) {
    super(source)
    this.map = source.map ?? source.context.map
  }

  getChildByLabel(): null {
    return null
  }

  removeChild(): void {}

  addChild<T extends ContainerChild>(child: T): T {
    return child
  }
}
