import type { AnimatedSprite } from 'pixi.js'
import type { ActionProps } from './combat'
import type { CombatBehaviorConfig, ConfigValue, UnitAppearanceConfig } from './config'
import type { ResourceAmount } from './common'
import type { GridPosition, Point } from './grid'
import type { RuntimeCell } from './map'
import type { SpritesheetLike } from './pixi'
import type { UnitSounds } from './sounds'
import type { RuntimeEntityBase } from './entityBase'
import type { BuildingEntity } from './buildingEntity'
import type { RuntimeEntity } from './entityRuntime'
import type { HeroCivilTool, HeroContextAction } from './heroTools'
import type { HeroEquipmentSlot, HeroWeaponSlot, UnitControlMode } from './unitTypes'

export type VillagerAutonomyJob = 'food' | 'wood' | 'stone' | 'gold' | 'construction' | 'horseCapture'
type UnitRestLocation = 'shelter' | 'outside'
type UnitRestStatus = 'movingToRest' | 'inside' | 'outside'
export type UnitRestReason = 'sleep'
type UnitSleepVisualState = 'sleeping' | 'waking'
export type UnitRestState = {
  status: UnitRestStatus
  reason?: UnitRestReason
  location: UnitRestLocation
  shelter?: BuildingEntity | null
  targetCell?: RuntimeCell | null
  startedAtMs?: number
  retryCount?: number
  previousDest?: RuntimeEntity | RuntimeCell | null
  previousWork?: string | null
  previousAction?: string | null
  previousAutonomousJob?: VillagerAutonomyJob | null
}

export type UnitCreationExtra = {
  name?: string
  gender?: 'male' | 'female'
  isChief?: boolean
  handleSetDest?: (target: RuntimeEntity | RuntimeCell, unit: UnitEntity) => void
  handleIsAttacked?: (attacker: RuntimeEntity, unit: UnitEntity) => boolean
  mountedOnHorse?: boolean
  horseColor?: string
  companionHorseColor?: string | null
  hitPoints?: number
  speed?: number
  experience?: Record<string, number>
  appearanceVariants?: Record<string, string>
}

export type UnitCommandOptions = Record<string, ConfigValue | RuntimeEntity | RuntimeCell | undefined>
export type UnitSendToOptions = {
  forceRepath?: boolean
  allowBlockedGatherApproach?: boolean
  preserveAutonomy?: boolean
  allowPassageStop?: boolean
}

interface UnitPendingOrder {
  execute?: () => void
  dest?: RuntimeEntity | RuntimeCell | null
  action?: string | null
}

interface UnitBlockedGatherApproach {
  target: RuntimeEntity
  action: string
}

interface UnitGatherProgressState {
  action?: string | null
  gatherEvery: number
  loadingType: string
  progress: number
  target: RuntimeEntity
}

interface UnitFollowAssistState {
  action: string
  target?: RuntimeEntity | null
  targetLabel?: string
}

interface UnitRealDest {
  i: number
  j: number
  x: number
  y: number
  label: string
}

type UnitInteriorExitState = {
  targetCell?: RuntimeCell | null
  startedAtMs?: number
  retryCount?: number
  taskId?: number | null
}

type UnitSpacePortalState = {
  portalId: string
  sourceCell?: RuntimeCell | null
  sourceSpaceId: string
  startedAtMs?: number
  targetCell?: RuntimeCell | null
  targetSpaceId: string
  taskId?: number | null
}

export interface EnergyEntity extends RuntimeEntityBase {
  action?: string | null
  dest?: RuntimeEntity | RuntimeCell | null
  path?: RuntimeCell[]
  speed?: number
  mountedOnHorse?: boolean
  energy?: number
  totalEnergy?: number
  energyRegenRate?: number
  energyRegenDelay?: number
  energyRegenMultiplier?: number
  lastEnergySpentAt?: number
  energyCosts?: Partial<Record<string, number>>
  waitingForEnergyAction?: string | null
  waitingForEnergyTarget?: RuntimeEntity | null
  energyWaitTaskId?: number | null
  attackRecoveryMs?: number
  attackRecoveryTaskId?: number | null
  attackRecoveryAnimationTaskId?: number | null
  combatBehavior?: CombatBehaviorConfig
  combatBehaviorPreset?: string
  combatMoraleRoll?: number
  combatMode?: 'attack' | 'recover' | 'flee' | null
  combatRecoveryOrbitDirection?: 1 | -1
  lastCombatRecoveryMoveAt?: number | null
  actionLocked?: boolean
  stop?: () => void
  sendTo?: (target: RuntimeEntity | RuntimeCell, action?: string, options?: { forceRepath?: boolean }) => void
  sendToEvt?: (dest: RuntimeEntity | RuntimeCell | null, action?: string | null, options?: UnitSendToOptions) => void
  startInterval?: (callback: () => void, time: number, immediate?: boolean, name?: string) => void
  stopInterval?: () => void
  setTextures?: (sheet: string) => void
}

