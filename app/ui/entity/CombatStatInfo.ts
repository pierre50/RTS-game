import { getIconPath } from '../../lib/graphics/assets'
import { t } from '../../lib/lang'

const STAT_PRESENTATION = {
  weaponPower: ['stat/sword', 'combatAttackStat'],
  meleeWeaponPower: ['stat/sword', 'combatMeleeAttackStat'],
  rangedWeaponPower: ['stat/bow', 'combatRangedAttackStat'],
  armor: ['stat/shield', 'combatArmorStat'],
} as const

export type CombatStatInfo = { key: keyof typeof STAT_PRESENTATION; value: number; ranged?: boolean }

/** Shared icon, label and value for unit profiles and equipment sheets. */
export function createCombatStatInfo({ key, value, ranged }: CombatStatInfo): HTMLElement {
  const [icon, label] = STAT_PRESENTATION[key]
  const element = document.createElement('span')
  element.className = 'info combat-stat-info'
  element.title = t(label)
  element.setAttribute('aria-label', `${t(label)}: ${value}`)
  const image = document.createElement('img')
  image.src = getIconPath(ranged ? STAT_PRESENTATION.rangedWeaponPower[0] : icon)
  image.alt = ''
  const amount = document.createElement('span')
  amount.className = key
  amount.textContent = String(value)
  element.append(image, amount)
  return element
}
