import { MENU_INFO_IDS, POPULATION_MAX } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'

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
    populationDiv.id = MENU_INFO_IDS.population

    const populationIcon = document.createElement('img')
    const populationSpan = document.createElement('span')
    populationSpan.id = MENU_INFO_IDS.populationText
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
    loadingDiv.id = MENU_INFO_IDS.loading

    if (building.loading && building.owner.isPlayed) {
      const iconImg = document.createElement('img')
      iconImg.className = 'building-loading-icon'
      iconImg.src = getIconPath('009_50731')
      const textDiv = document.createElement('div')
      textDiv.id = MENU_INFO_IDS.loadingText
      textDiv.textContent = building.loading + '%'
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  setDefaultInterface(element, data) {
    const building = this.building
    const {
      context: { menu },
    } = building

    const civDiv = document.createElement('div')
    civDiv.id = MENU_INFO_IDS.civ
    civDiv.textContent = t(building.owner.civ)
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = MENU_INFO_IDS.type
    typeDiv.textContent = t(building.type)
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = MENU_INFO_IDS.icon
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    if (building.owner && building.owner.isPlayed) {
      const hitPointsDiv = document.createElement('div')
      hitPointsDiv.id = MENU_INFO_IDS.hitPoints
      hitPointsDiv.textContent = building.hitPoints + '/' + building.totalHitPoints
      element.appendChild(hitPointsDiv)

      if (building.isBuilt && building.quantity) {
        const quantityDiv = document.createElement('div')
        quantityDiv.id = MENU_INFO_IDS.quantity
        quantityDiv.className = 'resource-quantity'
        const smallIconImg = document.createElement('img')
        smallIconImg.src = menu.icons['food']
        smallIconImg.className = 'resource-quantity-icon'
        const textDiv = document.createElement('div')
        textDiv.id = MENU_INFO_IDS.quantityText
        textDiv.textContent = building.quantity
        quantityDiv.appendChild(smallIconImg)
        quantityDiv.appendChild(textDiv)
        element.appendChild(quantityDiv)
      }
    }
  }
}
