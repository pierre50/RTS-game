import { t } from '../../lib/lang'

type InventorySectionOptions = {
  action?: HTMLElement
  showItemCount?: boolean
  className?: string
  emptyText?: string
  gridClassName?: string
  title: string
  titleClassName?: string
  renderItems: (grid: HTMLDivElement) => void
}

export function createInventorySectionTitle(text: string, className?: string): HTMLDivElement {
  const title = document.createElement('div')
  title.className = ['inventory-section-title', className].filter(Boolean).join(' ')
  title.textContent = text
  return title
}

export function createInventorySection(options: InventorySectionOptions): HTMLElement {
  const block = document.createElement('section')
  block.className = ['inventory-section', options.className].filter(Boolean).join(' ')

  const grid = document.createElement('div')
  grid.className = options.gridClassName ?? 'inventory-section-list'
  options.renderItems(grid)

  const title = createInventorySectionTitle(options.title, options.titleClassName)
  if (options.action || options.showItemCount) {
    const header = document.createElement('div')
    header.className = 'inventory-section-header'
    header.appendChild(title)
    if (options.showItemCount) {
      const count = document.createElement('span')
      count.className = 'inventory-section-count'
      count.textContent = t(grid.childElementCount === 1 ? 'inventoryItemCountOne' : 'inventoryItemCount', {
        count: grid.childElementCount,
      })
      header.appendChild(count)
    }
    if (options.action) header.appendChild(options.action)
    block.appendChild(header)
  } else {
    block.appendChild(title)
  }

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
