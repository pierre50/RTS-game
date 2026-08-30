import { BUILDING_TYPES, MENU_INFO_IDS, POPULATION_MAX } from '../../constants'
import { getIconPath } from '../../lib'
import { HORSE_COLOR_PALETTES, isHorseColor } from '../../lib/horses/horseColors'
import { t } from '../../lib/lang'
import { getStableHorseAmount, getStableHorses, STABLE_HORSE_CAPACITY } from '../../lib/horses/stableHorses'
import { appendBaseEntityInfo, appendQuantityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import { getBuildingDisplayName } from '../utils/entityDisplayName'
import type { BuildingEntity, EntityInfoRenderOptions } from '../../types/entities'
import type { BuildingConfig } from '../../types/config'
import type { MenuLike } from '../../types/context'

export class BuildingInterface {
  building: BuildingEntity

  constructor(building: BuildingEntity) {
    this.building = building
  }

  renderInfo(element: HTMLElement, data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    const building = this.building
    this.setDefaultInterface(element, data, options)
    if (building.displayPopulation && building.owner?.isPlayed && building.isBuilt) {
      element.appendChild(this.getPopulationElement())
    }
    if (building.type === BUILDING_TYPES.stable && building.isBuilt) {
      element.appendChild(this.getStableHorseElement())
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

  getStableHorseElement(): HTMLDivElement {
    const building = this.building
    const horses = getStableHorses(building)
    const horseDiv = document.createElement('div')
    horseDiv.className = 'stable-horses'

    const count = document.createElement('div')
    count.className = 'stable-horses-count'
    count.textContent = `${t('stableHorses')} ${getStableHorseAmount(building)}/${STABLE_HORSE_CAPACITY}`
    horseDiv.appendChild(count)

    const avatars = document.createElement('div')
    avatars.className = 'stable-horse-avatars'
    for (let index = 0; index < STABLE_HORSE_CAPACITY; index++) {
      const horse = horses[index]
      const color = isHorseColor(horse?.horseColor) ? horse.horseColor : null
      const avatar = document.createElement('div')
      avatar.className = `stable-horse-avatar${color ? ' filled' : ''}`
      avatar.title = color ? t(`horseColor_${color}`) : ''
      if (color) {
        avatar.style.setProperty('--stable-horse-color', `#${HORSE_COLOR_PALETTES[color][1].toString(16).padStart(6, '0')}`)
        avatar.style.setProperty('--stable-horse-shadow', `#${HORSE_COLOR_PALETTES[color][4].toString(16).padStart(6, '0')}`)
      }
      avatars.appendChild(avatar)
    }
    horseDiv.appendChild(avatars)
    return horseDiv
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

  setDefaultInterface(element: HTMLElement, _data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    const building = this.building
    const menu = (building.context as { menu: MenuLike }).menu
    appendBaseEntityInfo(
      element,
      t(building.owner!.civ || ''),
      getBuildingDisplayName(building),
      building.hitPoints,
      building.totalHitPoints,
      {
        hideType: options?.hideIdentity,
      }
    )

    if (building.owner?.isPlayed && building.isBuilt && building.quantity) {
      appendQuantityInfo(element, menu.icons!['food'], building.quantity)
    }
  }
}
