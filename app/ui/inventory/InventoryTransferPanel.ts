import { RESOURCE_ICON_IDS, RESOURCE_NAMES } from '../../constants'
import { getIconPath } from '../../lib'
import { formatEquipmentStackLabel, getEquipmentStacks } from '../../lib/equipment/equipmentLoot'
import {
  moveInventoryEquipment,
  moveInventoryResource,
  type InventoryContainer,
} from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import type { GameContextLike } from '../../types/context'
import type { ResourceAmount } from '../../types/common'

export type InventoryTransferPanelOptions = {
  context: GameContextLike
  destination: InventoryContainer
  onChange?: () => void
  source: InventoryContainer
}

export class InventoryTransferPanel {
  context: GameContextLike
  destination: InventoryContainer
  element: HTMLDivElement
  onChange?: () => void
  source: InventoryContainer

  constructor(options: InventoryTransferPanelOptions) {
    this.context = options.context
    this.destination = options.destination
    this.onChange = options.onChange
    this.source = options.source
    this.element = document.createElement('div')
    this.element.className = 'inventory-transfer-panel'
    this.render()
  }

  render(): void {
    this.element.replaceChildren(
      this.createContainerBlock(this.destination, this.source),
      this.createContainerBlock(this.source, this.destination)
    )
  }

  private createContainerBlock(container: InventoryContainer, transferTarget: InventoryContainer): HTMLElement {
    const block = document.createElement('section')
    block.className = 'inventory-transfer-block'

    const title = document.createElement('div')
    title.className = 'inventory-loot-title inventory-transfer-title'
    title.textContent = t(container.labelKey)
    block.appendChild(title)

    const grid = document.createElement('div')
    grid.className = 'inventory-loot-grid inventory-transfer-grid'
    this.appendResourceButtons(grid, container, transferTarget)
    this.appendEquipmentButtons(grid, container, transferTarget)

    if (!grid.childElementCount) {
      const empty = document.createElement('div')
      empty.className = 'inventory-transfer-empty'
      empty.textContent = t('inventoryEmptySlot')
      block.appendChild(empty)
    } else {
      block.appendChild(grid)
    }

    return block
  }

  private appendResourceButtons(
    grid: HTMLDivElement,
    container: InventoryContainer,
    transferTarget: InventoryContainer
  ): void {
    const resources = container.inventory.resources ?? {}
    for (const resource of RESOURCE_NAMES) {
      const amount = Math.max(0, Math.floor(resources[resource] ?? 0))
      if (amount <= 0) continue
      grid.appendChild(this.createResourceButton(container, transferTarget, resource, amount))
    }
  }

  private appendEquipmentButtons(
    grid: HTMLDivElement,
    container: InventoryContainer,
    transferTarget: InventoryContainer
  ): void {
    for (const stack of getEquipmentStacks(container.inventory.equipment ?? [])) {
      grid.appendChild(this.createEquipmentButton(container, transferTarget, stack.equipment, stack.count))
    }
  }

  private createResourceButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    resource: keyof ResourceAmount,
    amount: number
  ): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'inventory-slot ui-btn inventory-loot-slot inventory-transfer-slot'
    button.setAttribute('aria-label', t('inventoryTransferMoveItem', { item: `${t(resource)} x${amount}` }))

    const icon = document.createElement('img')
    icon.className = 'inventory-resource-icon'
    icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
    icon.alt = ''

    const label = document.createElement('div')
    label.className = 'inventory-slot-label'
    label.textContent = `${t(resource)} x${amount}`

    button.appendChild(icon)
    button.appendChild(label)
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (moveInventoryResource(container, transferTarget, resource) <= 0) return
      this.handleTransfer()
    })
    return button
  }

  private createEquipmentButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    equipment: string,
    count: number
  ): HTMLButtonElement {
    const button = document.createElement('button')
    const labelText = formatEquipmentStackLabel(equipment, count)
    button.type = 'button'
    button.className = 'inventory-slot ui-btn inventory-loot-slot inventory-transfer-slot'
    button.setAttribute('aria-label', t('inventoryTransferMoveItem', { item: labelText }))

    const icon = document.createElement('canvas')
    icon.className = 'unit-avatar-frame inventory-slot-icon'
    icon.width = 64
    icon.height = 64
    renderEquipmentAvatarLazy(this.context.app, equipment, icon, 'inventory transfer', this.context.performance)

    const label = document.createElement('div')
    label.className = 'inventory-slot-label'
    label.textContent = labelText

    button.appendChild(icon)
    button.appendChild(label)
    button.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      if (!moveInventoryEquipment(container, transferTarget, equipment)) return
      this.handleTransfer()
    })
    return button
  }

  private handleTransfer(): void {
    this.context.menu.playUiClick?.()
    this.context.menu.refreshInventory?.()
    this.onChange?.()
    this.render()
  }
}
