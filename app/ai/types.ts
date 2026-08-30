import type { GridInstanceLike } from '../types/grid'
import type { Point } from '../types/grid'
import type { RuntimeCell, RuntimeMap } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { RuntimeEntity, UnitCommandOptions, UnitCreationExtra } from '../types/entities'
import type { ConfigValue } from '../types/config'
import type { GameContextLike } from '../types/context'

export type AIResourceName = 'wood' | 'food' | 'gold' | 'stone'

export type AIResourceAmount = Partial<Record<AIResourceName, number>>

type AIPhase = 'economy' | 'military_build'

export type AIAge = 0 | 1 | 2 | 3

export type EnemyMemoryOptions = {
  family?: string | null
  freshWithin?: number
  visibleOnly?: boolean
}

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
  isChief?: boolean
  controlMode?: string
  inactif?: boolean
  action?: string | null
  work?: string | null
  previousWork?: string | null
  dest?: AIEntityLike | RuntimeEntity | RuntimeCell | null
  previousDest?: AIEntityLike | RuntimeEntity | RuntimeCell | null
  currentCell?: RuntimeCell | null
  context?: { map: RuntimeMap; player?: PlayerLike | null }
  parent?: { removeChild?: (unit: AIEntityLike) => void } | null
  path?: RuntimeCell[]
  quantity?: number
  totalQuantity?: number
  loading?: number | null
  isUsedBy?: AIEntityLike | RuntimeEntity | null
  isLassoed?: boolean
  lassoOwner?: AIEntityLike | null
  realDest?: (GridInstanceLike & Partial<Point>) | RuntimeCell | RuntimeEntity | AIEntityLike | null
  eventMode?: string
  selected?: boolean
  visible?: boolean
  z?: number | null
  zIndex?: number
  equipment?: string[]
  range?: number
  speed?: number
  strategy?: string
  meleeArmor?: number
  pierceArmor?: number
  sendTo?(target: AIEntityLike | RuntimeEntity | RuntimeCell, action?: string): void
  sendToWithCell?(target: AIEntityLike | RuntimeEntity, cell: RuntimeCell, action?: string): boolean | void
  sendToTree?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToStone?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToGold?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToBerrybush?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToHunt?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToTakeMeat?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToCaptureHorse?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToFarm?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToBuilding?(target: AIEntityLike | RuntimeEntity): boolean | void
  sendToAttack?(target: AIEntityLike | RuntimeEntity, options?: UnitCommandOptions): boolean | void
  runaway?(target: AIEntityLike | RuntimeEntity): boolean | void
  stop?(): void
  explore?(): boolean
  die?(immediate?: boolean): void
  upgrade?(target: string): void
  goBackToPrevious?(): void
  getActionCondition?(
    target: AIEntityLike | RuntimeEntity | RuntimeCell | null | undefined,
    action?: string,
    extra?: UnitCreationExtra
  ): boolean
  handleChangeDest?(): void
  setTextures?(sheet: string): void
  stopInterval?(): void
  unselect?(): void
  trainingTargetType?: string | null
}

export type AIBuildingLike = AIEntityLike & {
  queue?: string[]
  loading?: number | null
  technology?: { type?: string } | null
  trainingUnit?: AIEntityLike | RuntimeEntity | null
  trainingType?: string | null
  buyUnit?(unitType: string, immediate?: boolean, paid?: boolean, extra?: UnitCreationExtra): boolean | void
  buyTechnology?(technology: string): boolean | void
}

export type AIEntityConfig = Record<string, ConfigValue | AIResourceAmount | undefined> & {
  cost?: AIResourceAmount
  totalHitPoints?: number
  equipment?: string[]
  range?: number
  speed?: number
  meleeArmor?: number
  pierceArmor?: number
}

export type AITechCondition = {
  key: 'age' | 'technologies' | string
  op: '>=' | '=' | 'includes' | 'notincludes' | string
  value: ConfigValue
}

type AITechConfig = {
  cost?: AIResourceAmount
  conditions?: AITechCondition[]
}

export type AIDifficultyConfig = {
  stepDelayBase: number
  popCapMultiplier: number
  defenderRatio: number
  econToMilVillagers: number
  defenseRecallThreshold: number
  defensePowerRatio: number
  homeThreatRadius: number
  villageCoreRadius: number
}

type AIEconomyLike = {
  isLocationSafe(pos: AIGridPosition): boolean
}

export type AIEconomyBuildingContext = {
  ai: AIStrategyPlayerLike
}

