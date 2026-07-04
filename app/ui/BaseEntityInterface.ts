import { MENU_INFO_IDS } from '../constants'

export function createInfoImage(className: string, src: string): HTMLImageElement {
  const img = document.createElement('img')
  img.className = className
  img.src = src
  return img
}

export function createInfoText(className: string, text: string | number): HTMLDivElement {
  const div = document.createElement('div')
  div.classList.add(className)
  div.textContent = String(text)
  return div
}

interface HitPointsFillElement extends HTMLElement {
  _hitPointsFill?: HTMLElement
}

function parseHitPoints(
  value: string | number,
  totalHitPoints: string | number
): { current: number; max: number } {
  if (typeof value === 'string') {
    const [current, max] = value.split('/').map(part => Number(part))
    if (Number.isFinite(current) && Number.isFinite(max)) {
      return { current, max }
    }
  }

  const current = Number(value)
  const max = Number(totalHitPoints)
  return {
    current: Number.isFinite(current) ? current : 0,
    max: Number.isFinite(max) ? max : 0,
  }
}

export function syncHitPointsInfo(
  element: HitPointsFillElement,
  value: string | number,
  totalHitPoints?: string | number
): void {
  const { current, max } = parseHitPoints(value, totalHitPoints ?? 0)
  const safeMax = Math.max(0, max)
  const safeCurrent = Math.max(0, Math.min(current, safeMax || current))
  const ratio = safeMax > 0 ? safeCurrent / safeMax : 0

  element.textContent = `${safeCurrent}/${safeMax}`

  const fill =
    element.closest('.hit-points-display')?.querySelector<HTMLElement>('.hit-points-fill') ||
    element._hitPointsFill ||
    null
  if (fill) {
    fill.style.width = `${Math.round(ratio * 100)}%`
  }
}

export function createHitPointsInfo(
  className: string,
  hitPoints: string | number,
  totalHitPoints: string | number
): HTMLDivElement {
  const wrapper = document.createElement('div')
  wrapper.className = 'hit-points-display'

  const bar = document.createElement('div')
  bar.className = 'hit-points-bar ui-progress'

  const fill = document.createElement('div')
  fill.className = 'hit-points-fill ui-progress__fill'
  bar.appendChild(fill)

  const text: HitPointsFillElement = createInfoText(className, '')
  text._hitPointsFill = fill
  syncHitPointsInfo(text, hitPoints, totalHitPoints)

  wrapper.appendChild(bar)
  wrapper.appendChild(text)
  return wrapper
}

export function appendQuantityInfo(element: HTMLElement, iconSrc: string, quantity: string | number): void {
  const quantityDiv = document.createElement('div')
  quantityDiv.classList.add(MENU_INFO_IDS.quantity)
  quantityDiv.className = 'resource-quantity'
  quantityDiv.appendChild(createInfoImage('resource-quantity-icon', iconSrc))
  quantityDiv.appendChild(createInfoText(MENU_INFO_IDS.quantityText, quantity))
  element.appendChild(quantityDiv)
}

export function appendIconValueInfo(
  element: HTMLElement,
  containerClass: string,
  iconSrc: string,
  textClass: string,
  text: string | number
): void {
  const wrapper = document.createElement('div')
  wrapper.classList.add(containerClass)
  wrapper.appendChild(createInfoImage('', iconSrc))
  wrapper.appendChild(createInfoText(textClass, text))
  element.appendChild(wrapper)
}

export function appendBaseEntityInfo(
  element: HTMLElement,
  civText: string,
  typeText: string,
  iconSrc: string,
  hitPoints?: string | number,
  totalHitPoints?: string | number
): void {
  element.appendChild(createInfoText(MENU_INFO_IDS.civ, civText))
  element.appendChild(createInfoText(MENU_INFO_IDS.type, typeText))
  element.appendChild(createInfoImage(MENU_INFO_IDS.icon, iconSrc))

  if (hitPoints !== undefined)
    element.appendChild(createHitPointsInfo(MENU_INFO_IDS.hitPoints, hitPoints, totalHitPoints ?? 0))
}
