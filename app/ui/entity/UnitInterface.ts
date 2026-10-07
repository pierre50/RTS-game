import { createValueBadge } from '../ValueBadge'
import { createCombatStatInfo, type CombatStatInfo } from './CombatStatInfo'
import { MENU_INFO_IDS, UNIT_TYPES } from '../../constants'
import {
  getHeroInventoryWeaponCombatStats,
  getUnitCombatRange,
  getUnitRuntimeCombatStats,
  hasHeroInventoryEquipment,
} from '../../lib/equipment/equipmentStats'
import { t } from '../../lib/lang'
import { getUnitOverallLevel } from '../../lib/units/unitExperience'
import { appendBaseEntityInfo, createInfoText } from './BaseEntityInterface'
import type { EntityInfoRenderOptions, UnitEntity } from '../../types/entities'
import type { UnitConfig } from '../../types/config'

export class UnitInterface {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
  }

  setDefaultInterface(element: HTMLElement, data: UnitConfig, options?: EntityInfoRenderOptions): void {
    const unit = this.unit
    const typeText = t(unit.type === UNIT_TYPES.villager ? unit.work || unit.type : unit.type)
    const showStats = !options?.hideStats
    appendBaseEntityInfo(
      element,
      t(unit.owner!.civ!),
      typeText,
      showStats ? unit.hitPoints : undefined,
      showStats ? unit.totalHitPoints : undefined,
      {
        hideType: Boolean(options?.hideIdentity && !unit.name),
      }
    )
    if (unit.name && !options?.hideIdentity) {
      const nameElement = createInfoText(MENU_INFO_IDS.name, unit.name)
      const header = element.querySelector('.entity-info-header')
      header?.prepend(nameElement)
    }

    if (!showStats) return

    const level = createValueBadge('level', `${t('levelShort')} ${getUnitOverallLevel(unit)}`)
    level.classList.add('unit-level-tag', 'level-tag')
    if (options?.hideIdentity) element.appendChild(level)
    else {
      const name = element.querySelector<HTMLElement>(`.${MENU_INFO_IDS.name}`)
      ;(name ?? element.querySelector('.entity-info-header'))?.appendChild(level)
    }

    const infosDiv = document.createElement('div')
    infosDiv.classList.add('infos')

    const infos: CombatStatInfo[] = []
    const combatStats = getUnitRuntimeCombatStats(unit, data)
    if (hasHeroInventoryEquipment(unit)) {
      const weaponStats = getHeroInventoryWeaponCombatStats(unit)
      if (weaponStats.meleeWeaponPower) {
        infos.push({
          key: 'meleeWeaponPower',
          value: weaponStats.meleeWeaponPower,
        })
      }
      if (weaponStats.rangedWeaponPower) {
        infos.push({
          key: 'rangedWeaponPower',
          value: weaponStats.rangedWeaponPower,
        })
      }
    } else if (combatStats.weaponPower) {
      infos.push({
        key: 'weaponPower',
        ranged: getUnitCombatRange(unit) != null,
        value: combatStats.weaponPower,
      })
    }
    if (combatStats.armor) {
      infos.push({ key: 'armor', value: combatStats.armor })
    }

    for (const info of infos) infosDiv.appendChild(createCombatStatInfo(info))

    element.appendChild(infosDiv)
  }
}
