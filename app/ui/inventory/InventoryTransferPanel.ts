import { RESOURCE_STORAGE_NAMES } from '../../constants'
import { formatEquipmentStackLabel } from '../../lib/equipment/equipmentLoot'
import {
  moveInventoryEquipment,
  moveInventoryResource,
  type InventoryContainer,
  type InventoryStorage,
} from '../../lib/inventory/inventoryContainers'
import { t } from '../../lib/lang'
import { createInventoryEquipmentRow, createInventoryResourceRow } from './InventoryItemRows'
import { createInventoryContents } from './InventoryContents'
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
  header?: HTMLElement
  context: GameContextLike
  destination: InventoryContainer
  isTheftTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  onChange?: () => void
  onTransfer?: (event: InventoryTransferEvent) => void
  source: InventoryContainer
  canTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  moveEquipment?: typeof moveInventoryEquipment
  moveResource?: typeof moveInventoryResource
  additionalItems?: (container: InventoryContainer) => HTMLElement[]
  visibleInventory?: (container: InventoryContainer) => InventoryStorage
  emptyText?: (container: InventoryContainer) => string
  showItemCount?: (container: InventoryContainer) => boolean
  equipmentAction?: (
    container: InventoryContainer,
    equipment: string
  ) => Parameters<typeof createInventoryEquipmentRow>[1]['secondaryAction']
}

export class InventoryTransferPanel {
  header?: HTMLElement
  context: GameContextLike
  destination: InventoryContainer
  element: HTMLDivElement
  isTheftTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  onChange?: () => void
  onTransfer?: (event: InventoryTransferEvent) => void
  source: InventoryContainer
  canTransfer?: (source: InventoryContainer, destination: InventoryContainer) => boolean
  moveEquipment: typeof moveInventoryEquipment
  additionalItems?: InventoryTransferPanelOptions['additionalItems']
  visibleInventory?: InventoryTransferPanelOptions['visibleInventory']
  emptyText?: InventoryTransferPanelOptions['emptyText']
  showItemCount?: InventoryTransferPanelOptions['showItemCount']
  equipmentAction?: InventoryTransferPanelOptions['equipmentAction']
  moveResource: typeof moveInventoryResource

  constructor(options: InventoryTransferPanelOptions) {
    this.additionalItems = options.additionalItems
    this.visibleInventory = options.visibleInventory
    this.emptyText = options.emptyText
    this.showItemCount = options.showItemCount
    this.equipmentAction = options.equipmentAction
    this.header = options.header
    this.context = options.context
    this.destination = options.destination
    this.isTheftTransfer = options.isTheftTransfer
    this.onChange = options.onChange
    this.onTransfer = options.onTransfer
    this.source = options.source
    this.canTransfer = options.canTransfer
    this.moveEquipment = options.moveEquipment ?? moveInventoryEquipment
    this.moveResource = options.moveResource ?? moveInventoryResource
    this.element = document.createElement('div')
    this.element.className = 'inventory-transfer-panel'
    this.render()
  }

  render(): void {
    this.element.replaceChildren(
      ...(this.header ? [this.header] : []),
      this.createContainerBlock(this.destination, this.source),
      this.createContainerBlock(this.source, this.destination)
    )
  }

  private createContainerBlock(container: InventoryContainer, transferTarget: InventoryContainer): HTMLElement {
    const inventory = this.visibleInventory?.(container) ?? container.inventory
    const action = this.createTransferAllButton(container, transferTarget, inventory)
    return createInventoryContents({
      action,
      inventory,
      additionalItems: this.additionalItems?.(container),
      emptyText: this.emptyText?.(container) ?? t('inventoryEmptySlot'),
      showItemCount: this.showItemCount?.(container),
      title: container.label ?? t(container.labelKey),
      renderResource: (resource, amount) => this.createResourceButton(container, transferTarget, resource, amount),
      renderEquipment: (equipment, count) => this.createEquipmentButton(container, transferTarget, equipment, count),
    })
  }

  private getTransferAction(
    container: InventoryContainer,
    transferTarget: InventoryContainer
  ): {
    allLabel: string
    ariaKey: string
    label: string
  } {
    if (this.isTheftTransfer?.(container, transferTarget)) {
      return {
        allLabel: t('inventoryStealAllAction'),
        ariaKey: 'inventoryTransferStealItem',
        label: t('heroInteractionSteal'),
      }
    }
    if (container.id === this.source.id && transferTarget.id === this.destination.id) {
      return {
        allLabel: t('inventoryPlaceAllAction'),
        ariaKey: 'inventoryTransferPlaceItem',
        label: t('inventoryPlaceAction'),
      }
    }
    return {
      allLabel: t('inventoryTakeAllAction'),
      ariaKey: 'inventoryTransferTakeItem',
      label: t('inventoryTakeAction'),
    }
  }

  private hasTransferableItems(inventory: InventoryStorage): boolean {
    const hasResource = RESOURCE_STORAGE_NAMES.some(
      resource => Math.max(0, Math.floor(inventory.resources?.[resource] ?? 0)) > 0
    )
    return hasResource || Boolean(inventory.equipment?.length)
  }

