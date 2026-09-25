import { UNIT_TYPES } from '../../constants/entities'
import type { ResourceAmount } from '../../types/common'

export function getUnitTrainingCost(
  owner: { age?: number; config?: { units?: Record<string, { cost?: ResourceAmount }> } } | null | undefined,
  type: string
): ResourceAmount {
  // Training an existing villager or soldier only takes time, never resources.
  return type === UNIT_TYPES.villager ? (owner?.config?.units?.[type]?.cost ?? {}) : {}
}
