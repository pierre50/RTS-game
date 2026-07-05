import type { Container, ContainerChild } from 'pixi.js'
import type { GridCell, Grid } from './grid'
import type { ResourceEntity, RuntimeEntity } from './entities'
import type { PlayerLike } from './player'
import type { ResourceAmount } from './common'
import type { VisionViewerRef } from './vision'
import type { Viewport } from './geometry'

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
  color?: string
  solid: boolean
  visible: boolean
  inclined?: boolean
  border?: boolean
  waterBorder?: boolean
  viewed?: boolean
  has: RuntimeEntity | null
  corpses: Set<RuntimeEntity>
  fogSprites: FogSpriteMemory[]
  viewBy: Set<VisionViewerRef>
  // Generation-time cells (see app/classes/cell/GenerationCell.ts) act as their own
  // lightweight Container for terrain decorations before the real Cell/Container
  // tree is built, so they also expose these Container-shaped members.
  isGenerationCell?: boolean
  children?: Array<{ label?: string; destroy?: (options?: unknown) => void }>
  addChild?<T>(child: T): T
  getChildByLabel?(label: string): ContainerChild | null
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

export interface RuntimeMap {
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
  showResources?: boolean
  startingAge?: number
  allTechnologies?: boolean
  resourceDensity?: string
  difficulty?: string
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
  startingResources: ResourceAmount
  resources: Set<ResourceEntity>
  gaia?: PlayerLike | null
  fogMemoryLayer?: Container
  randomRange(min: number, max: number): number
  random(): number
  randomItem<T>(items: T[]): T
  setCoordinate(x: number, y: number): void
  updateRenderChunks?(viewport: Viewport): void
  addToInstanceBucket(instance: RuntimeEntity): void
  removeFromInstanceBucket(instance: RuntimeEntity): void
  updateInstanceBucket(instance: RuntimeEntity, oldI: number, oldJ: number): void
  addChild: Container['addChild']
  removeChild(child: RuntimeEntity | Container): unknown
}
