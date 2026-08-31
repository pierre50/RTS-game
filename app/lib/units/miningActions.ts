import { ACTION_TYPES, MINING_RESOURCE_CONFIG } from '../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

export function getMiningActions(): string[] {
  const configured = Object.values(MINING_RESOURCE_CONFIG ?? {})
    .map(config => config.action)
    .filter((action): action is string => Boolean(action))
  if (configured.length) return configured
  return [ACTION_TYPES.minestone, ACTION_TYPES.minegold].filter((action): action is string => Boolean(action))
}

export function sendUnitToMiningAction(
  unit: UnitEntity,
  target: RuntimeEntity,
  action: string | null | undefined,
  immediate = false
): unknown {
  if (action === ACTION_TYPES.minestone) {
    if (!unit.sendToStone) return false
    return unit.sendToStone(target, immediate)
  }
  if (action === ACTION_TYPES.minegold) {
    if (!unit.sendToGold) return false
    return unit.sendToGold(target, immediate)
  }
  if (action === ACTION_TYPES.minecopper) {
    if (!unit.sendToCopper) return false
    return unit.sendToCopper(target, immediate)
  }
  if (action === ACTION_TYPES.mineiron) {
    if (!unit.sendToIron) return false
    return unit.sendToIron(target, immediate)
  }
  return false
}
