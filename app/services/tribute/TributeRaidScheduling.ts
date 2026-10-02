import type { DailyWorldEvent } from '../dailyEvents/DailyWorldEventSystem'
import type { TributeRaidSystem } from './TributeRaidSystem'
import { selectFactionRaidArmy } from './FactionRaidEconomy'
import {
  BANDIT_RAID_FIRST_DAY,
  BANDIT_RAID_INTERVAL_DAYS,
  FACTION_RAID_FIRST_DAY,
  FACTION_RAID_INTERVAL_DAYS,
} from './TributeRaidRules'
type Host = Pick<
  TributeRaidSystem,
  | 'getDelayUntilFactionRaidWindowMs'
  | 'scheduleFactionRaidAtWindow'
  | 'triggerFactionRaid'
  | 'context'
  | 'destroyed'
  | 'factionRaidPending'
  | 'canStartRaid'
  | 'createTemporaryRaidOwner'
  | 'createRaid'
  | 'isFactionRaidWindowOpen'
  | 'findAngryKnownFaction'
  | 'getFactionRaidSize'
  | 'getOrCreateFactionRaidOwner'
  | 'getFactionTributeCost'
  | 'lastScheduledDay'
  | 'triggerScheduledFactionRaid'
  | 'triggerRaid'
>
export function handleDailyWorldEvent(this: Host, { day }: Pick<DailyWorldEvent, 'day'>): void {
  if (this.context.isTutorialActive?.()) return
  const shouldTryFactionRaid =
    day >= FACTION_RAID_FIRST_DAY &&
    (day - FACTION_RAID_FIRST_DAY) % FACTION_RAID_INTERVAL_DAYS === 0 &&
    this.lastScheduledDay !== day

  if (shouldTryFactionRaid) {
    this.triggerScheduledFactionRaid(day)
    return
  }

  if (day < BANDIT_RAID_FIRST_DAY) return
  if ((day - BANDIT_RAID_FIRST_DAY) % BANDIT_RAID_INTERVAL_DAYS !== 0) return
  if (this.lastScheduledDay === day) return
  this.lastScheduledDay = day
  void this.triggerRaid({ source: 'schedule' })
}
export async function triggerFactionRaid(
  this: Host,
  options: { ignoreBaseWorld?: boolean; source?: 'schedule' | 'dev-console' } = {}
): Promise<boolean> {
  if (!this.isFactionRaidWindowOpen()) return false
  if (!this.canStartRaid()) return false
  if (this.factionRaidPending || this.destroyed) return false
  this.context.updateWorldEconomy?.()
  const faction = this.findAngryKnownFaction(options)
  if (!faction) return false
  const army = selectFactionRaidArmy(this.context, faction.id, this.getFactionRaidSize(faction))
  if (!army) return false
  const economy = this.context.getCampaignEconomy?.()
  const day = this.context.dayNight?.state?.day ?? 1
  const lastDay = economy?.lastFactionRaidDays?.[faction.id]
  if (lastDay != null && day - lastDay < FACTION_RAID_INTERVAL_DAYS) return false
  this.factionRaidPending = true
  try {
    const started = await this.createRaid({
      kind: 'faction',
      faction,
      owner: this.getOrCreateFactionRaidOwner(faction),
      size: army.units.length,
      army,
      tribute: this.getFactionTributeCost(faction),
    })
    const currentEconomy = this.context.getCampaignEconomy?.()
    if (started && currentEconomy) {
      currentEconomy.lastFactionRaidDays ??= {}
      currentEconomy.lastFactionRaidDays[faction.id] = day
    }
    return started
  } finally {
    this.factionRaidPending = false
  }
}
export async function triggerTutorialRaid(this: Host): Promise<boolean> {
  if (!this.context.isTutorialActive?.() || this.destroyed || this.factionRaidPending || !this.canStartRaid())
    return false
  this.factionRaidPending = true
  try {
    const owner = this.createTemporaryRaidOwner({
      civ: this.context.player?.civ ?? 'Hellas',
      name: 'Raiders',
      color: 'red',
    })
    const started = await this.createRaid({ kind: 'faction', owner, size: 24, tribute: {}, scripted: true })
    if (!started && !owner.units?.length) {
      const index = this.context.players.indexOf(owner)
      if (index >= 0) this.context.players.splice(index, 1)
    }
    return started
  } finally {
    this.factionRaidPending = false
  }
}

export function triggerScheduledFactionRaid(this: Host, day: number): void {
  if (this.context.isTutorialActive?.()) return
  const delayMs = this.getDelayUntilFactionRaidWindowMs()
  if (delayMs == null) return
  if (delayMs > 0) {
    this.scheduleFactionRaidAtWindow(day, delayMs)
    return
  }
  void this.triggerFactionRaid({ source: 'schedule' }).then(started => {
    if (started) this.lastScheduledDay = day
  })
}
