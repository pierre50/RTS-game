import type { ResourceAmount, UnknownRecord } from './common'

export type SaveRecord = UnknownRecord

export type GameConfig = UnknownRecord & {
  allTechnologies?: boolean
  instantMode?: boolean
  mapType?: string
  players?: PlayerSetupConfig[]
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

export type SerializedSave = SaveRecord & {
  camera?: unknown
  config?: unknown
  map?: unknown
  players?: unknown
  resources?: unknown
  animals?: unknown
  runtime?: unknown
}

export type SaveIndexEntry = {
  date: number
  key: string
  name: string
}
