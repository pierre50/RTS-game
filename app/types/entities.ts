import type { AnimatedSprite, Container, Sprite } from 'pixi.js'
import type { GridPosition, Point } from './grid'
import type { PlayerLike } from './player'
import type { RuntimeCell } from './map'

export type CommandSound = string | string[] | null | undefined

export interface RuntimeEntityBase extends GridPosition, Point {
  label: string
  family: string
  type: string
  category?: string
  owner?: PlayerLike
  x: number
  y: number
  z?: number | null
  zIndex?: number
  size?: number
  visible?: boolean
  hitPoints?: number
  totalHitPoints?: number
  sight?: number
  quantity?: number
  isDead?: boolean
  isDestroyed?: boolean
  sprite?: Sprite | AnimatedSprite
  context?: unknown
  select?: () => void
  die?: () => void
  getChildByLabel?: (label: string) => unknown
}

export interface UnitEntity extends RuntimeEntityBase {
  loadedInTransport?: RuntimeEntity | null
  inactif?: boolean
  sounds?: { command?: CommandSound }
  sendTo(target: RuntimeCell | RuntimeEntity, action?: string): void
  sendToBuilding?: (building: BuildingEntity) => void
  sendToBuildingQueue?: (buildings: BuildingEntity[]) => void
}

export interface BuildingEntity extends RuntimeEntityBase {
  isBuilt?: boolean
  queue?: string[]
  technology?: { type?: string } | null
  isUsedBy?: RuntimeEntity | null
  addChild?: Container['addChild']
  setRallyPoint?: (cell: RuntimeCell, direction: number) => void
  clearRallyPoint?: () => void
}

export interface ResourceEntity extends RuntimeEntityBase {
  textureName?: string
}

export interface AnimalEntity extends RuntimeEntityBase {
  dest?: RuntimeCell | RuntimeEntity | null
}

export type RuntimeEntity = UnitEntity | BuildingEntity | ResourceEntity | AnimalEntity

export interface PlaceableBuildingConfig {
  type: string
  images?: {
    final: string
  }
  [key: string]: unknown
}
