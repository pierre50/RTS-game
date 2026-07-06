import type { AnimatedSprite, Container, DestroyOptions, Sprite } from 'pixi.js'
import type { GridPosition, Point } from './grid'
import type { PlayerLike } from './player'
import type { RuntimeCell } from './map'
import type { GameContextLike } from './context'
import type { TransportBoat } from '../lib/transport'
import type { MenuButtonSpec } from './ui'

export type CommandSound = string | number | (string | number)[] | null | undefined
export type UnitCreationExtra = {
  handleSetDest?: (target: RuntimeEntity | RuntimeCell, unit: UnitEntity) => void
  handleIsAttacked?: (attacker: RuntimeEntity, unit: UnitEntity) => boolean
}

export interface EntityInterfaceLike {
  info?: (element: HTMLElement) => void
  menu?: MenuButtonSpec[]
}

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
  width: number
  height: number
  visible?: boolean
  selected?: boolean
  color?: string
  hitPoints?: number
  totalHitPoints?: number
  sight?: number
  quantity?: number
  isDead?: boolean
  isDestroyed?: boolean
  sprite?: Sprite | AnimatedSprite
  context?: GameContextLike
  interface?: EntityInterfaceLike
  select?: () => void
  unselect?: () => void
  die?: (immediate?: boolean) => void
  pause?: () => void
  resume?: () => void
  getChildByLabel?: (label: string) => unknown
  addChildAt: Container['addChildAt']
  removeChild: Container['removeChild']
  updateTexture?: () => void
  drawHealthBar?: () => void
  isAttacked?: (attacker: RuntimeEntity) => void
  stopAttackInterval?: () => void
  stopInterval?: () => void
  stopTimeout?: () => void
  destroy?: (options?: DestroyOptions) => void
  animalBehavior?: { stop?: () => void }
  clear?: () => void
  setTextures?: (sheet: string) => void
}

export interface UnitPendingOrder {
  execute?: () => void
  dest?: RuntimeEntity | RuntimeCell | null
  action?: string | null
}

export interface UnitBlockedGatherApproach {
  target: RuntimeEntity
  action: string
}

export interface UnitRealDest {
  i: number
  j: number
  x: number
  y: number
  label: string
}

export interface UnitSounds {
  command?: CommandSound
  buildCommand?: CommandSound
  huntCommand?: CommandSound
  move?: CommandSound
  work?: Record<string, CommandSound>
  heal?: CommandSound
  convert?: CommandSound
  attack?: CommandSound
  hit?: CommandSound
  die?: CommandSound
  create?: CommandSound
  fall?: CommandSound
}

export interface UnitEntity extends RuntimeEntityBase {
  sprite?: AnimatedSprite
  loadedInTransport?: TransportBoat | null
  inactif?: boolean
  sounds?: UnitSounds
  work?: string | null
  loading?: number | null
  loadingType?: string | null
  showTransportCapacity?: boolean
  transportCapacity?: number
  transportedUnits?: UnitEntity[]
  transportLoadShoreCell?: RuntimeCell | null
  transportLoadCoastCell?: RuntimeCell | null
  queue?: string[]
  buyUnit?: (type: string) => void
  cancelUnits?: (type: string) => void
  upgrade?: (target: string) => void

  // Movement / order state
  dest?: RuntimeEntity | RuntimeCell | null
  realDest?: UnitRealDest | null
  previousDest?: RuntimeEntity | RuntimeCell | null
  previousWork?: string | null
  path?: RuntimeCell[]
  hasPath?: () => boolean
  pendingOrder?: UnitPendingOrder | null
  blockedGatherApproach?: UnitBlockedGatherApproach | null
  buildQueue?: BuildingEntity[]
  degree?: number
  speed?: number
  huntRange?: number
  currentCell?: RuntimeCell | null
  visibleCells?: Set<number>

  // Animation / action state
  action?: string | null
  actionLocked?: boolean
  currentSheet?: string
  currentFrame?: number
  actionSheet?: unknown
  walkingSheet?: unknown
  standingSheet?: unknown
  corpseSheet?: unknown
  dyingSheet?: unknown
  loop?: boolean
  eventMode?: string
  sailSheet?: string
  sailSpritesheet?: { textures: Record<string, unknown>; data: { animationSpeed?: number } }
  sailSprite?: AnimatedSprite | null
  sailAnimationSpeed?: number
  fishingOverlaySheet?: { textures: Record<string, unknown>; data?: { animationSpeed?: number } }
  fishingOverlaySprite?: AnimatedSprite | null
  showLoading?: boolean
  showBuildings?: boolean

