import { LOADING_FOOD_TYPES, MENU_INFO_IDS, UNIT_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'

export class UnitInterface {
  constructor(unit) {
    this.unit = unit
  }

  updateLoading() {
    const unit = this.unit
    const {
      context: { menu },
    } = unit
    if (unit.selected && unit.owner.isPlayed && unit.owner.selectedUnit === unit) {
      if (unit.loading === 1) {
        const iconSrc = menu.infoIcons[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType]
        menu.updateInfo(MENU_INFO_IDS.loading, element => {
          element.replaceChildren()
          const iconImg = document.createElement('img')
          iconImg.className = 'unit-loading-icon'
          iconImg.src = iconSrc
          const textDiv = document.createElement('div')
          textDiv.id = MENU_INFO_IDS.loadingText
          textDiv.textContent = unit.loading
          element.appendChild(iconImg)
          element.appendChild(textDiv)
        })
      } else if (unit.loading > 1) {
        menu.updateInfo(MENU_INFO_IDS.loadingText, unit.loading)
      } else {
        menu.updateInfo(MENU_INFO_IDS.loading, element => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement() {
    const unit = this.unit
    const {
      context: { menu },
    } = unit
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'unit-loading'
    loadingDiv.id = MENU_INFO_IDS.loading

    if (unit.loading) {
      const iconImg = document.createElement('img')
      iconImg.className = 'unit-loading-icon'
      iconImg.src = menu.infoIcons[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType]
      const textDiv = document.createElement('div')
      textDiv.id = MENU_INFO_IDS.loadingText
      textDiv.textContent = unit.loading
      loadingDiv.appendChild(iconImg)
      loadingDiv.appendChild(textDiv)
    }
    return loadingDiv
  }

  setDefaultInterface(element, data) {
    const unit = this.unit
    const civDiv = document.createElement('div')
    civDiv.id = MENU_INFO_IDS.civ
    civDiv.textContent = t(unit.owner.civ)
    element.appendChild(civDiv)

    const typeDiv = document.createElement('div')
    typeDiv.id = MENU_INFO_IDS.type
    typeDiv.textContent = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type)
    element.appendChild(typeDiv)

    const iconImg = document.createElement('img')
    iconImg.id = MENU_INFO_IDS.icon
    iconImg.src = getIconPath(data.icon)
    element.appendChild(iconImg)

    const hitPointsDiv = document.createElement('div')
    hitPointsDiv.id = MENU_INFO_IDS.hitPoints
    hitPointsDiv.textContent = unit.hitPoints + '/' + unit.totalHitPoints
    element.appendChild(hitPointsDiv)

    const infosDiv = document.createElement('div')
    infosDiv.id = 'infos'

    const infos = [
      ['meleeAttack', '007_50731'],
      ['pierceAttack', '006_50731'],
      ['meleeArmor', '008_50731'],
      ['pierceArmor', '010_50731'],
    ]

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      if (data[info[0]]) {
        const infoDiv = document.createElement('div')
        infoDiv.id = 'info'

        const attackImg = document.createElement('img')
        attackImg.src = getIconPath(info[1])
        const attackDiv = document.createElement('div')
        attackDiv.id = info[0]
        attackDiv.textContent = data[info[0]]
        infoDiv.appendChild(attackImg)
        infoDiv.appendChild(attackDiv)
        infosDiv.appendChild(infoDiv)
      }
    }

    element.appendChild(infosDiv)
  }
}
