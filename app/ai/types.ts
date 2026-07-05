import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { RuntimeEntity } from '../types/entities'

export type AIResourceName = 'wood' | 'food' | 'gold' | 'stone'

export type AIResourceAmount = Partial<Record<AIResourceName, number>>

type AIPhase = 'economy' | 'military_build' | 'attack'

export type AIAge = 0 | 1 | 2 | 3

export type AIEntityLike = {
  label: string
  name?: string
  family?: string
  type: string
  category?: string
  i: number
  j: number
  x?: number
  y?: number
  size?: number
  owner?: PlayerLike | null
  hitPoints?: number
  totalHitPoints?: number
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  inactif?: boolean
  action?: string | null
  work?: string | null
  previousWork?: string | null
  dest?: AIEntityLike | RuntimeEntity | RuntimeCell | null
  previousDest?: AIEntityLike | RuntimeEntity | RuntimeCell | null
  currentCell?: RuntimeCell | null
  context?: { map: RuntimeMap; player?: unknown }
  parent?: { removeChild?: (unit: AIEntityLike) => void } | null
  path?: RuntimeCell[]
  quantity?: number
  totalQuantity?: number
  loading?: unknown
  isUsedBy?: unknown
  loadedInTransport?: unknown
  transportedUnits?: AIEntityLike[]
  transportCapacity?: number
  transportLoadCoastCell?: RuntimeCell | null
  transportLoadShoreCell?: RuntimeCell | null
  assault?: boolean
  realDest?: unknown
  eventMode?: string
  selected?: boolean
  visible?: boolean
  z?: number | null
  zIndex?: number
  meleeAttack?: number
  pierceAttack?: number
  range?: number
  rateOfFire?: number
  speed?: number
  strategy?: string
  meleeArmor?: number
  pierceArmor?: number
  sendTo?(target: AIEntityLike | RuntimeEntity | RuntimeCell, action?: string): void
  sendToWithCell?(target: AIEntityLike | RuntimeEntity, cell: RuntimeCell, action?: string): unknown
  sendToFish?(target: AIEntityLike | RuntimeEntity): unknown
  sendToTree?(target: AIEntityLike | RuntimeEntity): unknown
  sendToStone?(target: AIEntityLike | RuntimeEntity): unknown
  sendToGold?(target: AIEntityLike | RuntimeEntity): unknown
  sendToBerrybush?(target: AIEntityLike | RuntimeEntity): unknown
  sendToHunt?(target: AIEntityLike | RuntimeEntity): unknown
  sendToTakeMeat?(target: AIEntityLike | RuntimeEntity): unknown
  sendToFarm?(target: AIEntityLike | RuntimeEntity): unknown
  sendToBuilding?(target: AIEntityLike | RuntimeEntity): unknown
  sendToAttack?(target: AIEntityLike | RuntimeEntity): unknown
  runaway?(target: AIEntityLike | RuntimeEntity): unknown
  stop?(): void
  explore?(): boolean
  die?(immediate?: boolean): void
  upgrade?(target: string): void
  goBackToPrevious?(): void
  getActionCondition?(
    target: AIEntityLike | RuntimeEntity | RuntimeCell | null | undefined,
    action?: string,
    extra?: Record<string, unknown>
  ): boolean
  handleChangeDest?(): void
  setTextures?(sheet: string): void
  stopInterval?(): void
  unselect?(): void
}

export type AIBuildingLike = AIEntityLike & {
  queue?: string[]
  loading?: unknown
  technology?: { type?: string } | null
  buyUnit?(unitType: string, immediate?: boolean, paid?: boolean, extra?: unknown): boolean
  buyTechnology?(technology: string): boolean
}

export type AIEntityConfig = Record<string, unknown> & {
  cost?: AIResourceAmount
  totalHitPoints?: number
  meleeAttack?: number
  pierceAttack?: number
  range?: number
  rateOfFire?: number
  speed?: number
  meleeArmor?: number
  pierceArmor?: number
}

