import type { AnimatedSprite, Container, DestroyOptions, Sprite } from 'pixi.js'
import type { AssetAge, SpritesheetLike } from './pixi'
import type { GridPosition, Point } from './grid'
import type { PlayerLike } from './player'
import type { RuntimeCell } from './map'
import type { GameContextLike } from './context'
import type { CombatBehaviorConfig, ConfigValue, TechnologyConfig, UnitAppearanceConfig } from './config'
import type { MenuButtonSpec } from './ui'
import type { TextureRef } from '../lib'
import type { HeroCivilTool, HeroContextAction } from '../lib/heroTools'
import type { ActionProps } from '../lib/combat'

export type HeroEquipmentSlot =
  | 'helmet'
  | 'helmetDecor'
  | 'cape'
  | 'armor'
  | 'legs'
  | 'shoulders'
  | 'bracers'
  | 'offhand'
  | 'arrow'

export type HeroWeaponSlot = 'melee' | 'ranged' | 'lasso' | 'offhand' | 'quiver'

export type CommandSound = string | number | (string | number)[] | null | undefined
export type UnitControlMode = 'standard' | 'hero' | 'ai'
export type VillagerAutonomyJob = 'food' | 'wood' | 'stone' | 'gold' | 'construction' | 'horseCapture'
export type VillagerShelterLocation = 'shelter' | 'outside'
export type VillagerShelterStatus = 'movingToShelter' | 'inside' | 'outside'
export type VillagerShelterReason = 'sleep' | 'danger'
export type VillagerShelterState = {
  status: VillagerShelterStatus
  reason?: VillagerShelterReason
  location: VillagerShelterLocation
  shelter?: BuildingEntity | null
  targetCell?: RuntimeCell | null
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

export type EntityInfoRenderOptions = {
  // Character-sheet views (the hero's inventory "Infos" tab) want every XP category listed even
  // at level 0; the compact side-HUD/modal/NPC-orders views stay filtered to earned categories only.
  showAllXp?: boolean
  // Modal windows already carry the entity identity in their title; hide duplicate identity labels
  // inside the stat panel while keeping useful metadata such as civ/level/hit points.
  hideIdentity?: boolean
}

export interface EntityInterfaceLike {
  info?: (element: HTMLElement, options?: EntityInfoRenderOptions) => void
  menu?: MenuButtonSpec[]
}

export interface RuntimeEntityBase extends GridPosition, Point {
  label: string
  family: string
  type: string
  name?: string
  category?: string
  owner?: PlayerLike
  x: number
  y: number
  z?: number | null
  zIndex?: number
  size?: number
  selectionFactor?: number
  width: number
  height: number
  visible?: boolean
  alpha?: number
  selected?: boolean
  color?: string
  hitPoints?: number
  totalHitPoints?: number
  sight?: number
  quantity?: number
  totalQuantity?: number
  isDead?: boolean
  isDestroyed?: boolean
  isNaturalResource?: boolean
  sprite?: Sprite | AnimatedSprite
  reliefLift?: number
  context?: GameContextLike
  interface?: EntityInterfaceLike
  select?: () => void
  unselect?: () => void
  die?: (immediate?: boolean) => void
  pause?: () => void
  resume?: () => void
  getChildByLabel?: (label: string) => Container | Sprite | AnimatedSprite | null
  addChild?: Container['addChild']
  addChildAt: Container['addChildAt']
  removeChild: Container['removeChild']
  updateTexture?: () => void
  drawHealthBar?: () => void
  removeHealthBar?: () => void
  drawEnergyBar?: () => void
  removeEnergyBar?: () => void
  drawHeroPowerBar?: (ratio: number) => void
  removeHeroPowerBar?: () => void
  shouldKeepHealthBarVisible?: () => boolean
  getMountedRiderY?: () => number
  isAttacked?: (attacker: RuntimeEntity, hitDirection?: Point) => void
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

export interface EnergyEntity extends RuntimeEntityBase {
  action?: string | null
  dest?: RuntimeEntity | RuntimeCell | null
  path?: RuntimeCell[]
  currentCell?: RuntimeCell | null
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
  sendToEvt?: (
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
  ) => void
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
  shelterState?: VillagerShelterState | null
  loading?: number | null
  loadingType?: string | null
  resourceLoads?: Record<string, number>
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
  buildQueue?: BuildingEntity[]
  isDirectMoving?: boolean
  degree?: number
  speed?: number
  huntRange?: number
  currentCell?: RuntimeCell | null
  visibleCells?: Set<number>

  // Animation / action state
  lookingAtHero?: boolean
  followingHero?: boolean
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
  showLoading?: boolean
  showBuildings?: boolean

  // Combat
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

  // Experience — accumulated XP per skill category (see lib/unitExperience)
  experience?: Record<string, number>

  // Gathering
  gatheringRate?: Record<string, number>
  gatherAmount?: Record<string, number>
  loadingMax?: Record<string, number>
  contextActionEnergyCosts?: Partial<Record<HeroContextAction, number>>
  toolLevels?: Partial<Record<HeroCivilTool, number>>
  assets?: Record<string, string>
  allAssets?: Record<string, Record<string, string>>

  // Identity
  isChief?: boolean
  controlMode?: UnitControlMode
  assetCiv?: string
  assetAge?: number
  totalQuantity?: number
  category?: string
  appearance?: UnitAppearanceConfig
  appearanceVariants?: Record<string, string>
  spriteScale?: number

  // Delegate methods called across the 5 composition classes
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
  sendToEvt?: (
    dest: RuntimeEntity | RuntimeCell | null,
    action?: string | null,
    options?: { forceRepath?: boolean; allowBlockedGatherApproach?: boolean; preserveAutonomy?: boolean }
  ) => void
  sendToBuilding(building: BuildingEntity, preserveBuildQueue?: boolean): void
  sendToBuildingQueue?: (buildings: BuildingEntity[]) => boolean
  sendToWithCell?: (target: RuntimeEntity, arrivalCell: RuntimeCell, action: string) => boolean | undefined
  sendToDelivery?: () => void
  sendToAttack(target: RuntimeEntity): void
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
  updateInterfaceLoading?: () => void
  handleSetDest?: (dest: RuntimeEntity | RuntimeCell, unit: UnitEntity) => void
  handleIsAttacked?: (instance: RuntimeEntity, unit: UnitEntity) => boolean
  clear?: () => void
  explore?: () => boolean
  visibilityTimeout?: number | ReturnType<typeof setTimeout>
}

export interface BuildingEntity extends RuntimeEntityBase {
  isBuilt?: boolean
  accept?: string[]
  queue?: string[]
  technology?: { type?: string; config?: TechnologyConfig } | null
  isUsedBy?: RuntimeEntity | null
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string }>
  trainingUnit?: UnitEntity | null
  trainingType?: string | null
  addChild?: Container['addChild']
  setRallyPoint?: (cell: RuntimeCell, direction: number) => void
  clearRallyPoint?: () => void
  displayPopulation?: boolean
  loading?: number | null
  buyUnit?: (type: string, alreadyPaid?: boolean, force?: boolean, extra?: UnitCreationExtra) => boolean | void
  requestUnitTraining?: (type: string, extra?: UnitCreationExtra, trainee?: UnitEntity | null) => boolean
  cancelUnits?: (type: string) => void
  startTrainingWithUnit?: (trainee: UnitEntity) => boolean
  cancelTrainingForUnit?: (trainee: UnitEntity) => boolean
  buyTechnology?: (type: string) => void
  cancelTechnology?: () => void
  upgrade?: (target: string) => void
  assetType?: string
  textureName?: string
  finalTexture?: () => void
  increasePopulation?: number
  populationCapacityApplied?: boolean
  constructionTime?: number
  updateHitPoints?: (action: string) => void
  units?: string[]
  technologies?: string[]
  placeUnit?: (type: string, extra?: UnitCreationExtra, options?: { consumePopulationSlot?: boolean }) => boolean
  range?: number
  attackAction?: (target: RuntimeEntity) => void
  visibleCells?: Set<number>
  assetCiv?: string
  assetAge?: AssetAge
}

export interface ResourceEntity extends RuntimeEntityBase {
  advanceWheatGrowth?: (frames?: number) => boolean
  textureName?: string
  startsMature?: boolean
  setCuttedTreeTexture?: () => void
  refreshTextureForTerrain?: () => void
  syncWithCell?: () => void
  isUsedBy?: RuntimeEntity | null
  addChild?: Container['addChild']
}

export interface AnimalEntity extends EnergyEntity {
  currentSheet?: string
  inactif?: boolean
  isFleeing?: boolean
  previousDest?: RuntimeEntity | RuntimeCell | null
  realDest?: Pick<RuntimeEntity | RuntimeCell, 'i' | 'j'> | null
  horseColor?: string
  companionOwner?: UnitEntity | null
  isLassoed?: boolean
  lassoOwner?: UnitEntity | null
  companionHitCount?: number
  standingSheet?: SpritesheetLike | null
  walkingSheet?: SpritesheetLike | null
  animalBehavior?: { start?: () => void; stop?: () => void }
  setAltitude?: (altitude: number) => void
}

export type RuntimeEntity = UnitEntity | BuildingEntity | ResourceEntity | AnimalEntity

export interface PlaceableBuildingConfig {
  type: string
  images?: {
    final?: TextureRef
  }
  [key: string]: ConfigValue | { final?: TextureRef } | undefined
}
