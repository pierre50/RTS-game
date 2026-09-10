import { RESOURCE_TYPES } from '../../constants'

export function resetHarvestedWheat(resource: {
  type: string
  quantity?: number
  totalQuantity?: number
  currentFrame?: number
  isUsedBy?: unknown
}): boolean {
  if (resource.type !== RESOURCE_TYPES.wheat || (resource.quantity ?? 0) > 0) return false
  resource.quantity = Math.max(1, resource.totalQuantity ?? 1)
  resource.currentFrame = 0
  resource.isUsedBy = null
  return true
}
