import { t } from '../lang'

const CRITICAL_DURABILITY_PERCENT = 25

/** Both inventory tiles and details share the same condition scale and warning state. */
export function createEquipmentDurabilityBar(durability: number, compact = false): HTMLElement {
  const value = Number.isFinite(durability) ? Math.max(0, Math.min(100, durability)) : 0
  const bar = document.createElement('span')
  bar.className = 'ui-durability-bar'
  bar.classList.toggle('ui-durability-bar--critical', value < CRITICAL_DURABILITY_PERCENT)
  bar.style.setProperty('--equipment-durability-percent', `${value}%`)
  if (compact) {
    bar.setAttribute('aria-hidden', 'true')
  } else {
    bar.setAttribute('role', 'progressbar')
    bar.setAttribute('aria-label', t('equipmentCondition', { value }))
    bar.setAttribute('aria-valuemin', '0')
    bar.setAttribute('aria-valuemax', '100')
    bar.setAttribute('aria-valuenow', String(value))
    bar.textContent = `${value}/100`
  }
  return bar
}
