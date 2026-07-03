import type { Container, ContainerChild } from 'pixi.js'
import type { GridCell, Grid } from './grid'
import type { RuntimeEntity } from './entities'
import type { PlayerLike } from './player'
import type { ResourceAmount, UnknownRecord } from './common'

export interface FogSpriteMemory {
  textureSheet: string
  colorName?: string
}

export interface RuntimeCell extends GridCell {
  map?: RuntimeMap
  x: number
  y: number
  z: number
  zIndex?: number
  type: string
  category?: string
  solid: boolean
  visible: boolean
  inclined?: boolean
  border?: boolean
  waterBorder?: boolean
  viewed?: boolean
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  viewBy: Set<unknown>
  updateVisible(): void
  place(entity: RuntimeEntity): void
  setFog(init?: boolean): void
  removeFog(): void
}

export interface RenderChunk {
  displayObjects: ContainerChild[]
  bounds: { minX: number; minY: number; width: number; height: number }
  renderable: boolean
}

export interface RuntimeMap extends UnknownRecord {
  grid: Grid<RuntimeCell>
  size: number
  x: number
  y: number
  seed?: string | number
  mapType?: string
  ready?: boolean
  instantMode: boolean
  revealEverything: boolean
  revealTerrain: boolean
  startingAge?: number
  allTechnologies?: boolean
  resourceDensity?: string
  startingResources: ResourceAmount
  resources: Set<RuntimeEntity>
  gaia?: PlayerLike | null
  fogMemoryLayer?: Container
  randomRange(min: number, max: number): number
  addToInstanceBucket(instance: RuntimeEntity): void
  removeFromInstanceBucket(instance: RuntimeEntity): void
}