  private createTransferAllButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    inventory: InventoryStorage
  ): HTMLButtonElement | undefined {
    if (this.canTransfer?.(container, transferTarget) === false || !this.hasTransferableItems(inventory))
      return undefined
    const action = this.getTransferAction(container, transferTarget)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ui-btn inventory-transfer-all-button'
    button.textContent = action.allLabel
    button.disabled = !this.canTransferAnyItem(container, transferTarget)
    if (button.disabled) button.title = t('storageFull')
    button.addEventListener('click', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (this.canTransfer?.(container, transferTarget) === false) return
      if (!this.canTransferAnyItem(container, transferTarget)) return
      let movedCount = 0
      for (const resource of RESOURCE_STORAGE_NAMES) {
        if (this.moveResource(container, transferTarget, resource) > 0) movedCount += 1
      }
      for (const equipment of [...(container.inventory.equipment ?? [])]) {
        if (this.moveEquipment(container, transferTarget, equipment)) movedCount += 1
      }
      if (movedCount <= 0) return
      this.handleTransfer({
        amount: movedCount,
        destination: transferTarget,
        item: '*',
        kind: 'equipment',
        source: container,
      })
    })
    return button
  }

  private canTransferAnyItem(container: InventoryContainer, transferTarget: InventoryContainer): boolean {
    const hasResource = RESOURCE_STORAGE_NAMES.some(resource => {
      const available = Math.max(0, Math.floor(container.inventory.resources?.[resource] ?? 0))
      const room = transferTarget.maxAcceptableResourceAmount?.(resource) ?? Number.POSITIVE_INFINITY
      const amount = Math.min(available, Math.max(0, room))
      return amount > 0 && transferTarget.canAcceptResource?.(resource, amount) !== false
    })
    return (
      hasResource ||
      (container.inventory.equipment ?? []).some(equipment => transferTarget.canAcceptEquipment?.(equipment) !== false)
    )
  }

  private createResourceButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    resource: keyof ResourceAmount,
    amount: number
  ): HTMLElement {
    const action = this.getTransferAction(container, transferTarget)
    const full = (transferTarget.maxAcceptableResourceAmount?.(resource) ?? Number.POSITIVE_INFINITY) <= 0
    const handleAction = (mode: 'one' | 'all'): void => {
      if (this.canTransfer?.(container, transferTarget) === false) return
      const amountToMove = mode === 'one' ? 1 : amount
      const moved = this.moveResource(container, transferTarget, resource, amountToMove)
      if (moved <= 0) return
      this.handleTransfer({
        amount: moved,
        destination: transferTarget,
        item: resource,
        kind: 'resource',
        source: container,
      })
    }
    const { element } = createInventoryResourceRow({
      id: `transfer-resource-${container.id}-${resource}`,
      className: 'inventory-transfer-slot',
      resource,
      amount,

      trailingAction:
        this.canTransfer?.(container, transferTarget) === false
          ? undefined
          : {
              ariaLabel: t(action.ariaKey, { item: amount > 1 ? `${t(resource)} x${amount}` : t(resource) }),
              label: action.label,
              onAction: handleAction,
              disabled: full,
              title: full ? t('storageFull') : undefined,
            },
    })
    element.setAttribute(
      'aria-label',
      t(action.ariaKey, { item: amount > 1 ? `${t(resource)} x${amount}` : t(resource) })
    )
    return element
  }

  private createEquipmentButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer,
    equipment: string,
    count: number
  ): HTMLElement {
    const action = this.getTransferAction(container, transferTarget)
    const labelText = formatEquipmentStackLabel(equipment, count)
    const full = transferTarget.canAcceptEquipment?.(equipment) === false
    const handleAction = (mode: 'one' | 'all'): void => {
      if (this.canTransfer?.(container, transferTarget) === false) return
      const amountToMove = mode === 'one' ? 1 : count
      let moved = 0
      for (let index = 0; index < amountToMove; index++) {
        if (!this.moveEquipment(container, transferTarget, equipment)) break
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
    }
    const { element } = createInventoryEquipmentRow(this.context, {
      id: `transfer-equipment-${container.id}-${equipment}`,
      className: 'inventory-transfer-slot',
      equipment,
      count,
      labelContext: 'inventory transfer',
      secondaryAction: this.equipmentAction?.(container, equipment),

      trailingAction:
        this.canTransfer?.(container, transferTarget) === false
          ? undefined
          : {
              ariaLabel: t(action.ariaKey, { item: labelText }),
              label: action.label,
              onAction: handleAction,
              disabled: full,
              title: full ? t('storageFull') : undefined,
            },
    })
    element.setAttribute('aria-label', t(action.ariaKey, { item: labelText }))
    return element
  }

  private handleTransfer(event: InventoryTransferEvent): void {
    this.onTransfer?.(event)
    this.context.menu.refreshInventory?.()
    this.onChange?.()
    this.render()
  }
}
