import { ACTION_TYPES, MINING_RESOURCE_CONFIG } from '../constants'

export function getMiningActions(): string[] {
  const configured = Object.values(MINING_RESOURCE_CONFIG ?? {})
    .map(config => config.action)
    .filter((action): action is string => Boolean(action))
  if (configured.length) return configured
  return [ACTION_TYPES.minestone, ACTION_TYPES.minegold].filter((action): action is string => Boolean(action))
}
