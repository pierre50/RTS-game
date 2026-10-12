/** Shared compact identity, live health and combat statistics for entity views. */
export function createEntitySummary(): { summary: HTMLDivElement; info: HTMLDivElement } {
  const summary = document.createElement('div')
  summary.className = 'entity-summary entity-info-wrapper'
  const info = document.createElement('div')
  info.className = 'entity-summary-info entity-info-modal selection-info active'
  summary.appendChild(info)
  return { summary, info }
}

export function moveEntitySummary(source: HTMLElement, target: HTMLElement): void {
  const parts = [
    ...source.querySelectorAll<HTMLElement>(
      ':scope > .entity-info-header, :scope > .hit-points-display, :scope > .infos'
    ),
  ]
  if (!parts.length) return
  target.replaceChildren(...parts)
  const identity = target.querySelector<HTMLElement>('.entity-info-header')
  const stats = target.querySelector<HTMLElement>(':scope > .infos')
  if (identity && stats) identity.appendChild(stats)
}
