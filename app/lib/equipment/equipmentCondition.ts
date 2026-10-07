/** Inventory values remain serializable strings. Only worn copies carry a condition suffix;
 * assets/configuration always use equipmentBaseKey. Equal-condition copies may stack. */
const CONDITION_SUFFIX = /~condition:(\d+)$/

export function equipmentBaseKey(item: string): string {
  return item.replace(CONDITION_SUFFIX, '').split('~decor:')[0]!
}
export function hasEquipmentDurability(item: string): boolean {
  const key = equipmentBaseKey(item)
  return key.startsWith('sword_') || key === 'longsword' || key.startsWith('bow') || key.startsWith('armor_')
}
export function getEquipmentDurability(item: string): number | null {
  if (!hasEquipmentDurability(item)) return null
  const match = item.match(CONDITION_SUFFIX)
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : 100
}
export function withEquipmentDurability(item: string, durability: number): string {
  const key = equipmentBaseKey(item)
  if (!hasEquipmentDurability(key)) return key
  const value = Number.isFinite(durability) ? Math.max(0, Math.min(100, Math.floor(durability))) : 100
  return value === 100 ? key : `${key}~condition:${value}`
}
export function isEquipmentBroken(item: string | null | undefined): boolean {
  return Boolean(item && getEquipmentDurability(item) === 0)
}

export function isBrokenCombatWeapon(item: string): boolean {
  return (
    isEquipmentBroken(item) && (item.startsWith('bow') || item.startsWith('sword_') || item.startsWith('longsword'))
  )
}
