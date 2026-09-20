import { RESOURCE_STORAGE_NAMES } from '../../constants'
import { formatEquipmentStackLabel } from '../../lib/equipment/equipmentLoot'
import {
  moveInventoryEquipment,
  moveInventoryResource,
  type InventoryContainer,
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
  moveResource: typeof moveInventoryResource

  constructor(options: InventoryTransferPanelOptions) {
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
    const action = this.createTransferAllButton(container, transferTarget)
    return createInventoryContents({
      action,
      inventory: container.inventory,
      emptyText: t('inventoryEmptySlot'),
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

  private hasTransferableItems(container: InventoryContainer): boolean {
    const hasResource = RESOURCE_STORAGE_NAMES.some(
      resource => Math.max(0, Math.floor(container.inventory.resources?.[resource] ?? 0)) > 0
    )
    return hasResource || Boolean(container.inventory.equipment?.length)
  }

  private createTransferAllButton(
    container: InventoryContainer,
    transferTarget: InventoryContainer
  ): HTMLButtonElement | undefined {
    if (this.canTransfer?.(container, transferTarget) === false || !this.hasTransferableItems(container))
      return undefined
    const action = this.getTransferAction(container, transferTarget)
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'ui-btn inventory-transfer-all-button'
    button.textContent = action.allLabel
    button.addEventListener('click', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (this.canTransfer?.(container, transferTarget) === false) return
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
    const { element } = createInventoryResourceRow(this.context.menu, {
      id: `transfer-resource-${container.id}-${resource}`,
      className: 'inventory-transfer-slot',
      resource,
      amount,
      playClick: false,

      trailingAction:
        this.canTransfer?.(container, transferTarget) === false
          ? undefined
          : {
              ariaLabel: t(action.ariaKey, { item: `${t(resource)} x${amount}` }),
              label: action.label,
              onAction: handleAction,
              disabled: full,
            },
    })
    element.setAttribute('aria-label', t(action.ariaKey, { item: `${t(resource)} x${amount}` }))
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
    const { element } = createInventoryEquipmentRow(this.context, this.context.menu, {
      id: `transfer-equipment-${container.id}-${equipment}`,
      className: 'inventory-transfer-slot',
      equipment,
      count,
      labelContext: 'inventory transfer',
      playClick: false,

      trailingAction:
        this.canTransfer?.(container, transferTarget) === false
          ? undefined
          : {
              ariaLabel: t(action.ariaKey, { item: labelText }),
              label: action.label,
              onAction: handleAction,
              disabled: full,
            },
    })
    element.setAttribute('aria-label', t(action.ariaKey, { item: labelText }))
    return element
  }

  private handleTransfer(event: InventoryTransferEvent): void {
    this.context.menu.playUiClick?.()
    this.onTransfer?.(event)
    this.context.menu.refreshInventory?.()
    this.onChange?.()
    this.render()
  }
}
