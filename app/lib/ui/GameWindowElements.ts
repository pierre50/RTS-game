import { getWindowField } from './GameWindowForms'

const WINDOW_ROW = '.inventory-action-row'
const GLOBAL_ACTION = '[data-window-action], .entity-delete-building-button'
export const WINDOW_ITEMS = `${WINDOW_ROW}, button, input:not([type=hidden]), select:not([hidden]), [data-window-field], [role="button"]`
const DETAIL_PARTS =
  '.inventory-action-row-label, .inventory-action-row-description, .inventory-action-row-meta, .inventory-action-row-value, .inventory-action-row-badge, .hero-building-menu-meta'

/** Footer, detail panel, close buttons and row-local actions are never navigation stops. */
export function isWindowItemCandidate(element: HTMLElement, footer: HTMLElement, details: HTMLElement): boolean {
  return (
    !footer.contains(element) &&
    !details.contains(element) &&
    !element.matches('.window-choice-arrow') &&
    !element.closest('.inventory-row-actions') &&
    !element.matches(GLOBAL_ACTION)
  )
}

/** Keeps the selection across re-renders: same node, then same id, then the same position. */
export function findRetainedWindowItem(
  items: HTMLElement[],
  selected: HTMLElement | null,
  selectedId: string,
  selectedIndex: number
): HTMLElement | null {
  return (
    items.find(item => item === selected) ??
    items.find(item => selectedId && item.id === selectedId) ??
    items[Math.min(selectedIndex, items.length - 1)] ??
    null
  )
}

export function getWindowItemForTarget(target: HTMLElement): HTMLElement {
  return target.closest<HTMLElement>('[data-window-field]') ?? target.closest<HTMLElement>(WINDOW_ROW) ?? target
}

export function getClickedWindowRow(target: HTMLElement): HTMLElement | null {
  const row = target.closest<HTMLElement>(WINDOW_ROW)
  return row && !target.closest('.inventory-row-actions') ? row : null
}

export function isReplacedWindowSelection(
  element: HTMLElement | null,
  previous: HTMLElement | null,
  previousId: string
): boolean {
  return Boolean(element && previous && element !== previous && element.id && element.id === previousId)
}

export function lostWindowSelectionFocus(element: HTMLElement | null, previous: HTMLElement | null): boolean {
  return Boolean(element && previous && !previous.isConnected && document.activeElement === document.body)
}

export function unmarkWindowSelection(element: HTMLElement | null): void {
  element?.classList.remove('is-window-selected')
  if (element?.matches(WINDOW_ROW)) element.tabIndex = -1
}

export function markWindowSelection(element: HTMLElement): void {
  element.classList.add('is-window-selected')
  if (element.matches(WINDOW_ROW)) {
    element.tabIndex = 0
    element.setAttribute('role', 'group')
  }
}

export function hasSteppableWindowField(element: HTMLElement | null): boolean {
  const field = getWindowField(element)
  return Boolean(field && (field instanceof HTMLSelectElement || field.type === 'range' || field.type === 'checkbox'))
}

/** Fields follow their rows; a tab strip must reach content in either column. */
export function getWindowNavigationPoint(
  item: HTMLElement,
  vertical: boolean
): { x: number; y: number; left: number; right: number } {
  const verticalRow = vertical
    ? (item.closest('.config-row') ?? (item.matches('.ui-tab') ? item.closest('.ui-tabs') : null))
    : null
  const rect = (verticalRow ?? item).getBoundingClientRect()
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: rect.x, right: rect.x + rect.width }
}

/** Panel shortcuts stay within nested device tabs while the selection is inside them. */
export function getWindowTabScope(selected: HTMLElement | null, panel: HTMLElement): Element {
  return selected?.closest?.('.settings-device-tabs') ?? panel
}

export function isWindowTabInScope(tab: HTMLElement, scope: Element, panel: HTMLElement): boolean {
  return scope !== panel || !tab.closest?.('.settings-device-tabs')
}

/** Moving up onto a tab strip lands on the active tab rather than the nearest one. */
export function preferActiveWindowTab(
  items: HTMLElement[],
  next: HTMLElement | null,
  selected: HTMLElement | null
): HTMLElement | null {
  if (!next?.matches('.ui-tab') || selected?.matches('.ui-tab')) return next
  return items.find(item => item.matches('.ui-tab[aria-selected="true"]')) ?? next
}

export function renderWindowDetails(details: HTMLElement, selected: HTMLElement | null): void {
  const row = selected?.matches(
    `${WINDOW_ROW}:not(.inventory-action-row--no-icon), .hero-building-menu-body > button.ui-action-row`
  )
    ? selected
    : null
  const content = document.createElement('span')
  const marketRow = row?.matches('.market-slot')
  const arrowAvatar = marketRow
    ? null
    : row?.querySelector<HTMLElement>(
        '.inventory-arrow-icon, .inventory-action-row-icon > img, .hero-building-menu-icon > img'
      )
  if (arrowAvatar) {
    const avatar = document.createElement('span')
    avatar.className = 'game-window-detail-avatar'
    avatar.setAttribute('aria-hidden', 'true')
    avatar.appendChild(arrowAvatar.cloneNode(true))
    content.appendChild(avatar)
  }
  const append = (element: HTMLElement): void => {
    if (!element.textContent?.trim()) return
    const part = document.createElement('span')
    part.className = 'game-window-detail-line'
    if (element.classList.contains('inventory-action-row-label')) part.classList.add('game-window-detail-title')
    // Keep resource status spans without copying the source row's layout classes.
    for (const child of element.childNodes) part.appendChild(child.cloneNode(true))
    if (element.classList.contains('inventory-cost-is-missing')) part.classList.add('inventory-cost-is-missing')
    content.appendChild(part)
  }
  row
    ?.querySelectorAll<HTMLElement>(
      marketRow ? '.inventory-action-row-description, .inventory-action-row-meta' : DETAIL_PARTS
    )
    .forEach(append)
  const disabled = row?.querySelector<HTMLButtonElement>('.inventory-row-action-button:disabled[title]')
  if (disabled?.title) {
    const reason = document.createElement('span')
    reason.textContent = disabled.title
    append(reason)
  }
  details.hidden = !content.textContent
  if (details.innerHTML !== content.innerHTML) details.replaceChildren(...content.childNodes)
}
