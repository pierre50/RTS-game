/**
 * Refunds costs to the player's resources.
 * @param {object} player - The player object containing resources.
 * @param {object} cost - An object representing the costs to refund.
 */
export function refundCost(player, cost) {
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') {
    console.error('Invalid arguments provided to refundCost.')
    return
  }

  Object.keys(cost).forEach(prop => {
    if (typeof cost[prop] === 'number') {
      player[prop] += cost[prop]
    } else {
      console.warn(`Cost for ${prop} is not a number:`, cost[prop])
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
    console.error('Invalid arguments provided to payCost.')
    return
  }

  Object.keys(cost).forEach(prop => {
    if (typeof cost[prop] === 'number') {
      player[prop] -= cost[prop]
    } else {
      console.warn(`Cost for ${prop} is not a number:`, cost[prop])
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
  if (!player || typeof player !== 'object' || !cost || typeof cost !== 'object') {
    console.error('Invalid arguments provided to canAfford.')
    return false
  }

  return !Object.keys(cost).some(prop => {
    return typeof cost[prop] === 'number' && player[prop] < cost[prop]
  })
}
