import { belongsToSettlement } from '../economy/collectiveConstruction'
import { getMarketGold, getMarketGoldTarget, getMarketDailyGold, type MarketWallet } from './equipmentMarket'

type Market = MarketWallet & {
  type: string
  i?: number
  j?: number
  spaceId?: string
  isBuilt?: boolean
  isDead?: boolean
  isDestroyed?: boolean
}
type Owner = { buildings?: Market[] }

/** One daily allowance per settlement, split between its markets without destroying trade receipts. */
export function replenishSettlementMarketGold(owner: Owner): boolean {
  const pending = (owner.buildings ?? []).filter(
    market => market.type === 'Market' && market.isBuilt && !market.isDead && !market.isDestroyed
  )
  let changed = false
  while (pending.length) {
    const first = pending.shift()!
    const group = [first]
    for (let index = pending.length - 1; index >= 0; index--) {
      const candidate = pending[index]!
      if (
        (first.i == null && candidate.i == null) ||
        belongsToSettlement(
          owner as Parameters<typeof belongsToSettlement>[0],
          first as Parameters<typeof belongsToSettlement>[1],
          candidate as Parameters<typeof belongsToSettlement>[2]
        )
      )
        group.push(...pending.splice(index, 1))
    }
    const target = Math.max(...group.map(getMarketGoldTarget))
    let total = 0
    for (const market of group) {
      const previous = market.marketGold
      total += getMarketGold(market)
      changed ||= previous !== market.marketGold
    }
    let budget = Math.min(Math.max(...group.map(getMarketDailyGold)), Math.max(0, target - total))
    const eligible = group.filter(market => getMarketGold(market) < getMarketGoldTarget(market))
    for (let index = 0; index < eligible.length && budget > 0; index++) {
      const market = eligible[index]!
      const amount = Math.min(
        getMarketGoldTarget(market) - getMarketGold(market),
        Math.ceil(budget / (eligible.length - index))
      )
      market.marketGold = getMarketGold(market) + amount
      budget -= amount
      changed ||= amount > 0
    }
  }
  return changed
}
