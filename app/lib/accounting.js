/**
 * Refunds costs to the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to refund.
 */
export function refundCost(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') {
    return
  }

  Object.keys(cost).forEach(prop => {
    if (typeof cost[prop] === 'number') {
      player[prop] += cost[prop]
    }
  })
}

/**
 * Deducts costs from the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to pay.
 */
export function payCost(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') {
    return
  }

  Object.keys(cost).forEach(prop => {
    if (typeof cost[prop] === 'number') {
      player[prop] -= cost[prop]
    }
  })
}

/**
 * Checks if the player can afford the given costs.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to check.
 * @returns {boolean} - True if the player can afford the costs, false otherwise.
 */
export function canAfford(player, cost) {
  // Validate inputs
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') {
    return false
  }

  // Iterate over the cost object
  for (const prop in cost) {
    // Check if the cost for the property is a number
    if (typeof cost[prop] === 'number') {
      // Early return if player cannot afford the cost
      if (player[prop] < cost[prop]) {
        return false
      }
    }
  }

  // If all costs are affordable, return true
  return true
}