export type AIEconomyHorseCaptureContext = {
  ai: AIStrategyPlayerLike
  getBuildingAsRuntimeEntity(building: AIBuildingLike): RuntimeEntity
  isLocationSafe(pos: AIEntityLike): boolean
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
  copper: number
  iron: number
  age: AIAge
  phase: AIPhase
  population: number
  populationMax: number
  technologies: string[]
  researchTechnology?: { type?: string } | null
  researchLoading?: number | null
  difficultyConfig: AIDifficultyConfig
  nextAge: Partial<Record<1 | 2 | 3, string>>
  maxVillagerPerAge: Record<AIAge, number>
  villageTargetPercentageByAge: Record<AIAge, Record<AIResourceName, number>>
  maxBuildingByAge: Record<AIAge, Record<string, number>>
  maxInfantryByAge: Record<AIAge, number>
  maxArcherByAge: Record<AIAge, number>
  maxCavalryByAge: Record<AIAge, number>
  techPriorityByBuilding: Record<string, string[]>
  config: {
    units: Record<string, AIEntityConfig>
    buildings: Record<string, AIEntityConfig>
    equipment?: Record<string, AIEntityConfig>
  }
  techs: Record<string, AITechConfig>
  units: AIEntityLike[]
  buildings: AIBuildingLike[]
  context: Pick<GameContextLike, 'dayNight'> & { map: RuntimeMap }
  economy: AIEconomyLike
  views?: {
    length: number
    coordinates(index: number): [number, number]
    isViewed(i: number, j: number): boolean
    isVisible(i: number, j: number): boolean
  }
  foundedTrees: Set<RuntimeEntity>
  foundedGolds: Set<RuntimeEntity>
  foundedStones: Set<RuntimeEntity>
  foundedCoppers: Set<RuntimeEntity>
  foundedIrons: Set<RuntimeEntity>
  foundedEnemyBuildings: Set<RuntimeEntity>
  foundedEnemyUnits: Set<RuntimeEntity>
  foundedAnimals: Set<RuntimeEntity>
  foundedDeadAnimals: Set<RuntimeEntity>
  foundedBerrybushs: Set<RuntimeEntity>
  foundedWheats: Set<RuntimeEntity>
  foundedResources: Record<string, Set<RuntimeEntity>>
  scout?: AIEntityLike | null
  strategy: {
    getEconomicDemand(): AIResourceAmount
  }
  enemyPlayers(): AIEnemyPlayerLike[]
  getHomeAnchor(): AIGridPosition | null
  buildingsByTypes(types: string[]): AIBuildingLike[]
  getLivingUnitsByType(type: string): AIEntityLike[]
  getEnemyMemories(options?: EnemyMemoryOptions): AIMemoryLike[]
  getFreshEnemyInstances?(options?: EnemyMemoryOptions): AIEntityLike[]
  getNow(): number
  isEnemy(owner?: PlayerLike | null): boolean
  buyBuilding(i: number, j: number, type: string): boolean
  buyTechnology?(type: string): boolean
  cancelTechnology?(): boolean
  hasNotReachBuildingLimit(type: string, buildings?: AIBuildingLike[]): boolean
  isBuildingThreatened?(building: AIEntityLike): boolean
}

type AIEnemyPlayerLike = AIGridPosition & {
  buildings: AIBuildingLike[]
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
  debug?: boolean
}

export type AIFoodSourceType = 'berry' | 'carcass' | 'farm' | 'hunt'

export type AIFoodWorkerCounts = Record<AIFoodSourceType, number>

export type AIFoodSources = {
  animals: AIEntityLike[]
  berries: AIEntityLike[]
  carcasses: AIEntityLike[]
  farms: AIEntityLike[]
  meatDrops: AIBuildingLike[]
  plantDrops: AIBuildingLike[]
  workerPositions?: AIEntityLike[]
}

export type AIVillagerActionOptions = {
  villagers: AIEntityLike[]
  map: RuntimeMap
  farms: AIEntityLike[]
  notBuiltBuildings: AIBuildingLike[]
  storagepits: AIBuildingLike[]
  towncenters: AIBuildingLike[]
  debug?: boolean
}

export type AIGridPosition = GridInstanceLike

export type AIStrategySnapshot = {
  map: RuntimeMap
  otherPlayers: AIGridPosition[]
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
  houses: AIBuildingLike[]
  farms: AIEntityLike[]
  granarys: AIBuildingLike[]
  storagepits: AIBuildingLike[]
  markets: AIBuildingLike[]
  watchTowers: AIBuildingLike[]
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
  villagersOnFood: AIEntityLike[]
  villagersOnWood: AIEntityLike[]
  villagersOnGold: AIEntityLike[]
  villagersOnStone: AIEntityLike[]
}
