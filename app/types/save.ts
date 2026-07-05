import type { ResourceAmount } from './common'
import type { FogSpriteMemory } from './map'
import type { SerializedVisionGrid } from './vision'

export type SaveReference = string | [number, number, string?]
export type SaveGridPoint = { i: number; j: number }
export type SaveDestination = Partial<SaveGridPoint & { x: number; y: number; label: string }>

export type SaveEntityState = {
  action?: string | null
  assetAge?: unknown
  assetCiv?: unknown
  assetType?: unknown
  blockedGatherApproach?: { target: SaveReference; action: string } | null
  buildQueue?: string[]
  currentFrame?: number
  currentSheet?: unknown
  degree?: number
  dest?: SaveReference | SaveDestination | null
  direction?: number
  hitPoints?: number
  i: number
  inactif?: boolean
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
  isFleeing?: boolean
  isUsedBy?: string | null
  j: number
  label?: string
  loadedInTransport?: string | null
  loading?: unknown
  loadingType?: unknown
  loop?: boolean
  path?: SaveGridPoint[]
  previousDest?: SaveReference | SaveDestination | null
  previousWork?: string | null
  quantity?: number
  queue?: unknown[]
  rallyPoint?: unknown
  realDest?: SaveDestination | null
  size?: number
  technology?: unknown
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
  target?: unknown
  attacker?: unknown
  lastSeenAgo?: number
  lastSeenAt?: number
  attackerFamily?: string | null
  attackerType?: string | null
  count?: number
}

export type SavedEnemyMemoryState = {
  instance?: unknown
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
  seed?: string | number
  size?: number
  mapType?: string
  positionsCount?: number
  pregeneratedBlueprintId?: string | number | null
}

export type GameConfig = {
  allTechnologies?: boolean
  bots?: number
  difficulty?: string
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
  color?: string
  difficulty?: string
  isHuman?: boolean
  name?: string
  team?: number | null
}

export type LoadedGameConfig = {
  animals?: Record<string, { totalHitPoints?: number; totalQuantity?: number }>
  buildings?: Record<string, unknown>
  resources?: Record<string, unknown>
  units?: Record<string, unknown>
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

export type SaveRecord = SerializedSave

export type SaveIndexEntry = {
  date: number
  key: string
  name: string
}
