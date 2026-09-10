import type { AIResourceAmount, AICostResourceName } from './types'
const RESOURCE_NAMES: AICostResourceName[] = ['wood', 'food', 'gold', 'stone', 'fiber', 'leather']
export function resourceEntries(cost: AIResourceAmount = {}): [AICostResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AICostResourceName, number | undefined]).filter(
    (entry): entry is [AICostResourceName, number] => typeof entry[1] === 'number'
  )
}

export function addResourceAmounts(a: AIResourceAmount, b: AIResourceAmount): AIResourceAmount {
  const result = { ...a }
  for (const [resource, amount] of resourceEntries(b)) {
    result[resource] = (result[resource] ?? 0) + amount
  }
  return result
}
