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
  canAcceptEquipment?: (equipment: string) => boolean
  canAcceptResource?: (resource: keyof ResourceAmount, amount: number) => boolean
  onReceiveEquipment?: (equipment: string) => void
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
  if (!equipment || destination.canAcceptEquipment?.(equipment) === false) return false
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
  const amount = requestedAmount == null ? available : Math.min(available, Math.max(0, Math.floor(requestedAmount)))
  if (amount <= 0 || destination.canAcceptResource?.(resource, amount) === false) return 0

  sourceResources[resource] = available - amount
  if ((sourceResources[resource] ?? 0) <= 0) delete sourceResources[resource]
  destination.inventory.resources = destination.inventory.resources ?? {}
  destination.inventory.resources[resource] = (destination.inventory.resources[resource] ?? 0) + amount
  return amount
}