export type AITechCondition = {
  key: 'age' | 'technologies' | string
  op: '>=' | '=' | 'includes' | 'notincludes' | string
  value: number | string
}

type AITechConfig = {
  cost?: AIResourceAmount
  conditions?: AITechCondition[]
}

export type AIDifficultyConfig = {
  stepDelayBase: number
  popCapMultiplier: number
  attackThreshold: number
  defenderRatio: number
  econToMilVillagers: number
  raidThreshold: number
  raidSize: number
  attackCooldownMs: number
  assaultRecallThreshold: number
  assaultRecallPowerRatio: number
  assaultRecallMaxRatio: number
  homeThreatRadius: number
  villageCoreRadius: number
}

export type AILandAccessDiagnostic = {
  reachable: boolean
  reason: 'missing_target' | 'invalid_land_anchor' | 'land_path' | 'land_search_cap' | 'no_land_path'
  distance: number
  visited: number
}

type AINavalOperation = {
  stage?: 'loading' | 'sailing' | 'assault' | string
  targetLabel?: string
  transportLabel?: string
  startedAt?: number
  updatedAt?: number
  unitLabels?: string[]
  landingCell?: AIGridPosition | null
  loadShoreCell?: AIGridPosition | null
  loadCoastCell?: AIGridPosition | null
}

type AIEconomyLike = {
  isLocationSafe(pos: AIGridPosition): boolean
}

export type AIStrategyPlayerLike = {
  label?: string
  i: number
  j: number
  x?: number
  y?: number
  type?: string
  wood: number
  food: number
  gold: number
  stone: number
  age: AIAge
  phase: AIPhase
  population: number
  populationMax: number
  technologies: string[]
  difficultyConfig: AIDifficultyConfig
  nextAge: Partial<Record<1 | 2 | 3, string>>
  maxVillagerPerAge: Record<AIAge, number>
  villageTargetPercentageByAge: Record<AIAge, Record<AIResourceName, number>>
  maxBuildingByAge: Record<AIAge, Record<string, number>>
  maxInfantryByAge: Record<AIAge, number>
  maxArcherByAge: Record<AIAge, number>
  maxCavalryByAge: Record<AIAge, number>
  maxHopliteByAge: Record<AIAge, number>
  techPriorityByBuilding: Record<string, string[]>
  config: {
    units: Record<string, AIEntityConfig>
    buildings: Record<string, AIEntityConfig>
  }
  techs: Record<string, AITechConfig>
  units: AIEntityLike[]
  buildings: AIBuildingLike[]
  context: { map: RuntimeMap }
  economy: AIEconomyLike
  views?: {
    length: number
    coordinates(index: number): [number, number]
    isViewed(i: number, j: number): boolean
    isVisible(i: number, j: number): boolean
  }
  foundedTrees: Set<AIEntityLike>
  foundedGolds: Set<AIEntityLike>
  foundedStones: Set<AIEntityLike>
  foundedEnemyBuildings: Set<AIEntityLike>
  foundedEnemyUnits: Set<AIEntityLike>
  foundedFish: Set<AIEntityLike>
  foundedAnimals: Set<AIEntityLike>
  foundedDeadAnimals: Set<AIEntityLike>
  foundedBerrybushs: Set<AIEntityLike>
  navalOperation?: AINavalOperation | null
  lastNavalConnectivity?: AILandAccessDiagnostic
  lastNavalOperationFailure?: unknown
  lastNavalOperationEndedAt?: number
  lastAttackWaveAt?: number
  scout?: AIEntityLike | null
  strategy: {
    needsNavalTransport(militaryCount?: number): boolean
    getEconomicDemand(): AIResourceAmount
  }
  enemyPlayers(): AIStrategyPlayerLike[]
  getHomeAnchor(): AIGridPosition | null
  buildingsByTypes(types: string[]): AIBuildingLike[]
  getLivingUnitsByType(type: string): AIEntityLike[]
  getEnemyMemories(options?: Record<string, unknown>): AIMemoryLike[]
  getFreshEnemyInstances?(options?: Record<string, unknown>): AIEntityLike[]
  getNow(): number
  isEnemy(owner?: PlayerLike | null): boolean
  buyBuilding(i: number, j: number, type: string): boolean
  hasNotReachBuildingLimit(type: string, buildings?: AIBuildingLike[]): boolean
  isBuildingThreatened?(building: AIEntityLike): boolean
}

