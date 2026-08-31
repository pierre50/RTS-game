export type InventoryItemAmountMode = 'one' | 'all'

type InventorySlotOptions = {
  ariaLabel?: string
  className?: string
  disabled?: boolean
  icon?: HTMLElement
  label: string
  onAction?: (mode: InventoryItemAmountMode) => void
}

type InventorySectionOptions = {
  className?: string
  emptyText?: string
  gridClassName?: string
  title: string
  titleClassName?: string
  renderItems: (grid: HTMLDivElement) => void
}

export function bindInventoryItemEvents(
  button: HTMLButtonElement,
  handler: (mode: InventoryItemAmountMode) => void
): void {
  button.dataset.inventoryTransferSlot = 'true'
  button.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    handler(event.shiftKey ? 'all' : 'one')
  })
  button.addEventListener('contextmenu', event => {
    event.preventDefault()
    event.stopPropagation()
    handler('all')
  })
  button.addEventListener('inventorytransfergamepad', event => {
    event.preventDefault()
    event.stopPropagation()
    handler((event as CustomEvent<{ mode: InventoryItemAmountMode }>).detail.mode)
  })
}

export function createInventorySlot(options: InventorySlotOptions): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = ['inventory-slot ui-btn', options.className].filter(Boolean).join(' ')
  button.disabled = Boolean(options.disabled)
  if (options.ariaLabel) button.setAttribute('aria-label', options.ariaLabel)
  if (options.icon) button.appendChild(options.icon)

  const label = document.createElement('div')
  label.className = 'inventory-slot-label'
  label.textContent = options.label
  button.appendChild(label)

  if (options.onAction && !button.disabled) bindInventoryItemEvents(button, options.onAction)
  return button
}

export function createInventorySection(options: InventorySectionOptions): HTMLElement {
  const block = document.createElement('section')
  block.className = ['inventory-section', options.className].filter(Boolean).join(' ')

  const title = document.createElement('div')
  title.className = ['inventory-loot-title', options.titleClassName].filter(Boolean).join(' ')
  title.textContent = options.title
  block.appendChild(title)

  const grid = document.createElement('div')
  grid.className = options.gridClassName ?? 'inventory-loot-grid'
  options.renderItems(grid)

  if (grid.childElementCount || !options.emptyText) {
    block.appendChild(grid)
  } else {
    const empty = document.createElement('div')
    empty.className = 'inventory-transfer-empty'
    empty.textContent = options.emptyText
    block.appendChild(empty)
  }

  return block
}
