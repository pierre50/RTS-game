import type { ResourceAmount } from './common'
import type { CommandSound, UnitSounds } from './sounds'
import type { HeroEquipmentSlot } from './unitTypes'

export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ConfigValue[]
  | { [key: string]: ConfigValue | TechnologyConfig }

export type Condition = {
  key: string
  op: '=' | '!=' | '<' | '<=' | '>=' | '>' | 'includes' | 'notincludes'
  value: ConfigValue
}

export type UnitAppearanceLayerConfig = {
  zIndex: number
  deathZIndex?: number
  hideForActions?: string[]
  hideOnOrAfterFrame?: number
  mountedCut?: boolean
  workTypes?: string[]
  civilizations?: string[]
  hideWhenEquippedSlots?: readonly HeroEquipmentSlot[]
  minLevel?: number
  maxLevel?: number
  ageSheetOverrides?: Record<string, Partial<Record<string, string>>>
  workSheetOverrides?: Record<string, Partial<Record<string, string>>>
  actionWorkSheetOverrides?: Record<string, Partial<Record<string, string>>>
  playerColorVariants?: Record<string, string>
  appearanceVariantKey?: string
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  actionFrameSequence?: number[]
  palette?: string
  paletteSource?: string
  paletteSize?: number
  equipmentKey?: string
  standingSheet?: string
  walkingSheet?: string
  mountedSheet?: string
  actionSheet?: string
  shootingSheet?: string
  harvestSheet?: string
  dyingSheet?: string
  corpseSheet?: string
}

export interface UnitAppearanceConfig {
  layers: UnitAppearanceLayerConfig[]
}

export type CombatRecoveryMode = 'hold' | 'orbit' | 'retreat'

export interface CombatBehaviorConfig {
  [key: string]: ConfigValue
  recoveryMode?: CombatRecoveryMode
  reengageEnergyRatio?: number
  recoveryMinDistance?: number
  recoveryMaxDistance?: number
  recoveryStrafeDistance?: number
  recoveryRepositionMs?: number
  recoverySearchRadius?: number
  fleeHealthRatio?: number
  aggression?: number
  bravery?: number
}

interface EntityConfig {
  // Optional: still used by technologies, no longer read for units/buildings/
  // animals/resources now that those show a cropped sprite avatar instead.
  icon?: string
  category?: string
  combatBehavior?: CombatBehaviorConfig
  combatBehaviorPreset?: string
  cost?: ResourceAmount
  conditions?: Condition[]
  [key: string]:
    | ConfigValue
    | CombatBehaviorConfig
    | ResourceAmount
    | Condition[]
    | UnitSounds
    | TechnologyAction
    | UnitAppearanceConfig
    | undefined
}

export interface UnitConfig extends EntityConfig {
  trainingDays?: number
  equipment?: string[]
  attackRecoveryMs?: number
  meleeArmor?: number
  pierceArmor?: number
  totalEnergy?: number
  energyRegenRate?: number
  sounds?: UnitSounds
  appearance?: UnitAppearanceConfig
  spriteScale?: number
}

export type EquipmentStats = {
  weapon?: {
    power?: number
    range?: number
  }
  armor?: {
    melee?: number
    pierce?: number
  }
  meleeArmor?: number
  pierceArmor?: number
}

export interface BuildingConfig extends EntityConfig {
  hideWhenFogged?: boolean
  indestructible?: boolean
  providesVision?: boolean
  requiresActiveSightInteraction?: boolean
  overheadIndicatorOffsetX?: number
  overheadIndicatorOffsetY?: number
  constructionTime?: number
  instantPlacement?: boolean
  inventoryItem?: string
  shelterCapacity?: number
  mountingDays?: number
  useSpriteShadow?: boolean
  spriteShadowAnchor?: { x?: number; y?: number }
  units?: string[]
  technologies?: string[]
}

interface TechnologyAction {
  type: string
  source?: string
  target?: string
  operations?: ConfigOperation[]
}

export interface ConfigOperation {
  type: string | string[]
  value?: ConfigValue
  [key: string]: ConfigValue | string[] | undefined
}

export interface TechnologyConfig extends EntityConfig {
  researchTime?: number
  key?: string
  value?: ConfigValue
  action?: TechnologyAction
}

export type ResourceConfig = EntityConfig

export interface AnimalConfig extends EntityConfig {
  totalHitPoints?: number
  totalQuantity?: number
  attackRecoveryMs?: number
  runningSpeed?: number
  flyingSpeed?: number
  ambientMovement?: boolean
  ambientWalkDelayMin?: number
  ambientWalkDelayMax?: number
  ambientWalkRange?: number
  horseColor?: string
}

interface ProjectileTrajectory {
  kind: string
  minArcHeight?: number
  arcHeightFactor?: number
  maxArcHeight?: number
}

interface ProjectileImpactEffect {
  assets: string
  animationSpeed?: number
  scale?: number
}

interface ProjectileSpawnOffset {
  x?: number
  y?: number
}

export interface ProjectileConfig {
  size: number
  speed: number
  assets: string
  isAnimated?: boolean
  animationSpeed?: number
  rotateSprite?: boolean
  staticFrame?: number
  spriteBaseAngle?: number
  directionalFrames?: number
  directionalFrameOrder?: string[]
  directionalAnimationFrames?: number
  scale?: number
  spawnOffsetX?: number
  spawnOffsetY?: number
  directionalSpawnOffsets?: Record<string, ProjectileSpawnOffset>
  fullCircleStartDegree?: number
  trajectory?: ProjectileTrajectory
  impactEffect?: ProjectileImpactEffect
  sounds?: { launch?: CommandSound; impact?: CommandSound }
  [key: string]:
    | ConfigValue
    | ProjectileTrajectory
    | ProjectileImpactEffect
    | ProjectileSpawnOffset
    | Record<string, ProjectileSpawnOffset>
    | { launch?: CommandSound; impact?: CommandSound }
    | undefined
}
