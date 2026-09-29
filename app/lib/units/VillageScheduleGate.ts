import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import { getVillagerSchedule } from './villagerSchedule'
import { villageStateRevision } from './villageStateEvents'

export function villageCalendarMinute(context: Pick<GameContextLike, 'dayNight'>): number {
  const clock = context.dayNight
  const elapsed = clock?.getElapsedMs?.()
  if (elapsed != null) return DAY_NIGHT_CONFIG.startHour * 60 + elapsed / (DAY_NIGHT_CONFIG.dayLengthMs / 1440)
  const state = clock?.state
  if (!state) return 0
  return (
    ((state.day ?? 1) - 1 + (state.hour < DAY_NIGHT_CONFIG.newDayHour ? 1 : 0)) * 1440 +
    state.hour * 60 +
    (state.minute ?? 0)
  )
}

/** A clock check is constant-time per owner; schedules are read only at a transition or a state event. */
export class VillageScheduleGate {
  private owners = new Map<PlayerLike, number>()
  private next = -Infinity
  private previous = -Infinity

  due(context: Pick<GameContextLike, 'dayNight' | 'players'>): boolean {
    const now = villageCalendarMinute(context)
    const players = context.players ?? []
    return (
      now < this.previous ||
      now >= this.next ||
      players.length !== this.owners.size ||
      players.some(owner => this.owners.get(owner) !== villageStateRevision(owner))
    )
  }

  settle(context: Pick<GameContextLike, 'dayNight' | 'players'>): void {
    const now = villageCalendarMinute(context)
    const midnight = Math.floor(now / 1440) * 1440
    this.previous = now
    this.next = midnight + 1440
    this.owners.clear()
    for (const owner of context.players ?? []) {
      this.owners.set(owner, villageStateRevision(owner))
      for (const unit of owner.units ?? []) {
        if (unit.isDead || unit.isDestroyed) continue
        const boundaries = unit.type === 'Villager' ? Object.values(getVillagerSchedule(unit)) : [360, 1080]
        for (const minute of boundaries) {
          const at = midnight + minute
          if (at > now) this.next = Math.min(this.next, at)
        }
      }
    }
  }
}
