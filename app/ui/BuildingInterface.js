import { MENU_INFO_IDS, POPULATION_MAX } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendBaseEntityInfo } from './BaseEntityInterface'

export class BuildingInterface {
  constructor(building) {
    this.building = building
  }

  renderInfo(element, data) {
    const building = this.building
    this.setDefaultInterface(element, data)
    if (building.displayPopulation && building.owner.isPlayed && building.isBuilt) {
      element.appendChild(this.getPopulationElement())
    }
    element.appendChild(this.getLoadingElement())
  }

  getPopulationElement() {
    const building = this.building
    const populationDiv = document.createElement('div')
    populationDiv.classList.add(MENU_INFO_IDS.population)

    const populationIcon = document.createElement('img')
    const populationSpan = document.createElement('span')
    populationSpan.classList.add(MENU_INFO_IDS.populationText)
    populationSpan.textContent =
      building.owner.population + '/' + Math.min(POPULATION_MAX, building.owner.population_max)

    populationIcon.src = getIconPath('004_50731')
    populationDiv.appendChild(populationIcon)
    populationDiv.appendChild(populationSpan)
    return populationDiv
  }

  updateLoading() {
    const building = this.building
    const {
      context: { menu },
    } = building
    if (building.owner.isPlayed && building.owner.selectedBuilding === building) {
      if (building.loading === 10) {
        menu.updateInfo(MENU_INFO_IDS.loading, element => (element.innerHTML = this.getLoadingElement().innerHTML))
      } else if (building.loading > 10) {
        menu.updateInfo(MENU_INFO_IDS.loadingText, building.loading + '%')
      } else {
        menu.updateInfo(MENU_INFO_IDS.loading, element => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement() {
    const building = this.building
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'building-loading'
    loadingDiv.classList.add(MENU_INFO_IDS.loading)

    if (building.loading && building.owner.isPlayed) {
      const iconImg = document.createElement('img')
      iconImg.className = 'building-loading-icon'
      iconImg.src = getIconPath('009_50731')
      const textDiv = document.createElement('div')
      textDiv.classList.add(MENU_INFO_IDS.loadingText)
      textDiv.textContent = building.loading + '%'
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  setDefaultInterface(element, data) {
    const building = this.building
    const { context: { menu } } = building
    const hitPoints = building.owner?.isPlayed ? building.hitPoints : undefined

    appendBaseEntityInfo(element, t(building.owner.civ), t(building.type), getIconPath(data.icon), hitPoints, building.totalHitPoints)

    if (building.owner?.isPlayed && building.isBuilt && building.quantity) {
      const quantityDiv = document.createElement('div')
      quantityDiv.classList.add(MENU_INFO_IDS.quantity)
      quantityDiv.className = 'resource-quantity'
      const smallIconImg = document.createElement('img')
      smallIconImg.src = menu.icons['food']
      smallIconImg.className = 'resource-quantity-icon'
      const textDiv = document.createElement('div')
      textDiv.classList.add(MENU_INFO_IDS.quantityText)
      textDiv.textContent = building.quantity
      quantityDiv.appendChild(smallIconImg)
      quantityDiv.appendChild(textDiv)
      element.appendChild(quantityDiv)
    }
  }
}
