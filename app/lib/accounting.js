/**
 * Refunds costs to the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to refund.
 */
export function refundCost(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') return
  for (const prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      player[prop] = (player[prop] || 0) + cost[prop]
    }
  }
}

/**
 * Deducts costs from the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to pay.
 */
export function payCost(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') return
  for (const prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      player[prop] = (player[prop] || 0) - cost[prop]
    }
  }
}

/**
 * Checks if the player can afford the given costs.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to check.
 * @returns {boolean} - True if the player can afford the costs, false otherwise.
 */
export function canAfford(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') return false
  for (const prop in cost) {
    if (Object.prototype.hasOwnProperty.call(cost, prop) && typeof cost[prop] === 'number') {
      if ((player[prop] || 0) < cost[prop]) return false
    }
  }
  return true
}
