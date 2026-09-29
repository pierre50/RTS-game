import type { AIResourceAmount, AICostResourceName, AIStrategyPlayerLike } from './types'
const RESOURCE_NAMES: AICostResourceName[] = ['wood', 'food', 'gold', 'stone', 'fiber', 'leather', 'wheat']
export function resourceEntries(cost: AIResourceAmount = {}): [AICostResourceName, number][] {
  return RESOURCE_NAMES.map(resource => [resource, cost[resource]] as [AICostResourceName, number | undefined]).filter(
    (entry): entry is [AICostResourceName, number] => typeof entry[1] === 'number'
  )
}

export function storageResourcesForAI(ai: AIStrategyPlayerLike) {
  return [
    ...(ai.foundedTrees ?? []),
    ...(ai.foundedGolds ?? []),
    ...(ai.foundedStones ?? []),
    ...(ai.foundedCoppers ?? []),
    ...(ai.foundedIrons ?? []),
  ]
}
