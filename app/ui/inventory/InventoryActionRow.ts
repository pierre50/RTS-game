type InventoryActionRowHost = {
  playUiClick?(): void
}

type InventoryActionMetaPart = {
  text: string
  className?: string
}

type InventoryActionRowOptions = {
  badge?: string
  metaClassName?: string
  metaParts?: InventoryActionMetaPart[]
  className?: string
  disabled?: boolean
  id: string
  title: string
  value?: string
  description?: string
  hideIcon?: boolean
  meta?: string
  playClick?: boolean
  quantity?: number
  secondaryAction?: InventoryActionRowOptions['trailingAction']
  trailingAction?: {
    ariaLabel?: string
    disabled?: boolean
    label: string
    onAction?: (mode: 'one' | 'all') => void
    onClick?: (evt: Event) => void
  }
}

export type InventoryActionRowParts = {
  element: HTMLElement
  icon: HTMLSpanElement
}

function appendInventoryQuantityBadge(host: HTMLElement, quantity: number): void {
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
  const element = document.createElement('div')
  element.id = options.id
  element.className = [
    'ui-action-row inventory-action-row',
    options.hideIcon ? 'inventory-action-row--no-icon' : '',
    options.value ? 'inventory-action-row--with-value' : '',
    options.className,
  ]
    .filter(Boolean)
    .join(' ')
  element.setAttribute('aria-label', options.title)

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
  if (options.metaClassName) meta.classList.add(options.metaClassName)
  if (options.metaParts?.length) {
    options.metaParts.forEach((part, index) => {
      if (index > 0) {
        const separator = document.createElement('span')
        separator.textContent = ' | '
        meta.appendChild(separator)
      }
      const text = document.createElement('span')
      text.className = 'inventory-action-row-meta-part'
      if (part.className) text.classList.add(part.className)
      text.textContent = part.text
      meta.appendChild(text)
    })
    if (options.meta) {
      const separator = document.createElement('span')
      separator.textContent = ' | '
      meta.appendChild(separator)
      const text = document.createElement('span')
      text.className = 'inventory-action-row-meta-part'
      text.textContent = options.meta
      meta.appendChild(text)
    }
  } else {
    meta.textContent = options.meta ?? ''
  }

  if (options.hideIcon) element.append(label, description, meta)
  else element.append(icon, label, description, meta)
  if (options.value) {
    const value = document.createElement('span')
    value.className = 'inventory-action-row-value'
    value.textContent = options.value
    element.appendChild(value)
  }
  if (options.badge) {
    const badge = document.createElement('span')
    badge.className = 'inventory-action-row-badge'
    badge.textContent = options.badge
    element.appendChild(badge)
  }
  if (options.trailingAction || options.secondaryAction) {
    const actions = document.createElement('div')
    actions.className = 'inventory-row-actions'
    for (const action of [options.secondaryAction, options.trailingAction]) {
      if (action) appendTrailingActionButton(menu, actions, { ...options, trailingAction: action })
    }
    element.appendChild(actions)
  }

  return { element, icon }
}

function appendTrailingActionButton(
  menu: InventoryActionRowHost,
  element: HTMLElement,
  options: InventoryActionRowOptions
): void {
  const action = options.trailingAction
  if (!action) return

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ui-btn inventory-row-action-button'
  button.textContent = action.label
  button.disabled = action.disabled ?? options.disabled ?? false
  button.setAttribute('aria-disabled', String(button.disabled))
  button.setAttribute('aria-label', action.ariaLabel ?? action.label)
  if (action.onAction) button.dataset.inventoryTransferSlot = 'true'
  button.addEventListener('click', evt => {
    evt.preventDefault()
    evt.stopPropagation()
    if (button.disabled) return
    if (options.playClick !== false) menu.playUiClick?.()
    if (action.onAction) {
      action.onAction(evt.shiftKey ? 'all' : 'one')
    } else {
      action.onClick?.(evt)
    }
  })
  if (action.onAction) {
    button.addEventListener('contextmenu', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (button.disabled) return
      if (options.playClick !== false) menu.playUiClick?.()
      action.onAction?.('all')
    })
    button.addEventListener('inventorytransfergamepad', evt => {
      evt.preventDefault()
      evt.stopPropagation()
      if (button.disabled) return
      if (options.playClick !== false) menu.playUiClick?.()
      action.onAction?.((evt as CustomEvent<{ mode: 'one' | 'all' }>).detail.mode)
    })
  }
  element.appendChild(button)
}
