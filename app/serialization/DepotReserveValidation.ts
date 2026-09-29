import { depotReserveResources, MAX_RESERVE_TARGET, LEGACY_MATERIAL_RESERVES } from '../lib/economy/depotReserves'
import { fail, isObject } from './SaveValidationPrimitives'

export function validateDepotReservePolicy(value: unknown, type: string): void {
  if (value == null) return
  if (
    !['StoragePit', 'Granary'].includes(type) ||
    !isObject(value) ||
    typeof value.target !== 'number' ||
    !Number.isSafeInteger(value.target) ||
    value.target < 0 ||
    value.target > MAX_RESERVE_TARGET ||
    !isObject(value.shares)
  )
    fail('Invalid depot reserve policy.')
  let sum = 0
  const keys: readonly string[] = [
    ...depotReserveResources(type),
    ...(type === 'StoragePit' ? LEGACY_MATERIAL_RESERVES : []),
  ]
  for (const [key, share] of Object.entries(value.shares)) {
    if (!keys.includes(key) || typeof share !== 'number' || !Number.isSafeInteger(share) || share < 0 || share > 100)
      fail('Invalid depot reserve share.')
    sum += share
  }
  if (sum !== 0 && sum !== 100) fail('Invalid depot reserve distribution.')
}
