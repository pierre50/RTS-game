import type { ResourceAmount } from './common'
import type { AnimalConfig, BuildingConfig, ResourceConfig, TechnologyConfig, UnitConfig } from './config'
import type { FogSpriteMemory } from './map'
import type { AssetAge } from './pixi'
import type { SerializedVisionGrid } from './vision'
import type { UnitControlMode } from './entities'

export type SaveReference = string | [number, number, string?]
export type SaveGridPoint = { i: number; j: number }
export type SaveDestination = Partial<SaveGridPoint & { x: number; y: number; label: string }>
export type SaveRallyPoint = SaveGridPoint & { direction: number }
export type SaveTechnologyState = { type?: string; config?: TechnologyConfig } | null

export type SaveEntityState = {
  action?: string | null
  assetAge?: AssetAge
  assetCiv?: string
  assetType?: string
  blockedGatherApproach?: { target: SaveReference; action: string } | null
  buildQueue?: string[]
  currentFrame?: number
  currentSheet?: string
  controlMode?: UnitControlMode
  degree?: number
  dest?: SaveReference | SaveDestination | null
  direction?: number
  experience?: Record<string, number>
  energy?: number
  totalEnergy?: number
  lastEnergySpentAt?: number
  hitPoints?: number
  healthRegenRate?: number
  healthRegenDelay?: number
  healthRegenMultiplier?: number
  lastHealthDamagedAt?: number
  i: number
  inactif?: boolean
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isChief?: boolean
  followingHero?: boolean
  isFleeing?: boolean
  isUsedBy?: string | null
  j: number
  label?: string
  loading?: number | null
  loadingType?: string | null
  loop?: boolean
  mountedOnHorse?: boolean
  name?: string
  path?: SaveGridPoint[]
  previousDest?: SaveReference | SaveDestination | null
  previousWork?: string | null
  quantity?: number
  queue?: string[]
  rallyPoint?: SaveRallyPoint | null
  realDest?: SaveDestination | null
  size?: number
  technology?: SaveTechnologyState
  textureName?: string
  totalHitPoints?: number
  type: string
  work?: string | null
  x?: number
  y?: number
  z?: number | null
  zIndex?: number
}

export type SaveCellState = {
  border?: boolean
  fogSprites?: FogSpriteMemory[]
  has?: string
  inclined?: boolean
  type: string
  viewed?: boolean
  waterBorder?: boolean
  z?: number
}

export type SavedThreatState = {
  target?: SaveReference | null
  attacker?: SaveReference | null
  lastSeenAgo?: number
  lastSeenAt?: number
  attackerFamily?: string | null
  attackerType?: string | null
  count?: number
}

export type SavedEnemyMemoryState = {
  instance?: SaveReference | null
  lastSeenAgo?: number
}

export type SavedAIState = {
  phase?: string
  lastAttackWaveAgo?: number | null
  lastAttackWaveAt?: number
  savedAt?: number
  enemyUnits?: SavedEnemyMemoryState[]
  enemyBuildings?: SavedEnemyMemoryState[]
  threatenedTargets?: SavedThreatState[]
}

export type SavePlayerState = PlayerSetupConfig & {
  age?: number
  buildings?: SaveEntityState[]
  cellViewed?: number
  colorHex?: string
  corpses?: SaveEntityState[]
  food?: number
  gold?: number
  hasBuilt?: string[]
  isPlayed?: boolean
  label?: string
  population?: number
  populationMax?: number
  researchTechnology?: SaveTechnologyState
  researchLoading?: number | null
  selectedBuildingLabel?: string
  selectedOtherLabel?: string
  selectedUnitLabel?: string
  selectedUnitLabels?: string[]
  stone?: number
  technologies?: string[]
  type: string
  units?: SaveEntityState[]
  views?: SerializedVisionGrid
  wood?: number
  aiState?: SavedAIState
}

export type SaveRuntimeState = {
  elapsedMs?: number
}

export type SaveWorldState = {
  environment?: string
  seed?: string | number
  size?: number
  mapType?: string
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
}

export type WorldColor = 'blue' | 'yellow' | 'red' | 'neutral'

export type HeroPartySave = {
  playerLabel?: string
  followerLabels: string[]
}

export type WorldGraphNode = {
  id: string
  name: string
  color: WorldColor
  environment?: string | null
  parentId?: string | null
  children: string[]
  discoveredAt: number
  visitedAt: number
  canTeleport?: boolean
}

export type WorldGraphSave = {
  rootWorldId: string
  nodes: Record<string, WorldGraphNode>
}

export type CampaignWorldSave = {
  id: string
  name: string
  color: WorldColor
  parentWorldId?: string | null
  entryPortalId?: string | null
  returnPortalId?: string | null
  discoveredAt: number
  visitedAt: number
  state: SerializedSave
}

export type CampaignSave = {
  format: 'campaign-v1'
  version: number
  currentWorldId: string
  heroParty: HeroPartySave
  sharedResources?: ResourceAmount
  worlds: Record<string, CampaignWorldSave>
  worldGraph: WorldGraphSave
}

export type GameConfig = {
  allTechnologies?: boolean
  bots?: number
  difficulty?: string
  environment?: string
  humanStartsWithoutBase?: boolean
  instantMode?: boolean
  mapType?: string
  name?: string
  players?: PlayerSetupConfig[]
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
  resourceDensity?: string
  revealEverything?: boolean
  revealTerrain?: boolean
  seed?: string | number
  size?: number
  startingAge?: number
  startingResources?: ResourceAmount
}

export type PlayerSetupConfig = {
  civ?: string
  civilizationLevel?: number
  color?: string
  gender?: 'male' | 'female'
  isHuman?: boolean
  name?: string
  team?: number | null
}

export type LoadedGameConfig = {
  animals?: Record<string, AnimalConfig>
  buildings?: Record<string, BuildingConfig>
  resources?: Record<string, ResourceConfig>
  units?: Record<string, UnitConfig>
}

export type SerializedSave = {
  version?: number
  camera: { x: number; y: number }
  config?: GameConfig
  map?: SaveCellState[][]
  players: SavePlayerState[]
  resources: SaveEntityState[]
  animals: SaveEntityState[]
  runtime?: SaveRuntimeState
  world?: SaveWorldState
}

export type SaveRecord = SerializedSave | CampaignSave

export type SaveIndexEntry = {
  date: number
  key: string
  name: string
}
