import { setUnitOverheadIndicator } from '../../lib/entities/overheadIndicator'
import type { TributeRaidSystem } from './TributeRaidSystem'
import { findRaidTarget } from './TributeRaidTargeting'
import { getHostileRaidMessage, getTributePaidMessage } from './TributeRaidText'
import { creditFactionRaidTribute, returnFactionRaidUnit } from './FactionRaidEconomy'
import { livingRaidUnits, type TributeRaid, type TributeRaidOwner, type TributeRaidUnit } from './TributeRaidRules'
type Host = Pick<
  TributeRaidSystem,
  | 'context'
  | 'makeRaidHostile'
  | 'raids'
  | 'startRaidUpdates'
  | 'sendRaidToTarget'
  | 'sendHostileRaidOrders'
  | 'removeUnitFromRuntime'
  | 'cleanupRaid'
  | 'makeFactionRaidRelationHostile'
  | 'despawnRaid'
>
export function acceptTribute(this: Host, raid: TributeRaid): void {
  if (raid.phase === 'leaving') return
  const expedition = livingRaidUnits(raid)[0]?.factionExpedition
  if (expedition) creditFactionRaidTribute(this.context, expedition)
  raid.phase = 'leaving'
  for (const unit of raid.units) if (unit.factionExpedition) unit.factionExpedition.phase = 'leaving'
  setUnitOverheadIndicator(raid.chief, null)
  if (raid.kind === 'faction' && raid.faction) this.context.changeFactionRelation?.(raid.faction.id, 8, 'tribute-paid')
  this.context.menu?.showMessage(getTributePaidMessage(raid), 'success')
  this.despawnRaid(raid)
}
export function makeRaidHostile(this: Host, raid: TributeRaid): void {
  if (raid.phase === 'hostile') return
  raid.phase = 'hostile'
  for (const unit of raid.units) if (unit.factionExpedition) unit.factionExpedition.phase = 'hostile'
  this.makeFactionRaidRelationHostile(raid)
  raid.modal?.close()
  raid.modal = null
  setUnitOverheadIndicator(raid.chief, null)
  const owner = raid.chief.owner
  if (owner) {
    owner.diplomacy = null
    if (raid.kind === 'faction' && raid.faction) owner.factionId = raid.faction.id
  }
  this.sendHostileRaidOrders(raid)
  this.context.menu?.showMessage(getHostileRaidMessage(raid), 'warning')
}
export function despawnRaid(this: Host, raid: TributeRaid): void {
  raid.phase = 'leaving'
  for (const unit of livingRaidUnits(raid)) {
    if (unit.factionExpedition) unit.factionExpedition.phase = 'leaving'
    if (unit.factionExpedition && !returnFactionRaidUnit(this.context, unit)) continue
    this.removeUnitFromRuntime(unit)
    raid.units.splice(raid.units.indexOf(unit), 1)
  }
  if (livingRaidUnits(raid).length && raid.units.some(unit => unit.factionExpedition)) {
    raid.phase = 'leaving'
    return
  }
  this.cleanupRaid(raid)
}
export function restoreFactionExpeditions(this: Host): void {
  const groups = new Map<string, TributeRaidUnit[]>()
  for (const player of this.context.players ?? [])
    for (const unit of (player.units ?? []) as TributeRaidUnit[]) {
      if (!unit.factionExpedition || unit.isDead || unit.isDestroyed) continue
      const id = unit.factionExpedition.raidId
      groups.set(id, [...(groups.get(id) ?? []), unit])
    }
  for (const [id, units] of groups) {
    const saved = units[0].factionExpedition!
    const faction = this.context.getCampaignFactions?.()?.[saved.factionId]
    const target = findRaidTarget(this.context, 'faction')
    const owner = units[0].owner as TributeRaidOwner
    if (!faction || !owner) continue
    owner.factionRaidOwner = true
    owner.factionRaidFactionId = faction.id
    owner.factionId = saved.phase === 'hostile' ? faction.id : null
    owner.diplomacy = saved.phase === 'hostile' ? null : 'neutral'
    const raid: TributeRaid = {
      id,
      units,
      chief: units[0],
      target: target ?? units[0],
      kind: 'faction',
      faction,
      phase: !target ? 'leaving' : saved.phase === 'parley' ? 'approaching' : saved.phase,
      tribute: saved.tribute,
    }
    for (const unit of units) {
      unit.tributeRaidId = id
      unit.handleIsAttacked = attacker => {
        if (attacker?.owner !== this.context.player || raid.phase === 'hostile') return false
        this.makeRaidHostile(raid)
        return true
      }
    }
    this.raids.push(raid)
    this.startRaidUpdates(raid)
    if (raid.phase === 'approaching') this.sendRaidToTarget(raid, { forceRepath: true })
    if (raid.phase === 'hostile' && target) this.sendHostileRaidOrders(raid)
  }
}
export function cleanupRaid(this: Host, raid: TributeRaid): void {
  if (raid.phase === 'parley') raid.phase = 'leaving'
  if (raid.updateTaskId != null) {
    this.context.scheduler.remove(raid.updateTaskId)
    raid.updateTaskId = null
  }
  raid.modal?.close()
  raid.modal = null
  setUnitOverheadIndicator(raid.chief, null)
  const index = this.raids.indexOf(raid)
  if (index >= 0) this.raids.splice(index, 1)
}
