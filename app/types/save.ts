import type { ResourceAmount } from './common'
import type { AnimalConfig, BuildingConfig, ResourceConfig, TechnologyConfig, UnitConfig } from './config'
import type { FogSpriteMemory } from './fog'
import type { AssetAge } from './pixi'
import type { SerializedVisionGrid } from './vision'
import type { HeroEquipmentSlot, HeroWeaponSlot, UnitControlMode } from './unitTypes'
import type { VillagerAutonomyJob } from './entities'
import type { HeroAppearanceConfig } from '../lib/lpc/heroAppearance'
import type { HorseTamingStatus } from '../lib/horses/horseTaming'

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
  autonomousJob?: VillagerAutonomyJob | null
  blockedGatherApproach?: { target: SaveReference; action: string } | null
  buildQueue?: string[]
  currentFrame?: number
  currentSheet?: string
  controlMode?: UnitControlMode
  degree?: number
  dest?: SaveReference | SaveDestination | null
  depletedDay?: number
  direction?: number
  experience?: Record<string, number>
  gender?: 'male' | 'female'
  appearanceVariants?: Record<string, string>
  energy?: number
  totalEnergy?: number
  lastEnergySpentAt?: number
  hitPoints?: number
  horseColor?: string
  trapPrey?: boolean
  tamingStatus?: HorseTamingStatus
  companionHorseColor?: string | null
  campPatrolAnchor?: SaveGridPoint | null
  banditCampAnchor?: SaveGridPoint | null
  containedAnimalType?: string | null
  healthRegenRate?: number
  healthRegenDelay?: number
  healthRegenMultiplier?: number
  lastHealthDamagedAt?: number
  i: number
  horseAmount?: number
  stableHorses?: Array<{ horseColor?: string; tamingStatus?: HorseTamingStatus }>
  inactif?: boolean
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isNaturalResource?: boolean
  isChief?: boolean
  inventory?: {
    resources?: ResourceAmount
    equipment?: string[]
    equipped?: Partial<Record<HeroEquipmentSlot, string>>
    equippedCounts?: Partial<Record<HeroEquipmentSlot, number>>
    activeWeapons?: Partial<Record<HeroWeaponSlot, string>>
  }
  indestructible?: boolean
  followingHero?: boolean
  isFleeing?: boolean
  isUsedBy?: string | null
  j: number
  label?: string
  loading?: number | null
  trainingStartedDay?: number | null
  trainingCompleteDay?: number | null
  loop?: boolean
  lootEquipment?: string[]
  marketStock?: string[]
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
  spaceId?: string
  technology?: SaveTechnologyState
  textureName?: string
  berrybushFullTextureName?: string
  totalHitPoints?: number
  totalQuantity?: number
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

type SavedThreatState = {
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
  copper?: number
  food?: number
  berry?: number
  meat?: number
  wheat?: number
  gold?: number
  iron?: number
  discoveredEquipment?: string[]
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
  villagerAssignments?: {
    total: number
    assigned: ResourceAmount
    construction: number
    horseCapture: number
    idle: number
    sleeping: number
    moving: number
  }
  views?: SerializedVisionGrid
  wood?: number
  aiState?: SavedAIState
}

type SaveRuntimeState = {
  dayNightElapsedMs?: number
  elapsedMs?: number
  savedAt?: number
}

type SaveWorldState = {
  environment?: string
  seed?: string | number
  size?: number
  mapType?: string
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
}

export type WorldColor = 'blue' | 'yellow' | 'red' | 'neutral'

type HeroPartySave = {
  playerLabel?: string
  followerLabels: string[]
}

export type FactionRelationState = 'hostile' | 'wary' | 'neutral' | 'friendly' | 'allied'

export type FactionSave = {
  id: string
  civilization?: string
  color?: string
  name: string
  relationScore: number
  relationState: FactionRelationState
  homeWorldId: string
  knownWorldIds: string[]
  discoveredAt: number
  updatedAt: number
}

export type WorldGraphNode = {
  id: string
  name: string
  color: WorldColor
  kind?: 'world' | 'interior'
  environment?: string | null
  encounter?: PortalEncounterKind | null
  banditsCleared?: boolean
  factionIds?: string[]
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
  visitedDayNightElapsedMs?: number
  state: SerializedSave
}

type CampaignClockSave = {
  dayNightElapsedMs?: number
  savedAt?: number
}

export type CampaignSave = {
  format: 'campaign-v1'
  version: number
  clock?: CampaignClockSave
  currentWorldId: string
  factions?: Record<string, FactionSave>
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
  portalEncounter?: PortalEncounterKind
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

export type PortalEncounterKind = 'village' | 'bandit'

export type PlayerSetupConfig = {
  civ?: string
  civilizationLevel?: number
  color?: string
  diplomacy?: 'neutral' | null
  factionId?: string | null
  gender?: 'male' | 'female'
  heroAppearance?: HeroAppearanceConfig
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
  naturalResourceRespawnSlots?: SaveEntityState[]
  runtime?: SaveRuntimeState
  world?: SaveWorldState
}

export type SaveRecord = SerializedSave | CampaignSave

export type SaveIndexEntry = {
  date: number
  key: string
  name: string
}
