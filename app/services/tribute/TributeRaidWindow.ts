import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import type { TributeRaidSystem } from '../TributeRaidSystem'
import { FACTION_RAID_START_HOUR, isFactionRaidHourAllowed } from './TributeRaidRules'
type Host = Pick<TributeRaidSystem, 'context'>
export function getDelayUntilFactionRaidWindowMs(this: Host): number | null {
  const state = this.context.dayNight?.state
  if (!state) return 0
  const time = state.hour + state.minute / 60
  if (isFactionRaidHourAllowed(state.hour, state.minute)) return 0
  if (time >= FACTION_RAID_START_HOUR) return null
  return ((FACTION_RAID_START_HOUR - time) / DAY_NIGHT_CONFIG.hoursPerDay) * DAY_NIGHT_CONFIG.dayLengthMs
}
export function isFactionRaidWindowOpen(this: Host): boolean {
  const state = this.context.dayNight?.state
  return !state || isFactionRaidHourAllowed(state.hour, state.minute)
}
