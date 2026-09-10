type InventoryActionRowHost = {
  playUiClick?(): void
}

type InventoryActionRowOptions = {
  badge?: string
  className?: string
  disabled?: boolean
  id: string
  title: string
  description?: string
  meta?: string
  onAction?: (mode: 'one' | 'all') => void
  onClick?: (evt: Event) => void
  playClick?: boolean
  quantity?: number
}

export type InventoryActionRowParts = {
  element: HTMLButtonElement
  icon: HTMLSpanElement
}

export function appendInventoryQuantityBadge(host: HTMLElement, quantity: number): void {
  const safeQuantity = Math.max(0, Math.floor(quantity))
  if (safeQuantity <= 1) return
  host.classList.add('inventory-quantity-host')
  const badge = document.createElement('span')
  badge.className = 'inventory-quantity-badge'
  badge.textContent = `x${safeQuantity}`
  host.appendChild(badge)
}

export function appendInventoryEmptyIcon(host: HTMLElement): void {
  host.classList.add('is-empty')
  const marker = document.createElement('span')
  marker.className = 'inventory-action-row-empty-icon'
  marker.textContent = '-'
  host.appendChild(marker)
}

export function createInventoryActionRow(
  menu: InventoryActionRowHost,
  options: InventoryActionRowOptions
): InventoryActionRowParts {
  const element = document.createElement('button')
  const disabled = options.disabled ?? false
  element.type = 'button'
  element.id = options.id
  element.className = ['ui-btn ui-action-row inventory-action-row', options.className].filter(Boolean).join(' ')
  element.setAttribute('aria-disabled', String(disabled))
  element.setAttribute('aria-label', options.title)
  if (options.onAction) element.dataset.inventoryTransferSlot = 'true'

  const icon = document.createElement('span')
  icon.className = 'inventory-action-row-icon'
  appendInventoryQuantityBadge(icon, options.quantity ?? 0)

  const label = document.createElement('span')
  label.className = 'inventory-action-row-label'
  label.textContent = options.title

  const description = document.createElement('span')
  description.className = 'inventory-action-row-description'
  description.textContent = options.description ?? ''

  const meta = document.createElement('span')
  meta.className = 'inventory-action-row-meta'
  meta.textContent = options.meta ?? ''

  element.append(icon, label, description, meta)
  if (options.badge) {
    const badge = document.createElement('span')
    badge.className = 'inventory-action-row-badge'
    badge.textContent = options.badge
    element.appendChild(badge)
  }
  element.addEventListener('click', evt => {
    evt.preventDefault()
    evt.stopPropagation()
    if (element.getAttribute('aria-disabled') === 'true') return
    if (options.playClick !== false) menu.playUiClick?.()
    if (options.onAction) {
      options.onAction(evt.shiftKey ? 'all' : 'one')
    } else {
      options.onClick?.(evt)
    }
  })
  if (options.onAction) {
    element.addEventListener('contextmenu', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (element.getAttribute('aria-disabled') === 'true') return
      if (options.playClick !== false) menu.playUiClick?.()
      options.onAction?.('all')
    })
    element.addEventListener('inventorytransfergamepad', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (element.getAttribute('aria-disabled') === 'true') return
      if (options.playClick !== false) menu.playUiClick?.()
      options.onAction?.((evt as CustomEvent<{ mode: 'one' | 'all' }>).detail.mode)
    })
  }

  return { element, icon }
}
