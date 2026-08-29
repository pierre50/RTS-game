import type { Container, ContainerChild } from 'pixi.js'
import type { GridCell, Grid, GridPosition } from './grid'
import type { ResourceEntity, RuntimeEntity } from './entities'
import type { ResourceAmount } from './common'
import type { FogSpriteMemory } from './fog'
import type { PortalEncounterKind, SaveEntityState } from './save'
import type { VisionViewerRef } from './vision'
import type { Viewport } from './geometry'
import type { TextureRef } from '../lib/graphics/textures'

export type { FogSpriteMemory } from './fog'

export interface RuntimeCell extends GridCell {
  map?: object
  spaceId?: string
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
  terrainHidden?: boolean
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

type GaiaPlayerLike = {
  animals?: RuntimeEntity[]
  units?: RuntimeEntity[]
  createAnimal?: (options: { i: number; j: number; spaceId?: string; type: string; horseColor?: string }) => RuntimeEntity
}

export interface RuntimeMap {
  grid: Grid<RuntimeCell>
  spaces?: Map<string, RuntimeMapSpace>
  activeSpaceId?: string | null
  size: number
  x: number
  y: number
  seed?: string | number
  mapType?: string
  environment?: string
  ready?: boolean
  instantMode: boolean
  humanStartsWithoutBase?: boolean
  portalEncounter?: PortalEncounterKind | null
  revealEverything: boolean
  revealTerrain: boolean
  showResources?: boolean
  startingAge?: number
  allTechnologies?: boolean
  resourceDensity?: string
  difficulty?: string
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
  interiorExits?: Array<GridPosition | null>
  startingResources: ResourceAmount
  resources: Set<ResourceEntity>
  naturalResourceRespawnSlots?: SaveEntityState[]
  debugEntityBarsVisible?: boolean
  // Coarse spatial grid of BUCKET_SIZE-cell buckets, keyed [floor(i/BUCKET_SIZE)][floor(j/BUCKET_SIZE)].
  // Populated by addToInstanceBucket() lazily on first use — null until then.
  instanceBuckets?: Array<Array<Set<RuntimeEntity>>> | null
  gaia?: GaiaPlayerLike | null
  fogMemoryLayer?: Container
  shadowLayer?: Container
  randomRange(min: number, max: number): number
  random(): number
  randomItem<T>(items: T[]): T
  invalidateReliefCoastDistances(): void
  setCoordinate(x: number, y: number): void
  updateRenderChunks?(viewport: Viewport): void
  addToInstanceBucket(instance: RuntimeEntity): void
  removeFromInstanceBucket(instance: RuntimeEntity): void
  respawnNaturalResource?(slot: SaveEntityState): boolean
  updateInstanceBucket(instance: RuntimeEntity, oldI: number, oldJ: number): void
  addChild: Container['addChild']
  removeChild(child: RuntimeEntity | Container): ContainerChild
}

type RuntimeMapSpaceKind = 'outside' | 'interior'

export interface RuntimeMapSpacePortal {
  id: string
  sourceSpaceId: string
  sourceCell: RuntimeCell | null
  targetSpaceId: string
  targetCell: RuntimeCell | null
}

export interface RuntimeMapSpace {
  id: string
  kind: RuntimeMapSpaceKind
  grid: Grid<RuntimeCell>
  size: number
  container: Container | RuntimeMap
  shadowLayer?: Container | null
  shadowRenderContainer?: Container | RuntimeMap | null
  origin: { x: number; y: number }
  mapType?: string
  buildingLabel?: string | null
  entryCell?: RuntimeCell | null
  exitCell?: RuntimeCell | null
  instanceBuckets?: Array<Array<Set<RuntimeEntity>>> | null
  portals?: RuntimeMapSpacePortal[]
}