  // Combat
  meleeAttack?: number
  pierceAttack?: number
  meleeArmor?: number
  pierceArmor?: number
  range?: number
  rateOfFire?: number
  projectile?: string
  healing?: number
  conversionChants?: number

  // Gathering
  gatheringRate?: Record<string, number>
  loadingMax?: Record<string, number>
  assets?: Record<string, string>
  allAssets?: Record<string, Record<string, string>>
  silentWorkSounds?: string[]

  // Identity
  assetCiv?: string
  assetAge?: number
  totalQuantity?: number
  category?: string

  // Delegate methods called across the 5 composition classes
  unitCombat?: { handleAttackAction: () => void }
  stop?: () => void
  setDest?: (dest: RuntimeEntity | RuntimeCell | null) => void
  setPath?: (path: RuntimeCell[]) => void
  sendTo(target: RuntimeCell | RuntimeEntity, action?: string): void
  commonSendTo?: (
    target: RuntimeEntity,
    work: string,
    action: string | null,
    keepPrevious: boolean | Record<string, unknown>,
    immediate?: boolean,
    preserveBuildQueue?: boolean
  ) => unknown
  sendToEvt?: (
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean }
  ) => void
  sendToBuilding(building: BuildingEntity, preserveBuildQueue?: boolean): void
  sendToBuildingQueue?: (buildings: BuildingEntity[]) => boolean
  sendToWithCell?: (target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) => boolean | undefined
  sendToDelivery?: () => void
  sendToFish?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToAttack(target: RuntimeEntity): void
  sendToConvert(target: RuntimeEntity): void
  sendToTakeMeat(target: RuntimeEntity, immediate?: boolean): void
  sendToHunt(target: RuntimeEntity, immediate?: boolean): void
  sendToFarm(target: RuntimeEntity, immediate?: boolean): void
  sendToTree?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToBerrybush?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToStone?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToGold?: (target: RuntimeEntity, immediate?: boolean) => void
  affectNewDest?: () => void
  isUnitAtDest?: (action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined) => boolean
  destHasMoved?: () => boolean
  moveToPath?: () => void
  getAction?: (name: string) => void
  getActionCondition?: (
    target: RuntimeEntity | RuntimeCell | null | undefined,
    action?: string,
    extra?: Record<string, unknown>
  ) => boolean
  startInterval?: (callback: () => void, time: number, immediate?: boolean, name?: string) => void
  stopInterval?: () => void
  handleChangeDest?: () => void
  queueOrder?: (orderOrDest: (() => void) | RuntimeEntity | RuntimeCell, action?: string | null) => boolean
  flushPendingOrder?: () => boolean
  goBackToPrevious?: () => void
  continueBuildingQueue?: () => boolean
  handleAffectNewDestHunter?: () => boolean
  updateInterfaceLoading?: () => void
  handleSetDest?: (dest: RuntimeEntity | RuntimeCell, unit: UnitEntity) => void
  handleIsAttacked?: (instance: RuntimeEntity, unit: UnitEntity) => boolean
  clear?: () => void
  visibilityTimeout?: number | ReturnType<typeof setTimeout>
}

export interface BuildingEntity extends RuntimeEntityBase {
  isBuilt?: boolean
  queue?: string[]
  technology?: { type?: string; config?: unknown } | null
  isUsedBy?: RuntimeEntity | null
  addChild?: Container['addChild']
  setRallyPoint?: (cell: RuntimeCell, direction: number) => void
  clearRallyPoint?: () => void
  displayPopulation?: boolean
  loading?: number | null
  buyTechnology?: (type: string) => void
  cancelTechnology?: () => void
  assetType?: string
  finalTexture?: () => void
  increasePopulation?: number
  populationCapacityApplied?: boolean
  constructionTime?: number
  updateHitPoints?: (action: string) => void
  units?: string[]
  technologies?: string[]
  placeUnit?: (type: string, extra?: UnitCreationExtra) => boolean
  range?: number
  attackAction?: (target: RuntimeEntity) => void
  visibleCells?: Set<number>
  assetCiv?: string
  assetAge?: unknown
}

export interface ResourceEntity extends RuntimeEntityBase {
  textureName?: string
  setCuttedTreeTexture?: () => void
  refreshTextureForTerrain?: () => void
  syncWithCell?: () => void
  isUsedBy?: RuntimeEntity | null
}

export interface AnimalEntity extends RuntimeEntityBase {
  dest?: RuntimeCell | RuntimeEntity | null
  isFleeing?: boolean
}

export type RuntimeEntity = UnitEntity | BuildingEntity | ResourceEntity | AnimalEntity

export interface PlaceableBuildingConfig {
  type: string
  images?: {
    final?: string
  }
  [key: string]: unknown
}
