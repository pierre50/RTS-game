import { WINDOW_ITEMS } from './GameWindowElements'

/** The right stick reads long details without moving selection or executing actions. */
export function scrollWindowInformation(panel: HTMLElement, amount: number, selected?: HTMLElement | null): boolean {
  if (!amount) return false
  const candidates = panel.querySelectorAll<HTMLElement>(
    '.game-window-details, .quest-details, .modal-tab-page, .hero-building-menu-body, .interaction-panel-content, .quest-journal'
  )
  const selectedList = selected
    ? (nearestScrollContainer(selected) ??
      selected.closest<HTMLElement>('.inventory-section-list, .hero-building-menu-body'))
    : null
  for (const element of [...(selectedList ? [selectedList] : []), ...candidates]) {
    if (element.closest('[hidden], .hidden, [aria-hidden="true"]') || !element.getClientRects().length) continue
    if (element.scrollHeight <= element.clientHeight + 1) continue
    const before = element.scrollTop
    element.scrollTop += amount
    if (element.scrollTop !== before) return true
  }
  return false
}

function nearestScrollContainer(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent.scrollHeight <= parent.clientHeight + 1) continue
    if (/^(auto|scroll)$/.test(getComputedStyle(parent).overflowY)) return parent
  }
  return null
}

function sharesVisualRow(element: HTMLElement, first: Element | null): boolean {
  return Boolean(first && Math.abs(element.getBoundingClientRect().top - first.getBoundingClientRect().top) <= 1)
}

/** Restore the full top padding on the first visual row, and reveal section headings. */
export function scrollWindowSelectionIntoView(element: HTMLElement): void {
  const options: ScrollIntoViewOptions = { block: 'nearest', inline: 'nearest' }
  element.scrollIntoView(options)
  const scroller = nearestScrollContainer(element)
  if (!scroller) return
  const first = [...scroller.querySelectorAll<HTMLElement>(WINDOW_ITEMS)].find(
    item =>
      item.getClientRects().length && !item.closest('.inventory-row-actions, .game-window-footer, .game-window-details')
  )
  // Compare visual rows, not DOM indexes: any column of a grid's first row qualifies.
  if (sharesVisualRow(element, first ?? null)) {
    scroller.scrollTop = 0
    return
  }
  const list = element.closest<HTMLElement>('.inventory-section-list')
  if (!list || !sharesVisualRow(element, list.firstElementChild)) return
  const heading = list.parentElement?.querySelector<HTMLElement>(
    ':scope > .inventory-section-title, :scope > .inventory-section-header'
  )
  if (heading && scroller.contains(heading)) heading.scrollIntoView(options)
}
