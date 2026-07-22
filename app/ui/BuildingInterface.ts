import { MENU_INFO_IDS, POPULATION_MAX, BUILDING_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { getWallIcon } from '../lib/buildings/walls'
import { getTowerType, isTower } from '../lib/buildings/towers'
import { appendBaseEntityInfo, appendQuantityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import type { BuildingEntity } from '../types/entities'
import type { BuildingConfig } from '../types/config'
import type { MenuLike } from '../types/context'

export class BuildingInterface {
  building: BuildingEntity

  constructor(building: BuildingEntity) {
    this.building = building
  }

  renderInfo(element: HTMLElement, data: BuildingConfig): void {
    const building = this.building
    this.setDefaultInterface(element, data)
    if (building.displayPopulation && building.owner?.isPlayed && building.isBuilt) {
      element.appendChild(this.getPopulationElement())
    }
    element.appendChild(this.getLoadingElement())
  }

  getPopulationElement(): HTMLDivElement {
    const building = this.building
    const owner = building.owner!
    const populationDiv = document.createElement('div')
    populationDiv.classList.add(MENU_INFO_IDS.population)
    populationDiv.appendChild(createInfoImage('', getIconPath('004_50731')))
    const populationSpan = document.createElement('span')
    populationSpan.classList.add(MENU_INFO_IDS.populationText)
    populationSpan.textContent = owner.population + '/' + Math.min(POPULATION_MAX, owner.populationMax)
    populationDiv.appendChild(populationSpan)
    return populationDiv
  }

  updateLoading(): void {
    const building = this.building
    const menu = (building.context as { menu: MenuLike }).menu
    if (!building.owner?.isPlayed) return
    if (menu.getHeroBuildingMenuTarget?.() === building) {
      menu.syncHeroBuildingMenu?.()
    }
  }

  getLoadingElement(): HTMLDivElement {
    const building = this.building
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'building-loading'
    loadingDiv.classList.add(MENU_INFO_IDS.loading)

    if (building.loading !== null && building.owner?.isPlayed) {
      loadingDiv.appendChild(createInfoImage('building-loading-icon', getIconPath('009_50731')))
      loadingDiv.appendChild(createInfoText(MENU_INFO_IDS.loadingText, building.loading + '%'))
    }
    return loadingDiv
  }

  setDefaultInterface(element: HTMLElement, data: BuildingConfig): void {
    const building = this.building
    const menu = (building.context as { menu: MenuLike }).menu
    const hitPoints = building.owner?.isPlayed ? building.hitPoints : undefined

    const displayType = (isTower(building) ? getTowerType(building.owner!) : building.type) || building.type
    const icon = building.type === BUILDING_TYPES.smallWall ? getWallIcon(building.owner!, data.icon) : data.icon || ''
    appendBaseEntityInfo(
      element,
      t(building.owner!.civ || ''),
      t(displayType),
      getIconPath(icon),
      hitPoints,
      building.totalHitPoints
    )

    if (building.owner?.isPlayed && building.isBuilt && building.quantity) {
      appendQuantityInfo(element, menu.icons!['food'], building.quantity)
    }
  }
}
