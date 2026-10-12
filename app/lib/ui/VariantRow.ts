import { t } from '../lang'

type VariantRow = {
  canStep(direction: number): boolean
  step(direction: number): void
}
const variants = new WeakMap<HTMLElement, VariantRow>()

/** Add a bounded variant selector while keeping the whole row as one navigation stop. */
export function attachVariantRow(
  row: HTMLElement,
  options: { index: number; count: number; onChange(index: number): void }
): void {
  row.classList.add('ui-variant-row')
  if (!variants.has(row)) row.tabIndex = -1
  const variant: VariantRow = {
    canStep: direction => options.index + direction >= 0 && options.index + direction < options.count,
    step: direction => {
      if (variant.canStep(direction)) options.onChange(options.index + direction)
    },
  }
  variants.set(row, variant)
  for (const direction of [-1, 1]) {
    const arrow = document.createElement('button')
    arrow.type = 'button'
    arrow.className = `ui-variant-arrow ui-variant-arrow--${direction < 0 ? 'previous' : 'next'}`
    arrow.textContent = direction < 0 ? '‹' : '›'
    arrow.tabIndex = -1
    arrow.disabled = !variant.canStep(direction)
    arrow.setAttribute('aria-label', t(direction < 0 ? 'windowPreviousValue' : 'windowNextValue', { name: row.title }))
    arrow.addEventListener('click', event => {
      event.preventDefault()
      row.focus({ preventScroll: true })
      variant.step(direction)
    })
    row.appendChild(arrow)
  }
}

export function getVariantRow(row: HTMLElement | null): VariantRow | undefined {
  return row ? variants.get(row) : undefined
}
