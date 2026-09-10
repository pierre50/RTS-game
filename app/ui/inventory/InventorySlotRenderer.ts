type InventorySectionOptions = {
  className?: string
  emptyText?: string
  gridClassName?: string
  title: string
  titleClassName?: string
  renderItems: (grid: HTMLDivElement) => void
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
