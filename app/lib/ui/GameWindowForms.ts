import { t } from '../lang'

const CHOICE = '[data-window-field]'
type Field = HTMLInputElement | HTMLSelectElement

export function getWindowField(element: HTMLElement | null): Field | null {
  if (element?.matches('input, select')) return element as Field
  return element?.matches(CHOICE) ? element.querySelector<HTMLSelectElement>('select') : null
}

function stepRangeValue(value: number, min: number, max: number, step: number, direction: number): number {
  if (!Number.isFinite(step) || step <= 0) step = 1
  const next = min + (Math.round((value - min) / step) + direction) * step
  return Math.max(min, Math.min(max, Number(next.toFixed(8))))
}

function nextOption(select: HTMLSelectElement, direction: number): number {
  for (let index = select.selectedIndex + direction; index >= 0 && index < select.options.length; index += direction) {
    if (!select.options[index].disabled && !select.options[index].hidden) return index
  }
  return select.selectedIndex
}

export function canAdjustWindowField(element: HTMLElement | null, direction: number): boolean {
  const field = getWindowField(element)
  if (!field || field.disabled) return false
  if (field instanceof HTMLSelectElement) return nextOption(field, direction) !== field.selectedIndex
  if (field.type === 'checkbox') return true
  if (field.type !== 'range') return false
  return direction < 0 ? Number(field.value) > Number(field.min || 0) : Number(field.value) < Number(field.max || 100)
}

export function adjustWindowField(element: HTMLElement | null, direction: number): void {
  const field = getWindowField(element)
  if (!field || !canAdjustWindowField(element, direction)) return
  if (field instanceof HTMLSelectElement) {
    field.selectedIndex = nextOption(field, direction)
    field.dispatchEvent(new Event('change', { bubbles: true }))
  } else if (field.type === 'checkbox') {
    field.click()
  } else {
    field.value = String(
      stepRangeValue(
        Number(field.value),
        Number(field.min || 0),
        Number(field.max || 100),
        Number(field.step || 1),
        direction
      )
    )
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

/** Enhance native fields without changing the callbacks that own their values. */
export function enhanceWindowForms(panel: HTMLElement): void {
  for (const select of panel.querySelectorAll<HTMLSelectElement>('select:not([multiple])')) {
    let choice = select.closest<HTMLElement>(CHOICE)
    if (!choice) {
      choice = document.createElement('div')
      choice.className = 'window-choice'
      choice.setAttribute('data-window-field', 'choice')
      choice.tabIndex = 0
      choice.setAttribute('role', 'spinbutton')
      const label =
        select.closest('.config-row')?.querySelector('label')?.textContent || select.getAttribute('aria-label') || ''
      choice.setAttribute('aria-label', label)
      select.before(choice)
      select.hidden = true
      select.tabIndex = -1
      choice.appendChild(select)
      for (const direction of [-1, 1]) {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'window-choice-arrow'
        button.textContent = direction < 0 ? '‹' : '›'
        button.tabIndex = -1
        button.setAttribute('aria-label', t(direction < 0 ? 'windowPreviousValue' : 'windowNextValue', { name: label }))
        button.addEventListener('click', () => adjustWindowField(choice, direction))
        choice.appendChild(button)
        if (direction < 0) {
          const value = document.createElement('span')
          value.className = 'window-choice-value'
          choice.appendChild(value)
        }
      }
    }
    const label = select.options[select.selectedIndex]?.textContent ?? ''
    const value = choice.querySelector('.window-choice-value')!
    if (value.textContent !== label) value.textContent = label
    choice.setAttribute('aria-valuetext', label)
    choice.setAttribute('aria-valuenow', String(Math.max(0, select.selectedIndex)))
    choice.setAttribute('aria-valuemin', '0')
    choice.setAttribute('aria-valuemax', String(Math.max(0, select.options.length - 1)))
    choice.setAttribute('aria-disabled', String(select.disabled))
    choice.querySelectorAll<HTMLButtonElement>('button').forEach((button, index) => {
      const disabled = !canAdjustWindowField(choice, index === 0 ? -1 : 1)
      if (button.disabled !== disabled) button.disabled = disabled
    })
  }
  for (const input of panel.querySelectorAll<HTMLInputElement>('input')) {
    const label = input.closest('.config-row')?.querySelector('label')?.textContent
    if (label && !input.hasAttribute('aria-label')) input.setAttribute('aria-label', label)
    if (input.type !== 'range') continue
    let value = input.nextElementSibling
    if (!value?.classList.contains('window-range-value')) {
      value = document.createElement('output')
      value.className = 'window-range-value'
      input.after(value)
    }
    const text = Number(input.max) <= 2 ? `${Math.round(Number(input.value) * 100)}%` : input.value
    if (value.textContent !== text) value.textContent = text
  }
}
