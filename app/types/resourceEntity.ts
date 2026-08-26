import type { Container } from 'pixi.js'
import type { RuntimeEntityBase } from './entityBase'
import type { RuntimeEntity } from './entityRuntime'

export interface ResourceEntity extends RuntimeEntityBase {
  advanceWheatGrowth?: (frames?: number) => boolean
  textureName?: string
  startsMature?: boolean
  setCuttedTreeTexture?: () => void
  isCutOrFallenTree?: () => boolean
  refreshTextureForTerrain?: () => void
  syncWithCell?: () => void
  isUsedBy?: RuntimeEntity | null
  addChild?: Container['addChild']
}