export type AIMemoryLike = {
  i: number
  j: number
  label?: string
  visible?: boolean
  lastSeenAt: number
  instance?: AIEntityLike | null
}

export type AIDefenseTarget = {
  memory: AIMemoryLike
  target: AIEntityLike
  dist: number
}

export type AIMilitaryActionOptions = {
  waitingMilitary: AIEntityLike[]
  inactifMilitary: AIEntityLike[]
  howManySoldiersBeforeAttack: number
  debug?: boolean
}

export type AIFoodSourceType = 'berry' | 'carcass' | 'farm' | 'fish' | 'hunt'

export type AIFoodWorkerCounts = Record<AIFoodSourceType, number>

export type AIFoodSources = {
  animals: AIEntityLike[]
  berries: AIEntityLike[]
  carcasses: AIEntityLike[]
  farms: AIEntityLike[]
  fish: AIEntityLike[]
  meatDrops: AIBuildingLike[]
  plantDrops: AIBuildingLike[]
}

export type AIFoodTarget = {
  fish: AIEntityLike
  shoreCell: RuntimeCell
}

export type AIVillagerActionOptions = {
  villagers: AIEntityLike[]
  map: RuntimeMap
  farms: AIBuildingLike[]
  notBuiltBuildings: AIBuildingLike[]
  storagepits: AIBuildingLike[]
  towncenters: AIBuildingLike[]
  debug?: boolean
}

export type AIGridPosition = {
  i: number
  j: number
}

export type AIDockOpportunity = {
  position: RuntimeCell | null
  waterClusterSize: number
}

export type AINavalOpportunity = {
  fish: AIEntityLike[]
  maxWaterClusterSize: number
  dockPosition: RuntimeCell | null
  shouldScoutCoast: boolean
  needsTransport: boolean
  desiredFishingBoats: number
}

export type AIStrategySnapshot = {
  map: RuntimeMap
  otherPlayers: AIStrategyPlayerLike[]
  villagers: AIEntityLike[]
  maxVillagers: number
  towncenters: AIBuildingLike[]
  infantry: AIEntityLike[]
  maxInfantry: number
  barracks: AIBuildingLike[]
  infantryUnit: string
  archers: AIEntityLike[]
  maxArcher: number
  archeryRanges: AIBuildingLike[]
  archerUnit: string
  cavalry: AIEntityLike[]
  maxCavalry: number
  stables: AIBuildingLike[]
  hoplites: AIEntityLike[]
  maxHoplite: number
  academies: AIBuildingLike[]
  houses: AIBuildingLike[]
  farms: AIBuildingLike[]
  granarys: AIBuildingLike[]
  storagepits: AIBuildingLike[]
  markets: AIBuildingLike[]
  governmentCenters: AIBuildingLike[]
  watchTowers: AIBuildingLike[]
  sentryTowers: AIBuildingLike[]
  notBuiltHouses: AIBuildingLike[]
}

export type AIWorkerTargets = {
  maxVillagersOnFood: number
  maxVillagersOnWood: number
  maxVillagersOnGold: number
  maxVillagersOnStone: number
}

export type AIWorkerSnapshot = {
  inactifVillagers: AIEntityLike[]
  villagersForaging: AIEntityLike[]
  villagersHunting: AIEntityLike[]
  villagersFarming: AIEntityLike[]
  villagersFishing: AIEntityLike[]
  villagersOnFood: AIEntityLike[]
  villagersOnWood: AIEntityLike[]
  villagersOnGold: AIEntityLike[]
  villagersOnStone: AIEntityLike[]
}
