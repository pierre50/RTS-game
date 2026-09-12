import { RESOURCE_STORAGE_NAMES } from '../../constants'
import { getEquipmentStacks } from '../../lib/equipment/equipmentLoot'
import type { InventoryStorage } from '../../lib/inventory/inventoryContainers'
import type { ResourceAmount } from '../../types/common'
import { createInventorySection } from './InventorySlotRenderer'

const INVENTORY_STACK_LIMIT = 99

function appendStacks(grid: HTMLElement, quantity: number, render: (count: number) => HTMLElement): void {
  if (!Number.isFinite(quantity)) return
  let remaining = Math.max(0, Math.floor(quantity))
  let stackIndex = 0
  while (remaining > 0) {
    const count = Math.min(INVENTORY_STACK_LIMIT, remaining)
    const row = render(count)
    if (stackIndex > 0 && row.id) row.id = `${row.id}-stack-${stackIndex}`
    grid.appendChild(row)
    remaining -= count
    stackIndex++
  }
}

/** Shared bag contents; callers provide only the actions available for each item. */
export function createInventoryContents(options: {
  inventory: InventoryStorage
  title: string
  emptyText: string
  action?: HTMLElement
  renderResource: (resource: keyof ResourceAmount, amount: number) => HTMLElement
  renderEquipment: (equipment: string, count: number) => HTMLElement
}): HTMLElement {
  return createInventorySection({
    title: options.title,
    emptyText: options.emptyText,
    action: options.action,
    showItemCount: true,
    renderItems: grid => {
      for (const resource of RESOURCE_STORAGE_NAMES) {
        const amount = Math.max(0, Math.floor(options.inventory.resources?.[resource] ?? 0))
        appendStacks(grid, amount, count => options.renderResource(resource, count))
      }
      for (const stack of getEquipmentStacks(options.inventory.equipment ?? [])) {
        appendStacks(grid, stack.count, count => options.renderEquipment(stack.equipment, count))
      }
    },
  })
}
