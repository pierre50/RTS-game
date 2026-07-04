import type { ResourceAmount } from './common'
import type { Condition } from '../lib/combat'
import type { UnitSounds } from './entities'

export interface EntityConfig {
  icon: string
  cost?: ResourceAmount
  conditions?: Condition[]
  [key: string]: unknown
}

export interface UnitConfig extends EntityConfig {
  trainingTime?: number
  meleeAttack?: number
  pierceAttack?: number
  meleeArmor?: number
  pierceArmor?: number
  sounds?: UnitSounds
}

export interface BuildingConfig extends EntityConfig {
  constructionTime?: number
  units?: string[]
  technologies?: string[]
}

export interface TechnologyAction {
  type: string
  source?: string
  target?: string
  operations?: ConfigOperation[]
}

export interface ConfigOperation {
  type: string | string[]
  value?: unknown
  [key: string]: unknown
}

export interface TechnologyConfig extends EntityConfig {
  researchTime?: number
  key?: string
  value?: unknown
  action?: TechnologyAction
}

export interface ResourceConfig extends EntityConfig {}

export interface AnimalConfig extends EntityConfig {
  totalHitPoints?: number
  totalQuantity?: number
}

export interface ProjectileTrajectory {
  kind: string
  minArcHeight?: number
  arcHeightFactor?: number
  maxArcHeight?: number
}

export interface ProjectileImpactEffect {
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
  spawnOffsetY?: number
  fullCircleStartDegree?: number
  trajectory?: ProjectileTrajectory
  impactEffect?: ProjectileImpactEffect
  sounds?: { launch?: unknown; impact?: unknown }
  [key: string]: unknown
}
