import { t } from '../lang'

const CRITICAL_DURABILITY_PERCENT = 25

/** Both inventory tiles and details share the same condition scale and warning state. */
export function createEquipmentDurabilityBar(durability: number, compact = false): HTMLElement {
  const value = Number.isFinite(durability) ? Math.max(0, Math.min(100, durability)) : 0
  // Use-based wear yields fractional percentages; keep the bar precise but show whole numbers.
  const shown = Math.round(value)
  const bar = document.createElement('span')
  bar.className = 'ui-durability-bar'
  bar.classList.toggle('ui-durability-bar--critical', value < CRITICAL_DURABILITY_PERCENT)
  bar.style.setProperty('--equipment-durability-percent', `${value}%`)
  if (compact) {
    bar.setAttribute('aria-hidden', 'true')
  } else {
    bar.setAttribute('role', 'progressbar')
    bar.setAttribute('aria-label', t('equipmentCondition', { value: shown }))
    bar.setAttribute('aria-valuemin', '0')
    bar.setAttribute('aria-valuemax', '100')
    bar.setAttribute('aria-valuenow', String(shown))
    bar.textContent = `${shown}/100`
  }
  return bar
}
