const SUMMARY_PARTS =
  ':scope > .entity-info-header, :scope > .entity-description, :scope > .hit-points-display, :scope > .infos'

/** Move live identity nodes, not copies: canvases and health updates keep their owners. */
export function attachInspectionHeader(panel: HTMLElement, content: HTMLElement): () => void {
  const header = panel.querySelector<HTMLElement>('.modal-header')
  if (!header) return () => {}
  const summary = document.createElement('div')
  summary.className = 'modal-entity-summary entity-info-wrapper'
  const summaryInfo = document.createElement('div')
  summaryInfo.className = 'modal-entity-summary-info entity-info-modal selection-info active'
  let source: HTMLElement | null = null
  let avatar: HTMLElement | null = null
  let avatarOwner: HTMLElement | null = null
  header.appendChild(summary)

  const sync = (): void => {
    const info = content.matches('.entity-info-modal')
      ? content
      : content.querySelector<HTMLElement>('.entity-info-modal')
    if (info !== source) {
      if (avatar && avatarOwner) avatarOwner.appendChild(avatar)
      header.querySelector('.unit-level-tag')?.remove()
      source = info
      avatar = info?.closest('.entity-info-wrapper')?.querySelector<HTMLElement>('.unit-avatar-frame') ?? null
      avatarOwner = avatar?.parentElement ?? null
      summaryInfo.replaceChildren()
      summary.replaceChildren(...(avatar ? [avatar] : []), summaryInfo)
    }
    const level = info?.querySelector<HTMLElement>(':scope > .unit-level-tag')
    if (level) {
      header.querySelector('.unit-level-tag')?.remove()
      header.querySelector('.modal-title')?.appendChild(level)
    }
    const parts = info ? [...info.querySelectorAll<HTMLElement>(SUMMARY_PARTS)] : []
    if (parts.length) {
      summaryInfo.replaceChildren(...parts)
      const identity = summaryInfo.querySelector<HTMLElement>('.entity-info-header')
      const stats = summaryInfo.querySelector<HTMLElement>(':scope > .infos')
      if (identity && stats) identity.appendChild(stats)
    }
    const visible = Boolean(info && (avatar || summaryInfo.childElementCount))
    summary.hidden = !visible
    header.classList.toggle('modal-header--with-summary', visible)
    panel.classList.toggle('has-entity-summary', visible)
  }
  sync()
  // Screen owners can replace their info tree during live refreshes or dialogue changes.
  const observer = new MutationObserver(sync)
  observer.observe(content, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    if (avatar && avatarOwner) avatarOwner.appendChild(avatar)
  }
}
