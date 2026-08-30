import { MENU_INFO_IDS, RESOURCE_ICON_IDS, RESOURCE_NAMES, UNIT_TYPES } from '../../constants'
import { getIconPath } from '../../lib'
import {
  formatEquipmentStackLabel,
  getEquipmentStacks,
  getUnitCorpseLootEquipment,
  getUnitCorpseLootResources,
  pickupCorpseEquipment,
  pickupCorpseResource,
} from '../../lib/equipment/equipmentLoot'
import {
  getHeroInventoryWeaponCombatStats,
  getUnitCombatRange,
  getUnitRuntimeCombatStats,
  hasHeroInventoryEquipment,
} from '../../lib/equipment/equipmentStats'
import type { EquipmentCombatStats } from '../../lib/equipment/equipmentStats'
import {
  formatXpProgressText,
  getUnitExperienceEntries,
  getUnitOverallLevel,
  getXpInfoId,
  XP_CATEGORIES,
} from '../../lib/units/unitExperience'
import { t } from '../../lib/lang'
import { renderEquipmentAvatarLazy } from '../equipment/EquipmentAvatar'
import { appendBaseEntityInfo, createInfoImage, createInfoText } from './BaseEntityInterface'
import type { EntityInfoRenderOptions, UnitEntity } from '../../types/entities'
import type { UnitConfig } from '../../types/config'
import type { MenuLike } from '../../types/context'
import type { ResourceAmount } from '../../types/common'

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

function createCorpseEquipmentLootButton(
  unit: UnitEntity,
  equipment: string,
  count: number,
  menu: MenuLike
): HTMLButtonElement {
  const button = document.createElement('button')
  const label = formatEquipmentStackLabel(equipment, count)
  button.type = 'button'
  button.className = 'corpse-loot-button ui-btn'
  button.setAttribute('aria-label', t('corpseLootTakeItem', { item: label }))

  const icon = document.createElement('canvas')
  icon.className = 'unit-avatar-frame corpse-loot-icon'
  icon.width = 56
  icon.height = 56
  if (unit.context?.app) {
    renderEquipmentAvatarLazy(unit.context.app, equipment, icon, 'corpse loot', unit.context.performance)
  }

  const text = document.createElement('span')
  text.className = 'corpse-loot-label'
  text.textContent = label

  button.appendChild(icon)
  button.appendChild(text)
  button.addEventListener('click', evt => {
    evt.preventDefault()
    evt.stopPropagation()
    const hero = unit.context?.controls?.heroUnit
    if (!pickupCorpseEquipment(unit, hero, equipment)) return
    menu.playUiClick?.()
    menu.showMessage(t('corpseLootPickedItem', { item: label }), 'success')
    menu.syncEntityInfoModal?.()
    menu.refreshInventory?.()
  })

  return button
}

function formatCorpseResourceLootLabel(resource: keyof ResourceAmount, amount: number): string {
  return `${t(resource)} x${amount}`
}

function createCorpseResourceLootButton(
  unit: UnitEntity,
  resource: keyof ResourceAmount,
  amount: number,
  menu: MenuLike
): HTMLButtonElement {
  const button = document.createElement('button')
  const label = formatCorpseResourceLootLabel(resource, amount)
  button.type = 'button'
  button.className = 'corpse-loot-button ui-btn'
  button.setAttribute('aria-label', t('corpseLootTakeItem', { item: label }))

  button.appendChild(createInfoImage('corpse-loot-icon', getIconPath(RESOURCE_ICON_IDS[resource].commodity)))

  const text = document.createElement('span')
  text.className = 'corpse-loot-label'
  text.textContent = label

  button.appendChild(text)
  button.addEventListener('click', evt => {
    evt.preventDefault()
    evt.stopPropagation()
    const hero = unit.context?.controls?.heroUnit
    const pickedAmount = pickupCorpseResource(unit, hero, resource)
    if (pickedAmount <= 0) return
    menu.playUiClick?.()
    menu.showMessage(
      t('corpseLootPickedItem', { item: formatCorpseResourceLootLabel(resource, pickedAmount) }),
      'success'
    )
    menu.syncEntityInfoModal?.()
    menu.refreshInventory?.()
  })

  return button
}

function createCorpseTakeAllButton(unit: UnitEntity, equipment: readonly string[], menu: MenuLike): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'corpse-loot-take-all ui-btn'
  button.textContent = t('corpseLootTakeAll')
  button.addEventListener('click', evt => {
    evt.preventDefault()
    evt.stopPropagation()
    const hero = unit.context?.controls?.heroUnit
    if (!hero) return

    let pickedCount = 0
    for (const resource of RESOURCE_NAMES) {
      if (pickupCorpseResource(unit, hero, resource) > 0) pickedCount += 1
    }
    for (const item of [...equipment]) {
      if (pickupCorpseEquipment(unit, hero, item)) pickedCount += 1
    }
    if (!pickedCount) return

    menu.playUiClick?.()
    menu.showMessage(t('corpseLootPickedAll', { count: pickedCount }), 'success')
    menu.syncEntityInfoModal?.()
    menu.refreshInventory?.()
  })
  return button
}

function appendCorpseEquipmentLoot(element: HTMLElement, unit: UnitEntity, menu: MenuLike): void {
  const equipment = getUnitCorpseLootEquipment(unit)
  const resources = getUnitCorpseLootResources(unit)
  const resourceEntries = RESOURCE_NAMES.map(resource => ({
    amount: Math.max(0, Math.floor(resources[resource] ?? 0)),
    resource,
  })).filter(entry => entry.amount > 0)
  if (!equipment.length && !resourceEntries.length) return
  const stacks = getEquipmentStacks(equipment)

  const loot = document.createElement('div')
  loot.className = 'corpse-loot'

  const title = document.createElement('div')
  title.className = 'corpse-loot-title'
  title.textContent = t('corpseLootInventory')
  loot.appendChild(title)
  loot.appendChild(createCorpseTakeAllButton(unit, equipment, menu))

  const grid = document.createElement('div')
  grid.className = 'corpse-loot-grid'
  for (const { amount, resource } of resourceEntries) {
    grid.appendChild(createCorpseResourceLootButton(unit, resource, amount, menu))
  }
  for (const stack of stacks) {
    grid.appendChild(createCorpseEquipmentLootButton(unit, stack.equipment, stack.count, menu))
  }
  loot.appendChild(grid)
  element.appendChild(loot)
}

export class UnitInterface {
  unit: UnitEntity

  constructor(unit: UnitEntity) {
    this.unit = unit
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
      infoDiv.title = t(info.title)

      infoDiv.appendChild(createInfoImage('', getIconPath(info.icon)))
      infoDiv.appendChild(createInfoText(String(info.key), info.value))
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
        : getUnitExperienceEntries(unit, { includeZero: options?.showAllXp }).filter(entry =>
            shouldShowGenericXpCategory(unit, entry.category)
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

    if (unit.isDead) appendCorpseEquipmentLoot(element, unit, (unit.context as { menu: MenuLike }).menu)
  }
}
