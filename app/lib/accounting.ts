import {
  depositChestResources,
  getPlayerResourceTotals,
  hasPlayerResourceChests,
  withdrawChestResources,
} from './resources/playerResourceTotals'
import type { ResourceAmount } from '../types/common'

export type ResourceLedger = ResourceAmount
type ResourceName = keyof ResourceLedger

function resourceEntries(cost: ResourceLedger): Array<[ResourceName, number]> {
  return (Object.entries(cost) as Array<[ResourceName, number | undefined]>).filter(
    (entry): entry is [ResourceName, number] => typeof entry[1] === 'number'
  )
}

/**
 * Refunds costs to the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to refund.
 */
export function refundCost(player: ResourceLedger | null | undefined, cost: ResourceLedger | null | undefined): void {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') return
  if (hasPlayerResourceChests(player) && depositChestResources(player, cost)) return
  for (const [prop, amount] of resourceEntries(cost)) {
    player[prop] = (player[prop] || 0) + amount
  }
}

/**
 * Deducts costs from the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to pay.
 */
export function payCost(player: ResourceLedger | null | undefined, cost: ResourceLedger | null | undefined): void {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') return
  if (hasPlayerResourceChests(player)) {
    withdrawChestResources(player, cost)
    return
  }
  for (const [prop, amount] of resourceEntries(cost)) {
    player[prop] = (player[prop] || 0) - amount
  }
}

/**
 * Checks if the player can afford the given costs.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to check.
 * @returns {boolean} - True if the player can afford the costs, false otherwise.
 */
export function canAfford(player: ResourceLedger | null | undefined, cost: ResourceLedger | null | undefined): boolean {
  if (!cost || typeof cost !== 'object') return true
  if (!player || typeof player !== 'object') return false
  const resources = hasPlayerResourceChests(player) ? getPlayerResourceTotals(player) : player
  for (const [prop, amount] of resourceEntries(cost)) {
    if ((resources[prop] || 0) < amount) return false
  }
  return true
}
