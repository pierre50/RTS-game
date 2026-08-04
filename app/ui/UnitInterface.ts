import { LOADING_FOOD_TYPES, MENU_INFO_IDS, UNIT_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { getUnitEffectiveCombatStats } from '../lib/equipmentStats'
import { formatXpProgressText, getHighestUnitLevel, getUnitExperienceEntries, getXpInfoId } from '../lib/unitExperience'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import type { EntityInfoRenderOptions, UnitEntity } from '../types/entities'
import type { EquipmentStats, UnitConfig } from '../types/config'
import type { MenuLike } from '../types/context'

export class UnitInterface {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  updateLoading(): void {
    const unit = this.unit
    const menu = (unit.context as { menu: MenuLike }).menu
    if (unit.selected && unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
      if (unit.loading === 1) {
        const iconSrc = menu.infoIcons?.[LOADING_FOOD_TYPES.includes(unit.loadingType!) ? 'food' : unit.loadingType!]
        menu.updateInfo!(MENU_INFO_IDS.loading, (element: HTMLElement) => {
          element.replaceChildren()
          element.appendChild(createInfoImage('unit-loading-icon', iconSrc!))
          element.appendChild(createInfoText(MENU_INFO_IDS.loadingText, unit.loading!))
        })
      } else if (unit.loading! > 1) {
        menu.updateInfo!(MENU_INFO_IDS.loadingText, unit.loading!)
      } else {
        menu.updateInfo!(MENU_INFO_IDS.loading, (element: HTMLElement) => (element.innerHTML = ''))
      }
    }
  }

  getLoadingElement(): HTMLDivElement {
    const unit = this.unit
    const menu = (unit.context as { menu: MenuLike }).menu
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'unit-loading'
    loadingDiv.classList.add(MENU_INFO_IDS.loading)

    if (unit.loading) {
      loadingDiv.appendChild(
        createInfoImage(
          'unit-loading-icon',
          menu.infoIcons?.[LOADING_FOOD_TYPES.includes(unit.loadingType ?? '') ? 'food' : (unit.loadingType ?? '')] ??
            ''
        )
      )
      loadingDiv.appendChild(createInfoText(MENU_INFO_IDS.loadingText, unit.loading))
    }
    return loadingDiv
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions): void {
    const unit = this.unit
    const typeText = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type)
    appendBaseEntityInfo(element, t(unit.owner!.civ!), typeText, unit.hitPoints, unit.totalHitPoints)
    if (unit.name) {
      const nameElement = createInfoText(MENU_INFO_IDS.name, unit.name)
      const typeElement = element.querySelector(`.${MENU_INFO_IDS.type}`)
      element.insertBefore(nameElement, typeElement)
    }

    // A single glanceable level (the best of the 9 per-skill levels below), always shown —
    // the per-category rows only list categories with XP (or all of them with showAllXp), so
    // neither view alone gives an immediate answer to "what level is this unit."
    element.appendChild(createInfoText('unit-level', `${t('unitLevelLabel')} ${getHighestUnitLevel(unit)}`))

    const infosDiv = document.createElement('div')
    infosDiv.classList.add('infos')

    const infos: [keyof EquipmentStats, string][] = [
      ['meleeAttack', '007_50731'],
      ['pierceAttack', '006_50731'],
      ['meleeArmor', '008_50731'],
      ['pierceArmor', '010_50731'],
    ]
    const combatStats = getUnitEffectiveCombatStats(unit.type, data, unit.work)

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const value = combatStats[info[0]]
      if (value) {
        const infoDiv = document.createElement('div')
        infoDiv.classList.add('info')

        infoDiv.appendChild(createInfoImage('', getIconPath(info[1])))
        infoDiv.appendChild(createInfoText(String(info[0]), value))
        infosDiv.appendChild(infoDiv)
      }
    }

    element.appendChild(infosDiv)

    const xpEntries = getUnitExperienceEntries(unit, { includeZero: options?.showAllXp })
    if (xpEntries.length) {
      const xpDiv = document.createElement('div')
      xpDiv.classList.add('unit-xp')
      for (const entry of xpEntries) {
        const row = document.createElement('div')
        row.classList.add('info')
        const labelKey = `xp${entry.category.charAt(0).toUpperCase()}${entry.category.slice(1)}`
        row.appendChild(createInfoText('unit-xp-label', t(labelKey)))
        row.appendChild(createInfoText(getXpInfoId(entry.category), formatXpProgressText(unit, entry.category)))
        xpDiv.appendChild(row)
      }
      element.appendChild(xpDiv)
    }
  }
}
