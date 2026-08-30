import { UNIT_TYPES } from '../constants'
import type { ResourceAmount } from '../types/common'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { PlayerLike } from '../types/player'
import type { FactionSave } from '../types/save'
import type { Modal } from '../lib'
import type { SchedulerTaskId } from '../types/context'

export const BANDIT_OWNER_NAME = 'Bandits'
export const FACTION_RAID_FIRST_DAY = 3
export const FACTION_RAID_INTERVAL_DAYS = 3
export const FACTION_RAID_MIN_HATE = -10
export const BANDIT_RAID_FIRST_DAY = 4
export const BANDIT_RAID_INTERVAL_DAYS = 4
export const RAID_APPROACH_RANGE = 2.2
export const RAID_RETURN_RANGE = 3
export const RAID_UPDATE_MS = 350
export const RAID_SPAWN_MIN_RADIUS = 4
export const RAID_SPAWN_MAX_RADIUS = 9
export const PORTAL_RESOURCE_TYPE = 'Portal'

export type TributeRaidKind = 'bandit' | 'faction'
type TributeRaidPhase = 'approaching' | 'parley' | 'hostile' | 'leaving'

export type TributeRaidUnit = UnitEntity & {
  tributeRaidId?: string
}

export type TributeRaidOwner = PlayerLike & {
  banditRaidOwner?: true
  factionRaidOwner?: true
  factionRaidFactionId?: string
}

export type TributeRaid = {
  id: string
  kind: TributeRaidKind
  faction?: FactionSave | null
  chief: TributeRaidUnit
  target: TributeRaidUnit
  units: TributeRaidUnit[]
  phase: TributeRaidPhase
  portal: RuntimeEntity | null
  tribute: ResourceAmount
  modal?: Modal | null
  updateTaskId?: SchedulerTaskId | null
}

export function isRaidBanditOwner(player: PlayerLike): player is TributeRaidOwner {
  return Boolean((player as TributeRaidOwner).banditRaidOwner)
}

export function isRaidFactionOwner(player: PlayerLike, factionId: string): player is TributeRaidOwner {
  const raidOwner = player as TributeRaidOwner
  return Boolean(raidOwner.factionRaidOwner && raidOwner.factionRaidFactionId === factionId)
}

export function isOpenRaidLandCell(cell: RuntimeCell | null | undefined): cell is RuntimeCell {
  return Boolean(cell && !cell.solid && !cell.has && !cell.border && !cell.waterBorder && cell.category !== 'Water')
}

export function getRaidCellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

export function livingRaidUnits(raid: TributeRaid): TributeRaidUnit[] {
  return raid.units.filter(unit => !unit.isDead && !unit.isDestroyed)
}

export function getRaidUnitTypes(count: number, kind: TributeRaidKind, playerAge: number): string[] {
  if (kind === 'faction') {
    const types = [UNIT_TYPES.chief]
    for (let index = 1; index < count; index++) {
      types.push(index % 3 === 0 ? UNIT_TYPES.bowman : UNIT_TYPES.infantry)
    }
    return types
  }

  const types = [UNIT_TYPES.banditChief]
  for (let index = 1; index < count; index++) {
    const useArcher = index % 3 === 0 || playerAge >= 2
    types.push(useArcher ? UNIT_TYPES.banditArcher : UNIT_TYPES.banditSword)
  }
  return types
}
