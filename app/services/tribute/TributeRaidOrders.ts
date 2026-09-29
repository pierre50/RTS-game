import { ACTION_TYPES, WORK_TYPES } from '../../constants'
import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import type { TributeRaidSystem } from '../TributeRaidSystem'
import { RAID_APPROACH_RANGE, getRaidCellDistance, livingRaidUnits, type TributeRaid } from './TributeRaidRules'
type Host = Pick<
  TributeRaidSystem,
  'context' | 'cleanupRaid' | 'despawnRaid' | 'resolveTributeParley' | 'sendRaidToTarget' | 'sendHostileRaidOrders'
>
export function updateRaid(this: Host, raid: TributeRaid): void {
  const units = livingRaidUnits(raid)
  const target = raid.target
  if (!units.length) {
    this.cleanupRaid(raid)
    return
  }
  if (!target || target.isDead || target.isDestroyed) {
    this.despawnRaid(raid)
    return
  }
  if (raid.chief.isDead || raid.chief.isDestroyed) raid.chief = units[0]
  for (const unit of units) if (unit.factionExpedition) unit.factionExpedition.phase = raid.phase

  if (raid.phase === 'approaching') {
    if (getRaidCellDistance(raid.chief, target) <= RAID_APPROACH_RANGE) {
      this.resolveTributeParley(raid)
      return
    }
    this.sendRaidToTarget(raid)
    return
  }

  if (raid.phase === 'hostile') this.sendHostileRaidOrders(raid)

  if (raid.phase === 'leaving') {
    this.despawnRaid(raid)
  }
}
export function sendHostileRaidOrders(this: Host, raid: TributeRaid): void {
  const target = raid.target
  if (!target || target.isDead || target.isDestroyed) return
  raid.rallyPoint ??= { i: target.i, j: target.j, spaceId: target.spaceId }
  for (const unit of livingRaidUnits(raid)) {
    // Let an ongoing fight finish; only resume idle soldiers or their approach.
    if (unit.action || unit.combatMode === 'attack' || unit.combatMode === 'recover' || unit.combatMode === 'flee')
      continue
    if (playerSeesTarget(unit.owner, target)) {
      unit.sendToEvt?.(target, ACTION_TYPES.attack, { forceRepath: true })
      continue
    }
    if (unit.path?.length) continue
    if ((unit.spaceId ?? 'outside') !== (raid.rallyPoint.spaceId ?? 'outside')) continue
    const map = getEntitySpaceMapLike(unit, this.context.map)
    const cell = map?.grid[raid.rallyPoint.i]?.[raid.rallyPoint.j]
    if (cell && getRaidCellDistance(unit, cell) > 2) {
      unit.sendToEvt?.(cell, null, { forceRepath: true })
    }
  }
}
export function sendRaidToTarget(this: Host, raid: TributeRaid, options: { forceRepath?: boolean } = {}): void {
  const target = raid.target
  if (!target) return
  for (const unit of livingRaidUnits(raid)) {
    unit.work = WORK_TYPES.attacker
    unit.action = null
    unit.sendToEvt?.(target, null, options)
  }
}
