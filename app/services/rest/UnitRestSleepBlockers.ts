import { ACTION_TYPES, FAMILY_TYPES, WORK_TYPES } from '../../constants'
import { isBanditUnit } from '../../lib/combat/bandits'
import { sameMapSpace } from '../../lib/mapSpaces'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { restDistance } from './UnitRestMath'

const DEFAULT_UNIT_SIGHT = 7
const BANDIT_HOME_SLEEP_RADIUS = 8
const LOCAL_WATCH_RADIUS = 30

export function isActiveDefense(unit: UnitEntity): boolean {
  const attackAction = ACTION_TYPES?.attack ?? 'attack'
  return Boolean(
    unit.action === attackAction ||
      unit.combatMode === 'attack' ||
      unit.combatMode === 'recover' ||
      unit.combatMode === 'flee' ||
      unit.waitingForEnergyAction
  )
}

function getBanditHomeAnchor(unit: UnitEntity): Pick<RuntimeEntity, 'i' | 'j'> | null {
  return unit.campPatrolAnchor ?? unit.banditCampAnchor ?? null
}

export function isBanditAtHome(unit: UnitEntity): boolean {
  if (!isBanditUnit(unit)) return true
  const anchor = getBanditHomeAnchor(unit)
  if (!anchor) return false
  return restDistance(unit, anchor) <= BANDIT_HOME_SLEEP_RADIUS
}

function isLocalWatchRound(unit: UnitEntity): boolean {
  const dest = unit.dest
  if (!unit.dailySchedule?.nightWatch || unit.action || !dest) return false
  if ('family' in dest && dest.family !== 'cell') return false
  return (unit.owner?.buildings ?? []).some(
    building =>
      building.isBuilt &&
      !building.isDead &&
      !building.isDestroyed &&
      sameMapSpace(unit, building) &&
      restDistance(unit, building) <= LOCAL_WATCH_RADIUS &&
      restDistance(dest, building) <= LOCAL_WATCH_RADIUS
  )
}

export function isExternalOffensiveUnit(unit: UnitEntity): boolean {
  if (isBanditUnit(unit) && isBanditAtHome(unit)) return false
  // Local watch rounds are interruptible at the relief hour, including restored cell destinations.
  if (isLocalWatchRound(unit)) return false
  return Boolean(
    unit.work === WORK_TYPES.attacker &&
      (unit.dest || unit.action === ACTION_TYPES.attack || unit.combatMode === 'attack' || unit.path?.length)
  )
}

function getPlayedPlayer(unit: UnitEntity): UnitEntity['owner'] | null {
  return unit.context?.player ?? unit.context?.players?.find(player => player.isPlayed) ?? unit.owner ?? null
}

function isHostileRestBlocker(unit: UnitEntity, candidate: RuntimeEntity): boolean {
  if (candidate === unit || candidate.isDead || candidate.isDestroyed) return false
  if (candidate.family !== FAMILY_TYPES.unit && candidate.family !== FAMILY_TYPES.building) return false
  if (!sameMapSpace(unit, candidate)) return false
  const player = unit.owner?.type === 'AI' ? unit.owner : getPlayedPlayer(unit)
  if (!player?.isEnemy?.(candidate.owner)) return false
  if (player.views && !player.views.isVisible(candidate.i, candidate.j)) return false
  return restDistance(unit, candidate) <= (unit.sight ?? DEFAULT_UNIT_SIGHT)
}

export function hasVisiblePlayerEnemyNearby(unit: UnitEntity): boolean {
  for (const player of unit.context?.players ?? []) {
    for (const candidate of [...(player.units ?? []), ...(player.buildings ?? [])]) {
      if (isHostileRestBlocker(unit, candidate)) return true
    }
  }
  return false
}
