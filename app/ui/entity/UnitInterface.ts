import { MENU_INFO_IDS, UNIT_TYPES } from '../../constants'
import { getIconPath } from '../../lib'
import {
  getHeroInventoryWeaponCombatStats,
  getUnitCombatRange,
  getUnitRuntimeCombatStats,
  hasHeroInventoryEquipment,
} from '../../lib/equipment/equipmentStats'
import type { EquipmentCombatStats } from '../../lib/equipment/equipmentStats'
import { t } from '../../lib/lang'
import { getUnitOverallLevel } from '../../lib/units/unitExperience'
import { appendBaseEntityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
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

    const level = createInfoText('unit-level-tag', `${t('levelShort')} ${getUnitOverallLevel(unit)}`)
    level.classList.add('level-tag')
    if (options?.hideIdentity) element.appendChild(level)
    else {
      const name = element.querySelector<HTMLElement>(`.${MENU_INFO_IDS.name}`)
      ;(name ?? element.querySelector('.entity-info-header'))?.appendChild(level)
    }

    const infosDiv = document.createElement('div')
    infosDiv.classList.add('infos')

    const infos: { key: keyof EquipmentCombatStats | string; icon: string; title: string; value: number }[] = []
    const combatStats = getUnitRuntimeCombatStats(unit, data)
    if (hasHeroInventoryEquipment(unit)) {
      const weaponStats = getHeroInventoryWeaponCombatStats(unit)
      if (weaponStats.meleeWeaponPower) {
        infos.push({
          key: 'meleeWeaponPower',
          icon: '007_50731',
          title: 'combatMeleeAttackStat',
          value: weaponStats.meleeWeaponPower,
        })
      }
      if (weaponStats.rangedWeaponPower) {
        infos.push({
          key: 'rangedWeaponPower',
          icon: '006_50731',
          title: 'combatRangedAttackStat',
          value: weaponStats.rangedWeaponPower,
        })
      }
    } else if (combatStats.weaponPower) {
      infos.push({
        key: 'weaponPower',
        icon: getUnitCombatRange(unit) != null ? '006_50731' : '007_50731',
        title: 'combatAttackStat',
        value: combatStats.weaponPower,
      })
    }
    if (combatStats.meleeArmor) {
      infos.push({ key: 'meleeArmor', icon: '008_50731', title: 'combatMeleeArmorStat', value: combatStats.meleeArmor })
    }
    if (combatStats.pierceArmor) {
      infos.push({
        key: 'pierceArmor',
        icon: '010_50731',
        title: 'combatPierceArmorStat',
        value: combatStats.pierceArmor,
      })
    }

    for (let i = 0; i < infos.length; i++) {
      const info = infos[i]
      const infoDiv = document.createElement('div')
      infoDiv.classList.add('info')
      infoDiv.setAttribute('aria-label', t(info.title))

      infoDiv.appendChild(createInfoImage('', getIconPath(info.icon)))
      infoDiv.appendChild(createInfoText(String(info.key), info.value))
      infosDiv.appendChild(infoDiv)
    }

    element.appendChild(infosDiv)
  }
}
