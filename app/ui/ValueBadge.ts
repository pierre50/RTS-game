export function createValueBadge(variant: 'gold' | 'level', label: string): HTMLSpanElement {
  const badge = document.createElement('span')
  badge.className = `value-badge value-badge--${variant}`
  if (variant === 'gold') updateGoldBadge(badge, label)
  else badge.textContent = label
  return badge
}

export function updateGoldBadge(badge: HTMLElement, label: string): void {
  badge.setAttribute('aria-label', label)
  badge.title = label
  badge.textContent = label
}
