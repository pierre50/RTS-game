import { LOADING_FOOD_TYPES, MENU_INFO_IDS, UNIT_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'

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
          element.appendChild(createInfoImage('unit-loading-icon', iconSrc))
          element.appendChild(createInfoText(MENU_INFO_IDS.loadingText, unit.loading))
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
    loadingDiv.classList.add(MENU_INFO_IDS.loading)

    if (unit.loading) {
      loadingDiv.appendChild(
        createInfoImage(
          'unit-loading-icon',
          menu.infoIcons[LOADING_FOOD_TYPES.includes(unit.loadingType) ? 'food' : unit.loadingType]
        )
      )
      loadingDiv.appendChild(createInfoText(MENU_INFO_IDS.loadingText, unit.loading))
    }
    return loadingDiv
  }

  setDefaultInterface(element, data) {
    const unit = this.unit
    const typeText = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type)
    appendBaseEntityInfo(element, t(unit.owner.civ), typeText, getIconPath(data.icon), unit.hitPoints, unit.totalHitPoints)

    const infosDiv = document.createElement('div')
    infosDiv.classList.add('infos')

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
        infoDiv.classList.add('info')

        infoDiv.appendChild(createInfoImage('', getIconPath(info[1])))
        infoDiv.appendChild(createInfoText(info[0], data[info[0]]))
        infosDiv.appendChild(infoDiv)
      }
    }

    element.appendChild(infosDiv)
  }
}
