import type { ResourceAmount } from './common'
import type { Condition } from '../lib/combat'
import type { CommandSound, UnitSounds } from './entities'

export type ConfigValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ConfigValue[]
  | { [key: string]: ConfigValue | TechnologyConfig }

export type UnitAppearanceLayerConfig = {
  zIndex: number
  workTypes?: string[]
  workSheetOverrides?: Record<string, Partial<Record<string, string>>>
  actionWorkSheetOverrides?: Record<string, Partial<Record<string, string>>>
  playerColorVariants?: Record<string, string>
  appearanceVariantKey?: string
  sheetDirectionCounts?: Record<string, number>
  sheetDirectionOrders?: Record<string, string[]>
  palette?: string
  paletteSize?: number
  standingSheet?: string
  walkingSheet?: string
  actionSheet?: string
  harvestSheet?: string
  loadedSheet?: string
  dyingSheet?: string
  corpseSheet?: string
}

export interface UnitAppearanceConfig {
  layers: UnitAppearanceLayerConfig[]
}

interface EntityConfig {
  icon: string
  cost?: ResourceAmount
  conditions?: Condition[]
  [key: string]:
    | ConfigValue
    | ResourceAmount
    | Condition[]
    | UnitSounds
    | TechnologyAction
    | UnitAppearanceConfig
    | undefined
}

export interface UnitConfig extends EntityConfig {
  trainingTime?: number
  meleeAttack?: number
  pierceAttack?: number
  meleeArmor?: number
  pierceArmor?: number
  sounds?: UnitSounds
  appearance?: UnitAppearanceConfig
  spriteScale?: number
}

export interface BuildingConfig extends EntityConfig {
  constructionTime?: number
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
  spawnOffsetY?: number
  fullCircleStartDegree?: number
  trajectory?: ProjectileTrajectory
  impactEffect?: ProjectileImpactEffect
  sounds?: { launch?: CommandSound; impact?: CommandSound }
  [key: string]: ConfigValue | ProjectileTrajectory | ProjectileImpactEffect | { launch?: CommandSound; impact?: CommandSound } | undefined
}
