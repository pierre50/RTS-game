import { MENU_INFO_IDS } from '../constants'

export function appendBaseEntityInfo(element, civText, typeText, iconSrc, hitPoints, totalHitPoints) {
  const civDiv = document.createElement('div')
  civDiv.id = MENU_INFO_IDS.civ
  civDiv.textContent = civText
  element.appendChild(civDiv)

  const typeDiv = document.createElement('div')
  typeDiv.id = MENU_INFO_IDS.type
  typeDiv.textContent = typeText
  element.appendChild(typeDiv)

  const iconImg = document.createElement('img')
  iconImg.id = MENU_INFO_IDS.icon
  iconImg.src = iconSrc
  element.appendChild(iconImg)

  if (hitPoints !== undefined) {
    const hitPointsDiv = document.createElement('div')
    hitPointsDiv.id = MENU_INFO_IDS.hitPoints
    hitPointsDiv.textContent = hitPoints + '/' + totalHitPoints
    element.appendChild(hitPointsDiv)
  }
}
