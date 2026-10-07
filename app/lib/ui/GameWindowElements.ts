import { t } from '../lang'
import { getWindowField } from './GameWindowForms'

const WINDOW_ROW = '.inventory-action-row'
const GLOBAL_ACTION = '[data-window-action], .entity-delete-building-button'
export const WINDOW_ITEMS = `${WINDOW_ROW}, button, input:not([type=hidden]), textarea, select:not([hidden]), [data-window-field], [role="button"]`
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
  const identity = document.createElement('span')
  identity.className = 'game-window-detail-identity'
  const sourceAvatar = row?.querySelector<HTMLElement>(
    '.inventory-action-row-icon > .img, .hero-building-menu-icon > img'
  )
  if (sourceAvatar) {
    const avatar = document.createElement('span')
    avatar.className = 'game-window-detail-avatar'
    avatar.setAttribute('aria-hidden', 'true')
    const copy =
      sourceAvatar instanceof HTMLCanvasElement ? document.createElement('img') : sourceAvatar.cloneNode(true)
    if (sourceAvatar instanceof HTMLCanvasElement && copy instanceof HTMLImageElement) {
      copy.src = sourceAvatar.toDataURL()
      copy.alt = ''
    }
    avatar.appendChild(copy)
    content.appendChild(avatar)
  }
  const append = (element: HTMLElement): void => {
    if (!element.textContent?.trim()) return
    const part = document.createElement('span')
    part.className = 'game-window-detail-line'
    for (const [source, target] of [
      ['inventory-action-row-label', 'title'],
      ['inventory-action-row-description', 'description'],
      ['inventory-action-row-value', 'value'],
    ]) {
      if (element.classList.contains(source)) part.classList.add(`game-window-detail-${target}`)
    }
    if (element.classList.contains('value-badge')) {
      part.classList.add('value-badge', 'value-badge--gold')
      part.setAttribute('aria-label', element.getAttribute('aria-label') ?? '')
      part.title = element.title
      if (row?.matches('.market-buy-slot') && row.querySelector('.inventory-row-action-button:disabled')) {
        part.classList.add('value-badge--unavailable')
      }
    }
    // Keep resource status spans without copying the source row's layout classes.
    for (const child of element.childNodes) part.appendChild(child.cloneNode(true))
    if (element.classList.contains('inventory-cost-is-missing')) part.classList.add('inventory-cost-is-missing')
    const isIdentity =
      part.classList.contains('game-window-detail-title') || part.classList.contains('game-window-detail-value')
    const host = isIdentity ? identity : content
    host.appendChild(part)
  }
  row?.querySelectorAll<HTMLElement>(DETAIL_PARTS).forEach(append)
  const durability = row?.dataset.equipmentDurability
  if (durability != null && Number.isFinite(Number(durability))) {
    const value = Math.max(0, Math.min(100, Number(durability)))
    const bar = document.createElement('span')
    bar.className = 'game-window-detail-durability ui-progress'
    bar.setAttribute('role', 'progressbar')
    bar.setAttribute('aria-label', t('equipmentCondition', { value }))
    bar.setAttribute('aria-valuemin', '0')
    bar.setAttribute('aria-valuemax', '100')
    bar.setAttribute('aria-valuenow', String(value))
    bar.style.setProperty('--equipment-durability-percent', `${value}%`)
    bar.textContent = `${value}/100`
    identity.insertBefore(bar, identity.querySelector('.game-window-detail-value'))
  }
  if (identity.childElementCount) content.appendChild(identity)
  const stats = row?.querySelector('.inventory-action-row-stats')
  if (row?.dataset.itemCategory || stats) {
    const category = document.createElement('span')
    category.className = 'game-window-detail-category'
    const label = document.createElement('span')
    label.textContent = row?.dataset.itemCategory ?? ''
    category.appendChild(label)
    if (stats) category.appendChild(stats.cloneNode(true))
    content.appendChild(category)
  }
  details.hidden = !content.textContent
  if (details.innerHTML !== content.innerHTML) details.replaceChildren(...content.childNodes)
}
