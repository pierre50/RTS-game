import { BUILDING_TYPES, MENU_INFO_IDS, PLAYER_TYPES, POPULATION_MAX } from '../../constants'
import { getIconPath } from '../../lib'
import { HORSE_COLOR_PALETTES, isHorseColor } from '../../lib/horses/horseColors'
import { t } from '../../lib/lang'
import { getStableHorseAmount, getStableHorses, STABLE_HORSE_CAPACITY } from '../../lib/horses/stableHorses'
import { appendBaseEntityInfo, appendQuantityInfo, createInfoImage } from './BaseEntityInterface'
import { getBuildingDisplayName } from '../utils/entityDisplayName'
import type { BuildingEntity, EntityInfoRenderOptions } from '../../types/entities'
import type { BuildingConfig } from '../../types/config'
import type { MenuLike } from '../../types/context'

const DEFAULT_STORAGE_CHEST_LABEL_SUFFIX = ':default:storage-chest'

function isOwnedByHeroTeam(building: BuildingEntity): boolean {
  const heroOwner = building.context?.controls?.heroUnit?.owner
  if (!heroOwner || !building.owner) return false
  if (building.owner === heroOwner) return true
  return typeof heroOwner.team === 'number' && heroOwner.team === building.owner.team
}

function isDefaultStorageChest(building: BuildingEntity): boolean {
  return building.type === BUILDING_TYPES.chest && building.label?.endsWith(DEFAULT_STORAGE_CHEST_LABEL_SUFFIX)
}

function canHeroDeleteBuildingInfoTarget(building: BuildingEntity): boolean {
  return (
    isOwnedByHeroTeam(building) &&
    building.type !== BUILDING_TYPES.trap &&
    !isDefaultStorageChest(building) &&
    !building.indestructible &&
    !building.isDead &&
    !building.isDestroyed
  )
}

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
    if (canHeroDeleteBuildingInfoTarget(building)) {
      element.appendChild(this.getDeleteBuildingButton())
    }
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

  getDeleteBuildingButton(): HTMLButtonElement {
    const building = this.building
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'entity-delete-building-button ui-btn'
    button.textContent = t('deleteEntity')
    button.addEventListener('click', () => {
      if (building.isDead || building.isDestroyed) return
      const menu = building.context?.menu
      menu?.playUiClick?.()
      menu?.closeEntityInfoModal?.()
      menu?.closeHeroBuildingMenu?.()
      building.die?.()
    })
    return button
  }

  setDefaultInterface(element: HTMLElement, _data: BuildingConfig, options?: EntityInfoRenderOptions): void {
    const building = this.building
    const menu = (building.context as { menu: MenuLike }).menu
    const owner = building.owner!
    const factionName = owner.factionId ? building.context?.getCampaignFactions?.()?.[owner.factionId]?.name : null
    const ownerDisplayName = factionName || (owner.type === PLAYER_TYPES.bandits ? owner.name : null)
    appendBaseEntityInfo(
      element,
      ownerDisplayName || t(building.owner!.civ || ''),
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
