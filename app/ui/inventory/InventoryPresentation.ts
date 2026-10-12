import { createEquipmentDurabilityBar } from '../../lib/ui/EquipmentDurabilityBar'

export type InventoryPresentation = 'items' | 'recipes' | 'market'

/** Shared presentation only; item actions and content remain owned by their callers. */
export function applyInventoryPresentation(grid: HTMLElement, presentation: InventoryPresentation): void {
  grid.className +=
    presentation === 'recipes' ? ' inventory-recipe-list' : ` inventory-tile-list inventory-tile-list--${presentation}`
}

export function createInventoryDurabilityBar(value: number): HTMLElement {
  const bar = createEquipmentDurabilityBar(value, true)
  bar.classList.add('inventory-tile-condition')
  return bar
}
