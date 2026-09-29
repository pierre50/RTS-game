import { t } from '../lib/lang'
import type { GameContextLike } from '../types/context'
import type { PlayerLike } from '../types/player'

type DailyWorldReportEntry = {
  count: number
  player: PlayerLike
  type: 'market-restocked' | 'trap-filled' | 'villager-arrival'
}

/** Only villager arrivals become notifications; routine activity and colony alerts stay silent. */
export class DailyWorldReport {
  private entries: DailyWorldReportEntry[] = []

  constructor(private context: GameContextLike) {}

  add(entry: DailyWorldReportEntry): void {
    if (entry.type === 'villager-arrival' && entry.count > 0) this.entries.push(entry)
  }

  flush(): void {
    const entries = this.entries.splice(0)
    const player = this.context.player
    if (!player?.isPlayed) return
    let arrivals = 0
    for (const entry of entries) {
      if (entry.player !== player && entry.player.label !== player.label) continue
      arrivals += entry.count
    }
    if (arrivals > 0) {
      this.context.menu?.showMessage?.(
        t(arrivals === 1 ? 'dailyReportVillagerArrived' : 'dailyReportVillagersArrived', { count: arrivals }),
        'info'
      )
    }
  }
}
