/** The right stick reads long details without moving selection or executing actions. */
export function scrollWindowInformation(panel: HTMLElement, amount: number, selected?: HTMLElement | null): boolean {
  if (!amount) return false
  const candidates = panel.querySelectorAll<HTMLElement>(
    '.game-window-details, .quest-details, .modal-tab-page, .hero-building-menu-body, .interaction-panel-content, .quest-journal'
  )
  const selectedList = selected?.closest<HTMLElement>('.inventory-section-list, .hero-building-menu-body')
  for (const element of [...(selectedList ? [selectedList] : []), ...candidates]) {
    if (element.closest('[hidden], .hidden, [aria-hidden="true"]') || !element.getClientRects().length) continue
    if (element.scrollHeight <= element.clientHeight + 1) continue
    const before = element.scrollTop
    element.scrollTop += amount
    if (element.scrollTop !== before) return true
  }
  return false
}
