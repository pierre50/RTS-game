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

  if (hitPoints !== undefined) element.appendChild(createInfoText(MENU_INFO_IDS.hitPoints, hitPoints + '/' + totalHitPoints))
}
