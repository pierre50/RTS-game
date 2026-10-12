import { equipmentBaseKey } from './equipmentCondition'

export function isSlingshot(item: string | null | undefined): boolean {
  return Boolean(item && equipmentBaseKey(item) === 'slingshot')
}

/** Arrows contribute neither appearance nor damage to a stone-powered weapon. */
export function rangedWeaponEquipment(weapon?: string, arrow?: string): string[] {
  if (!weapon) return []
  return isSlingshot(weapon) ? [weapon] : [weapon, 'quiver', ...(arrow ? [arrow] : [])]
}
