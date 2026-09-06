import { RESOURCE_ICON_IDS, RESOURCE_STORAGE_NAMES } from '../../constants'
import { getIconPath } from '../../lib'
import { formatEquipmentStackLabel, getEquipmentStacks } from '../../lib/equipment/equipmentLoot'
import {
  moveInventoryEquipment,
  moveInventoryResource,
  type InventoryContainer,
} from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import { createInventorySection, createInventorySlot } from './InventorySlotRenderer'
import { createEquipmentTooltip, createResourceTooltip } from './InventoryTooltips'
import type { GameContextLike } from '../../types/context'
import type { ResourceAmount } from '../../types/common'

export type InventoryTransferEvent = {
  amount: number
  destination: InventoryContainer
  item: keyof ResourceAmount | string
  kind: 'equipment' | 'resource'
  source: InventoryContainer
}

export type InventoryTransferPanelOptions = {
  context: GameContextLike
  destination: InventoryContainer
  isTheftTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  onChange?: () => void
  onTransfer?: (event: InventoryTransferEvent) => void
  source: InventoryContainer
}

export class InventoryTransferPanel {
  context: GameContextLike
  destination: InventoryContainer
  element: HTMLDivElement
  isTheftTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  onChange?: () => void
  onTransfer?: (event: InventoryTransferEvent) => void
  source: InventoryContainer

  constructor(options: InventoryTransferPanelOptions) {
    this.context = options.context
    this.destination = options.destination
    this.isTheftTransfer = options.isTheftTransfer
    this.onChange = options.onChange
    this.onTransfer = options.onTransfer
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
    return createInventorySection({
      className: 'inventory-transfer-block',
      emptyText: t('inventoryEmptySlot'),
      gridClassName: 'inventory-loot-grid inventory-transfer-grid',
      title: container.label ?? t(container.labelKey),
      titleClassName: 'inventory-transfer-title',
      renderItems: grid => {
        this.appendResourceButtons(grid, container, transferTarget)
        this.appendEquipmentButtons(grid, container, transferTarget)
      },
    })
  }

  private appendResourceButtons(
    grid: HTMLDivElement,
    container: InventoryContainer,
    transferTarget: InventoryContainer
  ): void {
    const resources = container.inventory.resources ?? {}
    for (const resource of RESOURCE_STORAGE_NAMES) {
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
    const isTheftTransfer = this.isTheftTransfer?.(container, transferTarget) ?? false
    const icon = document.createElement('img')
    icon.className = 'inventory-resource-icon'
    icon.src = getIconPath(RESOURCE_ICON_IDS[resource].commodity)
    icon.alt = ''

    const slot = createInventorySlot({
      ariaLabel: t(isTheftTransfer ? 'inventoryTransferStealItem' : 'inventoryTransferMoveItem', {
        item: `${t(resource)} x${amount}`,
      }),
      className: ['inventory-loot-slot inventory-transfer-slot', isTheftTransfer ? 'is-theft' : '']
        .filter(Boolean)
        .join(' '),
      icon,
      label: `${t(resource)} x${amount}`,
      onAction: mode => {
        const amountToMove = mode === 'one' ? 1 : undefined
        const moved = moveInventoryResource(container, transferTarget, resource, amountToMove)
        if (moved <= 0) return
        this.handleTransfer({
          amount: moved,
          destination: transferTarget,
          item: resource,
          kind: 'resource',
          source: container,
        })
      },
    })
    this.context.menu.menuTooltip?.bind(slot, createResourceTooltip(resource, amount))
    return slot
  }

  private createEquipmentButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    equipment: string,
    count: number
  ): HTMLButtonElement {
    const isTheftTransfer = this.isTheftTransfer?.(container, transferTarget) ?? false
    const labelText = formatEquipmentStackLabel(equipment, count)

    const icon = document.createElement('canvas')
    icon.className = 'unit-avatar-frame inventory-slot-icon'
    icon.width = 64
    icon.height = 64
    renderEquipmentAvatarLazy(this.context.app, equipment, icon, 'inventory transfer', this.context.performance)

    const slot = createInventorySlot({
      ariaLabel: t(isTheftTransfer ? 'inventoryTransferStealItem' : 'inventoryTransferMoveItem', { item: labelText }),
      className: ['inventory-loot-slot inventory-transfer-slot', isTheftTransfer ? 'is-theft' : '']
        .filter(Boolean)
        .join(' '),
      icon,
      label: labelText,
      onAction: mode => {
        const amountToMove = mode === 'one' ? 1 : count
        let moved = 0
        for (let index = 0; index < amountToMove; index++) {
          if (!moveInventoryEquipment(container, transferTarget, equipment)) break
          moved++
        }
        if (moved <= 0) return
        this.handleTransfer({
          amount: moved,
          destination: transferTarget,
          item: equipment,
          kind: 'equipment',
          source: container,
        })
      },
    })
    this.context.menu.menuTooltip?.bind(slot, createEquipmentTooltip(equipment, count))
    return slot
  }

  private handleTransfer(event: InventoryTransferEvent): void {
    this.context.menu.playUiClick?.()
    this.onTransfer?.(event)
    this.context.menu.refreshInventory?.()
    this.onChange?.()
    this.render()
  }
}
