import type { SavePlayerState, SaveEntityState } from './save'
import type { MapSettlement } from '../classes/map/MapGenerationTypes'
import type { BanditCampPlacement } from './camp'

export type PreparedSettlementReference = {
  path: string
  sha256: string
  sourceSha256: string
  rulesSha256: string
}

export type PreparedSettlements = {
  format: 'prepared-settlements'
  version: 1
  mapId: string
  size: number
  source: { file: string; sha256: string; rulesSha256: string }
  settlements: Array<MapSettlement & { ownerLabel: string; resourceLabels?: string[] }>
  heroSpawns: Array<{ civ: string; i: number; j: number }>
  banditCamps: Array<
    BanditCampPlacement & {
      ownerLabel: string
      unitTypes: string[]
      caveContent?: { caveId: string; inventory: SaveEntityState['inventory'] }
    }
  >
  players: SavePlayerState[]
  resources: SaveEntityState[]
  animals: SaveEntityState[]
}
