import { MENU_INFO_IDS, UNIT_TYPES } from '../constants'
import { getIconPath } from '../lib'
import { getUnitEffectiveCombatStats } from '../lib/equipmentStats'
import type { EquipmentCombatStats } from '../lib/equipmentStats'
import { getDisplayedCarriedResourceEntries } from '../lib/resourceCarry'
import {
  formatXpProgressText,
  getUnitEquipmentLevel,
  getUnitExperienceEntries,
  getUnitOverallLevel,
  getXpInfoId,
  XP_CATEGORIES,
} from '../lib/unitExperience'
import { t } from '../lib/lang'
import { appendBaseEntityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import type { EntityInfoRenderOptions, UnitEntity } from '../types/entities'
import type { UnitConfig } from '../types/config'
import type { MenuLike } from '../types/context'

const ARCHER_XP_CATEGORIES = [XP_CATEGORIES.ranged, XP_CATEGORIES.defense]
const INFANTRY_XP_CATEGORIES = [XP_CATEGORIES.melee, XP_CATEGORIES.defense]
const PRIEST_XP_CATEGORIES = [XP_CATEGORIES.healing]
const VILLAGER_HIDDEN_XP_CATEGORIES = new Set([
  XP_CATEGORIES.ranged,
  XP_CATEGORIES.melee,
  XP_CATEGORIES.defense,
  XP_CATEGORIES.healing,
])

function unitSupportsExperience(unit: UnitEntity): boolean {
  return unit.type !== UNIT_TYPES.villager
}

function getFocusedXpCategories(unit: UnitEntity, data: UnitConfig): string[] | null {
  if (unit.type === UNIT_TYPES.priest) return PRIEST_XP_CATEGORIES
  if (data.category === 'Archer') return ARCHER_XP_CATEGORIES
  if (data.category === 'Fantassin') return INFANTRY_XP_CATEGORIES
  return null
}

function shouldShowGenericXpCategory(unit: UnitEntity, category: string): boolean {
  if (category === XP_CATEGORIES.healing && unit.type !== UNIT_TYPES.priest) return false
  return unit.type !== UNIT_TYPES.villager || !VILLAGER_HIDDEN_XP_CATEGORIES.has(category)
}

function renderLoadingEntries(element: HTMLElement, unit: UnitEntity, menu: MenuLike): void {
  element.replaceChildren()
  for (const [resourceKey, amount] of getDisplayedCarriedResourceEntries(unit)) {
    const item = document.createElement('div')
    item.className = 'unit-loading-item'
    item.appendChild(createInfoImage('unit-loading-icon', menu.infoIcons?.[resourceKey] ?? ''))
    item.appendChild(createInfoText(MENU_INFO_IDS.loadingText, amount))
    element.appendChild(item)
  }
}

export class UnitInterface {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  updateLoading(): void {
    const unit = this.unit
    const menu = (unit.context as { menu: MenuLike }).menu
    if (unit.selected && unit.owner?.isPlayed && unit.owner.selectedUnit === unit) {
      menu.updateInfo!(MENU_INFO_IDS.loading, (element: HTMLElement) => renderLoadingEntries(element, unit, menu))
    }
  }

  getLoadingElement(): HTMLDivElement {
    const unit = this.unit
    const menu = (unit.context as { menu: MenuLike }).menu
    const loadingDiv = document.createElement('div')
    loadingDiv.className = 'unit-loading'
    loadingDiv.classList.add(MENU_INFO_IDS.loading)
    renderLoadingEntries(loadingDiv, unit, menu)
    return loadingDiv
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions): void {
    const unit = this.unit
    const typeText = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type)
    const showExperience = unitSupportsExperience(unit)
    appendBaseEntityInfo(element, t(unit.owner!.civ!), typeText, unit.hitPoints, unit.totalHitPoints, {
      hideType: Boolean(options?.hideIdentity && !unit.name),
    })
    if (unit.name && !options?.hideIdentity) {
      const nameElement = createInfoText(MENU_INFO_IDS.name, unit.name)
      const header = element.querySelector('.entity-info-header')
      header?.prepend(nameElement)
    }

    if (showExperience) {
      // A single glanceable global level, then per-category rows that explain where
      // that level came from.
      element.appendChild(createInfoText('unit-level', `${t('unitLevelLabel')} ${getUnitOverallLevel(unit)}`))
    }

    const infosDiv = document.createElement('div')
    infosDiv.classList.add('infos')

    const infos: [keyof EquipmentCombatStats, string, string][] = [
      ['weaponPower', '007_50731', 'combatAttackStat'],
      ['meleeArmor', '008_50731', 'combatMeleeArmorStat'],
      ['pierceArmor', '010_50731', 'combatPierceArmorStat'],
    ]
    const combatStats = getUnitEffectiveCombatStats(
      unit.type,
      data,
      unit.work,
      unit.owner?.age,
      getUnitEquipmentLevel(unit, data.category),
      unit.owner?.civ
    )

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const value = combatStats[info[0]]
      if (!value) continue
      const infoDiv = document.createElement('div')
      infoDiv.classList.add('info')
      infoDiv.title = t(info[2])

      infoDiv.appendChild(createInfoImage('', getIconPath(info[1])))
      infoDiv.appendChild(createInfoText(String(info[0]), value))
      infosDiv.appendChild(infoDiv)
    }

    element.appendChild(infosDiv)

    const focusedXpCategories = showExperience ? getFocusedXpCategories(unit, data) : null
    const xpEntries = showExperience
      ? focusedXpCategories
      ? focusedXpCategories.map(category => ({
          category,
          ...getUnitExperienceEntries(unit, { includeZero: true }).find(entry => entry.category === category),
        }))
      : getUnitExperienceEntries(unit, { includeZero: options?.showAllXp }).filter(
          entry => shouldShowGenericXpCategory(unit, entry.category)
        )
      : []
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
