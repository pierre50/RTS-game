import type { Container, ContainerChild } from 'pixi.js'
import type { GridCell, Grid } from './grid'
import type { FloatingItemEntity, ResourceEntity, RuntimeEntity } from './entities'
import type { PlayerLike } from './player'
import type { ResourceAmount } from './common'
import type { VisionViewerRef } from './vision'
import type { Viewport } from './geometry'
import type { TextureRef } from '../lib'

export interface FogSpriteMemory {
  textureSheet: string
  colorName?: string
}

export interface RuntimeCell extends GridCell {
  map?: object
  x: number
  y: number
  z: number
  zIndex?: number
  type: string
  category?: string
  color?: string | number
  assets?: TextureRef[]
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
  children?: ContainerChild[]
  addChild?<T extends ContainerChild>(child: T): T
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
  floatingItems?: Set<FloatingItemEntity>
  gaia?: PlayerLike | null
  fogMemoryLayer?: Container
  randomRange(min: number, max: number): number
  random(): number
  randomItem<T>(items: T[]): T
  invalidateReliefCoastDistances(): void
  setCoordinate(x: number, y: number): void
  updateRenderChunks?(viewport: Viewport): void
  addToInstanceBucket(instance: RuntimeEntity): void
  removeFromInstanceBucket(instance: RuntimeEntity): void
  updateInstanceBucket(instance: RuntimeEntity, oldI: number, oldJ: number): void
  addChild: Container['addChild']
  removeChild(child: RuntimeEntity | Container): ContainerChild
}
