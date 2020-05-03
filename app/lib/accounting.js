export function refundCost(player, cost) {
  Object.keys(cost).forEach(prop => {
    player[prop] += cost[prop]
  })
}

export function payCost(player, cost) {
  Object.keys(cost).forEach(prop => {
    player[prop] -= cost[prop]
  })
}

export function canAfford(player, cost) {
  return !Object.keys(cost).some(prop => player[prop] < cost[prop])
}