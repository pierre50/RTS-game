import { RESOURCE_STORAGE_NAMES } from '../../constants'
import type { ResourceAmount } from '../../types/common'

export type InventoryStorage = {
  equipment?: string[]
  resources?: ResourceAmount
}

export type InventoryContainer = {
  id: string
  inventory: InventoryStorage
  label?: string
  labelKey: string
  // Pure queries — safe to call just to decide whether to gray out a button; must not have
  // side effects (no alerts), since UI code calls them on every render, not just on click.
  canAcceptEquipment?: (equipment: string) => boolean
  canAcceptResource?: (resource: keyof ResourceAmount, amount: number) => boolean
  // Clamps a transfer to whatever room remains instead of rejecting it outright — without this,
  // a transfer bigger than the remaining room gets refused entirely and progress stalls just
  // short of the container's cap.
  maxAcceptableResourceAmount?: (resource: keyof ResourceAmount) => number
  onReceiveEquipment?: (equipment: string) => void
  onReceiveResource?: (resource: keyof ResourceAmount, amount: number) => void
  // Side-effecting — fired only on an actual rejected transfer attempt (e.g. to show a toast).
  onEquipmentRejected?: (equipment: string) => void
  onResourceRejected?: (resource: keyof ResourceAmount) => void
}

function ensureInventoryStorage(target: { inventory?: InventoryStorage | null }): InventoryStorage {
  target.inventory = target.inventory ?? {}
  target.inventory.equipment = target.inventory.equipment ?? []
  target.inventory.resources = target.inventory.resources ?? {}
  return target.inventory
}

export function createInventoryContainer(
  target: { inventory?: InventoryStorage | null },
  options: Omit<InventoryContainer, 'inventory'>
): InventoryContainer {
  return {
    ...options,
    inventory: ensureInventoryStorage(target),
  }
}

export function moveInventoryEquipment(
  source: InventoryContainer,
  destination: InventoryContainer,
  equipment: string
): boolean {
  if (!equipment) return false
  if (destination.canAcceptEquipment?.(equipment) === false) {
    destination.onEquipmentRejected?.(equipment)
    return false
  }
  const sourceEquipment = source.inventory.equipment ?? []
  const index = sourceEquipment.indexOf(equipment)
  if (index < 0) return false
  sourceEquipment.splice(index, 1)
  destination.inventory.equipment = destination.inventory.equipment ?? []
  destination.inventory.equipment.push(equipment)
  destination.onReceiveEquipment?.(equipment)
  return true
}

export function moveInventoryResource(
  source: InventoryContainer,
  destination: InventoryContainer,
  resource: keyof ResourceAmount,
  requestedAmount?: number
): number {
  if (!RESOURCE_STORAGE_NAMES.includes(resource as (typeof RESOURCE_STORAGE_NAMES)[number])) return 0
  const sourceResources = source.inventory.resources ?? {}
  const available = Math.max(0, Math.floor(sourceResources[resource] ?? 0))
  const requested = requestedAmount == null ? available : Math.min(available, Math.max(0, Math.floor(requestedAmount)))
  const room = destination.maxAcceptableResourceAmount?.(resource) ?? Number.POSITIVE_INFINITY
  const amount = Math.min(requested, Math.max(0, room))
  if (amount <= 0 || destination.canAcceptResource?.(resource, amount) === false) {
    if (requested > 0) destination.onResourceRejected?.(resource)
    return 0
  }

  sourceResources[resource] = available - amount
  if ((sourceResources[resource] ?? 0) <= 0) delete sourceResources[resource]
  destination.inventory.resources = destination.inventory.resources ?? {}
  destination.inventory.resources[resource] = (destination.inventory.resources[resource] ?? 0) + amount
  destination.onReceiveResource?.(resource, amount)
  return amount
}
