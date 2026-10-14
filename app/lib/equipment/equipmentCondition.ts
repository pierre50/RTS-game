import { EQUIPMENT_DURABILITY } from '../../config/equipmentDurability'

/** Inventory values remain serializable strings. Only worn copies carry a condition suffix;
 * equipmentBaseKey resolves the torso/weapon, while the component suffix stays on the item.
 * Equal variants with equal condition may stack. */
const CONDITION_SUFFIX = /~(condition|uses):(\d+)$/

export function equipmentWithoutCondition(item: string): string {
  return item.replace(CONDITION_SUFFIX, '')
}

/** Equipment counts contacts; legacy condition suffixes remain percentages. */
export function getEquipmentMaxUses(item: string): number {
  const key = equipmentBaseKey(item)
  if (key.startsWith('bow')) return EQUIPMENT_DURABILITY.bow
  if (key === 'slingshot') return EQUIPMENT_DURABILITY.slingshot
  if (!/^(axe|pickaxe|hammer|scythe|sword|spear|mace|club|dagger|pike|lance)(_|$)/.test(key))
    return EQUIPMENT_DURABILITY.armorCondition
  if (key.endsWith('_iron')) return EQUIPMENT_DURABILITY.materials.iron
  if (key.endsWith('_bronze')) return EQUIPMENT_DURABILITY.materials.bronze
  return EQUIPMENT_DURABILITY.materials.ceramic
}

export function equipmentBaseKey(item: string): string {
  return equipmentWithoutCondition(item).split('~decor:')[0]!
}
export function hasEquipmentDurability(item: string): boolean {
  const key = equipmentBaseKey(item)
  return (
    /^(axe|hammer|mace|club|spear|pike|lance|pickaxe|scythe)_/.test(key) ||
    ['axe', 'cane', 'longstick', 'catchingPole'].includes(key) ||
    key.startsWith('sword_') ||
    key.startsWith('dagger_') ||
    key === 'slingshot' ||
    key.startsWith('bow') ||
    key.startsWith('armor_') ||
    key.startsWith('shoulder_')
  )
}
export function getEquipmentDurability(item: string): number | null {
  if (!hasEquipmentDurability(item)) return null
  const match = item.match(CONDITION_SUFFIX)
  if (!match) return 100
  return match[1] === 'uses'
    ? (Math.min(getEquipmentMaxUses(item), Number(match[2])) / getEquipmentMaxUses(item)) * 100
    : Math.min(100, Number(match[2]))
}
export function withEquipmentDurability(item: string, durability: number): string {
  const key = equipmentWithoutCondition(item)
  if (!hasEquipmentDurability(key)) return key
  // Legacy NPC maps store percentages; keep sub-percent wear when rebuilding their items.
  if (Number.isFinite(durability) && !Number.isInteger(durability) && getEquipmentMaxUses(key) > 100)
    return withEquipmentRemainingUses(key, Math.round((durability / 100) * getEquipmentMaxUses(key)))
  const value = Number.isFinite(durability) ? Math.max(0, Math.min(100, Math.floor(durability))) : 100
  return value === 100 ? key : `${key}~condition:${value}`
}
/** Exact integer budget, including proportional conversion of old percentage saves. */
export function getEquipmentRemainingUses(item: string): number | null {
  const condition = getEquipmentDurability(item)
  return condition == null ? null : Math.round((condition / 100) * getEquipmentMaxUses(item))
}
export function withEquipmentRemainingUses(item: string, uses: number): string {
  const key = equipmentWithoutCondition(item)
  if (!hasEquipmentDurability(key)) return key
  const max = getEquipmentMaxUses(key)
  const value = Number.isFinite(uses) ? Math.max(0, Math.min(max, Math.floor(uses))) : max
  if (value === max) return key
  if (value === 0 || max === 100) return withEquipmentDurability(key, value)
  return `${key}~uses:${value}`
}
export function isEquipmentBroken(item: string | null | undefined): boolean {
  return Boolean(item && getEquipmentDurability(item) === 0)
}

export function isBrokenCombatWeapon(item: string): boolean {
  return (
    isEquipmentBroken(item) &&
    (equipmentBaseKey(item) === 'slingshot' ||
      item.startsWith('spear_') ||
      item.startsWith('mace_') ||
      item.startsWith('club_') ||
      item.startsWith('dagger_') ||
      item.startsWith('bow') ||
      item.startsWith('sword_'))
  )
}
