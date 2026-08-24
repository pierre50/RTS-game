import type { GameContextLike } from '../types/context'
import type { AIBuildingLike, AIEntityLike } from './types'

export type EnemyMemory = {
  instance: AIEntityLike
  label: string
  ownerLabel?: string
  family?: string
  type: string
  i: number
  j: number
  hitPoints?: number
  totalHitPoints?: number
  lastSeenAt: number
  visible: boolean
}

export type ThreatProfile = {
  hostileUnits: AIEntityLike[]
  hostileMilitary: AIEntityLike[]
  hostileVillagers: AIEntityLike[]
  hostileAnimals: AIEntityLike[]
  hostilePower: number
  isNearHome: boolean
  isInVillageCore: boolean
  isRemoteVillagerIncident: boolean
  isDirectVillageAssault: boolean
  isSeriousMilitaryThreat: boolean
  targetDistanceToHome: number
  isCriticalBuilding: boolean
  isChief: boolean
  isBuilding: boolean
  priority: number
}

export type StoredThreat = {
  target: AIEntityLike
  lastSeenAt: number
  attacker: AIEntityLike
  attackerFamily?: string
  attackerType: string
  count: number
}

export type ActiveThreat = StoredThreat & {
  hostiles: AIEntityLike[]
  profile: ThreatProfile
}

export type ThreatManagerPlayer = {
  label: string
  context: GameContextLike
  views: { isVisible(i: number, j: number): boolean }
  buildings: AIEntityLike[]
  units: AIEntityLike[]
  scout: AIEntityLike | null
  difficultyConfig: {
    defensePowerRatio?: number
    defenseRecallThreshold?: number
    homeThreatRadius?: number
    villageCoreRadius?: number
  }
  strategy: { military: { getCombatPower(unit: AIEntityLike): number; getGroupCombatPower(units: AIEntityLike[]): number } }
  enemyUnitMemory: Map<string, EnemyMemory>
  enemyBuildingMemory: Map<string, EnemyMemory>
  threatenedTargets: Map<string, StoredThreat>
  isEnemy(owner: unknown): boolean
  buildingsByTypes(types: string[]): AIBuildingLike[]
  getNow(): number
}

export type ThreatResponseManager = {
  player: ThreatManagerPlayer
  getActiveThreats(): ActiveThreat[]
  getDefensePowerNeed(profile: ThreatProfile): number
}