export interface UnitEntity extends EnergyEntity {
  sprite?: AnimatedSprite
  shadow?: AnimatedSprite | null
  syncShadow?: () => void
  syncAppearanceLayers?: (sheet: string) => void
  inactif?: boolean
  sounds?: UnitSounds
  gender?: 'male' | 'female'
  work?: string | null
  autonomousJob?: VillagerAutonomyJob | null
  assigningAutonomousJob?: boolean
  campPatrolAnchor?: GridPosition | null
  campPatrolTaskId?: number | null
  banditCampAnchor?: GridPosition | null
  banditCampPatrolTaskId?: number | null
  shelterState?: UnitRestState | null
  sleepVisualState?: UnitSleepVisualState | null
  visualAnimationToken?: number
  restWakeLockUntilMs?: number | null
  restAlertTargetLabel?: string | null
  interiorExitState?: UnitInteriorExitState | null
  spacePortalState?: UnitSpacePortalState | null
  queue?: string[]
  buyUnit?: (type: string) => void
  cancelUnits?: (type: string) => void
  upgrade?: (target: string) => void
  trainingTargetType?: string | null
  realDest?: UnitRealDest | null
  previousDest?: RuntimeEntity | RuntimeCell | null
  previousWork?: string | null
  hasPath?: () => boolean
  moveDirect?: (
    dirX: number,
    dirY: number,
    distance: number,
    options?: { facingDirX?: number; facingDirY?: number }
  ) => boolean
  applyReliefLift?: (level: number, immediate?: boolean) => void
  pendingOrder?: UnitPendingOrder | null
  blockedGatherApproach?: UnitBlockedGatherApproach | null
  gatherProgressState?: UnitGatherProgressState | null
  buildQueue?: BuildingEntity[]
  isDirectMoving?: boolean
  requestedMoveSpeedFactor?: number
  degree?: number
  huntRange?: number
  visibleCells?: Set<number>
  lookingAtHero?: boolean
  followingHero?: boolean
  isCrouching?: boolean
  followAssist?: UnitFollowAssistState | null
  followAssistIntent?: UnitFollowAssistState | null
  currentSheet?: string
  currentFrame?: number
  horseColor?: string
  companionHorseColor?: string | null
  removeMountedHorseSprite?: () => void
  syncMountedHorseSprite?: () => void
  syncMountedRiderPosition?: () => void
  heroPowerChargeStart?: number | null
  heroPowerChargeRatio?: number
  heroPowerChargeDestination?: Point | null
  heroPowerChargeTarget?: RuntimeEntity | null
  heroPowerChargeTool?: 'bow' | 'lasso' | 'sword'
  heroPowerReleaseQueued?: boolean
  heroPowerReleasePower?: number
  heroPowerChargeFacingDegree?: number | null
  heroPowerChargeVisualLocked?: boolean
  heroPowerChargeLastEnergyAt?: number
  heroLasso?: { clearLasso: (options?: { releaseHorse?: boolean }) => void } | null
  heroDefenseStart?: number | null
  heroDefenseLastEnergyAt?: number
  heroDefenseActive?: boolean
  heroDefenseVisualLocked?: boolean
  heroDefenseReverseTaskId?: number | null
  heroDefenseReleaseFallbackTaskId?: number | null
  showHeroDefenseFlash?: () => void
  lastParrySuccessAt?: number
  parryStreak?: number
  contextAction?: HeroContextAction | null
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
    equipped?: Partial<Record<HeroEquipmentSlot, string>>
    equippedCounts?: Partial<Record<HeroEquipmentSlot, number>>
    activeWeapons?: Partial<Record<HeroWeaponSlot, string>>
  }
  lootEquipment?: string[]
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  actionSheet?: SpritesheetLike | null
  walkingSheet?: SpritesheetLike | null
  standingSheet?: SpritesheetLike | null
  corpseSheet?: SpritesheetLike | null
  dyingSheet?: SpritesheetLike | null
  loop?: boolean
  eventMode?: string
  showBuildings?: boolean
  equipment?: string[]
  weaponPower?: number
  meleeArmor?: number
  pierceArmor?: number
  range?: number
  projectile?: string
  healing?: number
  healthRegenRate?: number
  healthRegenDelay?: number
  healthRegenMultiplier?: number
  lastHealthDamagedAt?: number
  conversionChants?: number
  experience?: Record<string, number>
  gatheringRate?: Record<string, number>
  gatherAmount?: Record<string, number>
  contextActionEnergyCosts?: Partial<Record<HeroContextAction, number>>
  toolLevels?: Partial<Record<HeroCivilTool, number>>
  assets?: Record<string, string>
  allAssets?: Record<string, Record<string, string>>
  isChief?: boolean
  controlMode?: UnitControlMode
  assetCiv?: string
  assetAge?: number
  totalQuantity?: number
  category?: string
  appearance?: UnitAppearanceConfig
  appearanceVariants?: Record<string, string>
  spriteScale?: number
  unitCombat?: {
    handleAttackAction: () => void
  }
  stop?: () => void
  setDest?: (dest: RuntimeEntity | RuntimeCell | null) => void
  setPath?: (path: RuntimeCell[]) => void
  sendTo(target: RuntimeCell | RuntimeEntity, action?: string): void
  commonSendTo?: (
    target: RuntimeEntity,
    work: string,
    action: string | null,
    keepPrevious: boolean | UnitCommandOptions,
    immediate?: boolean,
    preserveBuildQueue?: boolean
  ) => void
  sendToEvt?: (dest: RuntimeEntity | RuntimeCell | null, action?: string | null, options?: UnitSendToOptions) => void
  sendToBuilding(building: BuildingEntity, preserveBuildQueue?: boolean): void
  sendToBuildingQueue?: (buildings: BuildingEntity[]) => boolean
  sendToWithCell?: (target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) => boolean | undefined
  sendToAttack(target: RuntimeEntity, options?: UnitCommandOptions): void
  sendToConvert(target: RuntimeEntity): void
  sendToTakeMeat(target: RuntimeEntity, immediate?: boolean): void
  sendToHunt(target: RuntimeEntity, immediate?: boolean): void
  sendToCaptureHorse?(target: RuntimeEntity, immediate?: boolean): boolean | void
  sendToFarm(target: RuntimeEntity, immediate?: boolean): void
  sendToTree?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToBerrybush?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToStone?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToGold?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToCopper?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToIron?: (target: RuntimeEntity, immediate?: boolean) => void
  sendToMineResource?: (target: RuntimeEntity, immediate?: boolean) => boolean | void
  affectNewDest?: () => void
  isUnitAtDest?: (action: string | null | undefined, dest: RuntimeEntity | RuntimeCell | null | undefined) => boolean
  destHasMoved?: () => boolean
  moveToPath?: () => void
  getAction?: (name: string) => void
  getActionCondition?: (
    target: object | null | undefined,
    action?: string,
    props?: ActionProps | UnitCreationExtra
  ) => boolean
  startInterval?: (callback: () => void, time: number, immediate?: boolean, name?: string) => void
  stopInterval?: () => void
  handleChangeDest?: () => void
  queueOrder?: (orderOrDest: (() => void) | RuntimeEntity | RuntimeCell, action?: string | null) => boolean
  flushPendingOrder?: () => boolean
  goBackToPrevious?: () => void
  continueBuildingQueue?: () => boolean
  handleAffectNewDestHunter?: () => boolean
  handleSetDest?: (dest: RuntimeEntity | RuntimeCell, unit: UnitEntity) => void
  handleIsAttacked?: (instance: RuntimeEntity, unit: UnitEntity) => boolean
  clear?: () => void
  explore?: () => boolean
  visibilityTimeout?: number | ReturnType<typeof setTimeout>
}
