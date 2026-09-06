import { t } from '../lib/lang'
import type { GameContextLike } from '../types/context'
import type { PlayerLike } from '../types/player'

type DailyWorldReportEntry =
  | { count: number; player: PlayerLike; type: 'food-consumed' }
  | { count: number; player: PlayerLike; type: 'market-restocked' }
  | { count: number; player: PlayerLike; type: 'trap-filled' }
  | { count: number; player: PlayerLike; type: 'villager-arrival' }

type PlayerReport = {
  foodConsumed: number
  marketsRestocked: number
  trapsFilled: number
  villagerArrivals: number
}

export class DailyWorldReport {
  context: GameContextLike
  day: number
  entries: DailyWorldReportEntry[]

  constructor(context: GameContextLike, day: number) {
    this.context = context
    this.day = day
    this.entries = []
  }

  add(entry: DailyWorldReportEntry): void {
    if (entry.count <= 0) return
    this.entries.push(entry)
  }

  flush(): void {
    const player = this.context.player
    if (!player?.isPlayed) return

    const report = this.getPlayerReport(player)
    if (!this.hasNotablePlayerEvent(report)) return

    this.context.menu?.showMessage?.(this.formatPlayerSummary(report), 'info')
  }

  private getPlayerReport(player: PlayerLike): PlayerReport {
    const report: PlayerReport = {
      foodConsumed: 0,
      marketsRestocked: 0,
      trapsFilled: 0,
      villagerArrivals: 0,
    }

    for (const entry of this.entries) {
      if (!entry.player) continue
      if (entry.player !== player && entry.player.label !== player.label) continue
      if (entry.type === 'food-consumed') report.foodConsumed += entry.count
      else if (entry.type === 'market-restocked') report.marketsRestocked += entry.count
      else if (entry.type === 'trap-filled') report.trapsFilled += entry.count
      else if (entry.type === 'villager-arrival') report.villagerArrivals += entry.count
    }

    return report
  }

  private hasNotablePlayerEvent(report: PlayerReport): boolean {
    return report.villagerArrivals > 0 || report.trapsFilled > 0 || report.marketsRestocked > 0
  }

  private formatPlayerSummary(report: PlayerReport): string {
    const parts: string[] = []
    if (report.villagerArrivals > 0) {
      parts.push(
        t(report.villagerArrivals === 1 ? 'dailyReportVillagerArrived' : 'dailyReportVillagersArrived', {
          count: report.villagerArrivals,
        })
      )
    }
    if (report.trapsFilled > 0) {
      parts.push(
        t(report.trapsFilled === 1 ? 'dailyReportTrapFilled' : 'dailyReportTrapsFilled', {
          count: report.trapsFilled,
        })
      )
    }
    if (report.marketsRestocked > 0) {
      parts.push(
        t(report.marketsRestocked === 1 ? 'dailyReportMarketRestocked' : 'dailyReportMarketsRestocked', {
          count: report.marketsRestocked,
        })
      )
    }
    if (report.foodConsumed > 0) {
      parts.push(t('dailyReportFoodConsumed', { count: report.foodConsumed }))
    }
    return t('dailyReportSummary', { day: this.day, summary: parts.join(', ') })
  }
}
