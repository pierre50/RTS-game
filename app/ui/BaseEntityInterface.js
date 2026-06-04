import { MENU_INFO_IDS } from '../constants'

export function createInfoImage(className, src) {
  const img = document.createElement('img')
  img.className = className
  img.src = src
  return img
}

export function createInfoText(className, text) {
  const div = document.createElement('div')
  div.classList.add(className)
  div.textContent = text
  return div
}

function parseHitPoints(value, totalHitPoints) {
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

export function syncHitPointsInfo(element, value, totalHitPoints) {
  const { current, max } = parseHitPoints(value, totalHitPoints)
  const safeMax = Math.max(0, max)
  const safeCurrent = Math.max(0, Math.min(current, safeMax || current))
  const ratio = safeMax > 0 ? safeCurrent / safeMax : 0

  element.textContent = `${safeCurrent}/${safeMax}`

  const fill =
    element.closest('.hit-points-display')?.querySelector('.hit-points-fill') ||
    element._hitPointsFill ||
    null
  if (fill) {
    fill.style.width = `${Math.round(ratio * 100)}%`
  }
}

export function createHitPointsInfo(className, hitPoints, totalHitPoints) {
  const wrapper = document.createElement('div')
  wrapper.className = 'hit-points-display'

  const bar = document.createElement('div')
  bar.className = 'hit-points-bar'

  const fill = document.createElement('div')
  fill.className = 'hit-points-fill'
  bar.appendChild(fill)

  const text = createInfoText(className, '')
  text._hitPointsFill = fill
  syncHitPointsInfo(text, hitPoints, totalHitPoints)

  wrapper.appendChild(bar)
  wrapper.appendChild(text)
  return wrapper
}

export function appendQuantityInfo(element, iconSrc, quantity) {
  const quantityDiv = document.createElement('div')
  quantityDiv.classList.add(MENU_INFO_IDS.quantity)
  quantityDiv.className = 'resource-quantity'
  quantityDiv.appendChild(createInfoImage('resource-quantity-icon', iconSrc))
  quantityDiv.appendChild(createInfoText(MENU_INFO_IDS.quantityText, quantity))
  element.appendChild(quantityDiv)
}

export function appendIconValueInfo(element, containerClass, iconSrc, textClass, text) {
  const wrapper = document.createElement('div')
  wrapper.classList.add(containerClass)
  wrapper.appendChild(createInfoImage('', iconSrc))
  wrapper.appendChild(createInfoText(textClass, text))
  element.appendChild(wrapper)
}

export function appendBaseEntityInfo(element, civText, typeText, iconSrc, hitPoints, totalHitPoints) {
  element.appendChild(createInfoText(MENU_INFO_IDS.civ, civText))
  element.appendChild(createInfoText(MENU_INFO_IDS.type, typeText))
  element.appendChild(createInfoImage(MENU_INFO_IDS.icon, iconSrc))

  if (hitPoints !== undefined)
    element.appendChild(createHitPointsInfo(MENU_INFO_IDS.hitPoints, hitPoints, totalHitPoints))
}
