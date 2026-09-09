import type { AIResourceAmount, AIResourceName } from './types'
const RESOURCE_NAMES: AIResourceName[] = ['wood', 'food', 'gold', 'stone']
export function resourceEntries(cost: AIResourceAmount = {}): [AIResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AIResourceName, number | undefined]).filter(
    (entry): entry is [AIResourceName, number] => typeof entry[1] === 'number'
  )
}

export function addResourceAmounts(a: AIResourceAmount, b: AIResourceAmount): AIResourceAmount {
  const result = { ...a }
  for (const [resource, amount] of resourceEntries(b)) {
    result[resource] = (result[resource] ?? 0) + amount
  }
  return result
}
