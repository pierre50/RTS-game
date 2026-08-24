export type ActionProps = {
  buildingTypes?: string[]
  trainingType?: string
}

export type CombatOwnerLike = {
  label?: string
  isPlayed?: boolean
  age?: number
  civ?: string
  config?: unknown
  technologies?: string[]
  isEnemy?: (other?: never) => boolean
}

type CombatBehaviorLike = {
  recoveryMode?: 'hold' | 'orbit' | 'retreat'
  reengageEnergyRatio?: number
  recoveryMinDistance?: number
  recoveryMaxDistance?: number
  recoveryStrafeDistance?: number
  recoveryRepositionMs?: number
  recoverySearchRadius?: number
  fleeHealthRatio?: number
  aggression?: number
  bravery?: number
  [key: string]: unknown
}

export type CombatEntity = {
  allowAction?: string[]
  category?: string
  combatBehavior?: CombatBehaviorLike
  combatBehaviorPreset?: string
  combatMoraleRoll?: number
  degree?: number
  family?: string
  hitPoints?: number
  devInvincible?: boolean
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isUsedBy?: unknown
  loading?: number | null
  equipment?: string[]
  meleeArmor?: number
  owner?: CombatOwnerLike | null
  pierceArmor?: number
  quantity?: number
  totalHitPoints?: number
  label?: string
  type?: string
  units?: string[]
  trainingType?: string | null
  trainingUnit?: unknown
  heroDefenseActive?: boolean
  showHeroDefenseFlash?: () => void
  sprite?: unknown
  context?: {
    map?: {
      difficulty?: string
      grid?: Array<Array<{ border?: boolean; category?: string; solid?: boolean }>>
      instanceBuckets?: Array<Array<Set<CombatEntity>>> | null
    }
  }
  x?: number
  y?: number
  i?: number
  j?: number
}

export type CombatDamageType = 'melee' | 'pierce'
