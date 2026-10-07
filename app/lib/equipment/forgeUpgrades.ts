import { equipmentBaseKey } from './equipmentCondition'
import type { ResourceAmount } from '../../types/common'

export const FORGE_FAMILIES = ['axes', 'pickaxes', 'hammers', 'weapons', 'arrows', 'armor'] as const
export type ForgeFamily = (typeof FORGE_FAMILIES)[number]
export type ForgeUpgrades = Partial<Record<ForgeFamily, number>>
export type ForgeUpgradeOwner = { forgeUpgrades?: ForgeUpgrades }

export const FORGE_MATERIALS = ['ceramic', 'copper', 'bronze', 'iron'] as const
export const FORGE_ICONS: Record<ForgeFamily, string> = {
  axes: 'axe',
  pickaxes: 'pickaxe',
  hammers: 'hammer',
  weapons: 'sword',
  arrows: 'arrow',
  armor: 'armor_mail',
}

export function getForgeTier(owner: ForgeUpgradeOwner | null | undefined, family: ForgeFamily): number {
  const value = owner?.forgeUpgrades?.[family]
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(3, Math.floor(value))) : 0
}

/** Normalize explicit forge state; old save conversion lives at the serialization boundary. */
export function normalizeForgeUpgrades(owner: ForgeUpgradeOwner): ForgeUpgrades {
  return Object.fromEntries(FORGE_FAMILIES.map(family => [family, getForgeTier(owner, family)]))
}

function forgeFamilyForEquipment(equipment: string): ForgeFamily | undefined {
  if (equipment.startsWith('axe_')) return 'axes'
  if (equipment.startsWith('pickaxe_')) return 'pickaxes'
  if (equipment.startsWith('hammer_')) return 'hammers'
  if (equipment.startsWith('sword_')) return 'weapons'
  if (equipment.startsWith('arrow_') || equipment === 'bow') return 'arrows'
  if (/^(armor_|helmet_|shoulder_|bracers_|leg_armor_|round_shield_)/.test(equipment)) return 'armor'
  return undefined
}

export function resolveForgeEquipment(equipment: string, owner?: ForgeUpgradeOwner | null): string {
  const family = forgeFamilyForEquipment(equipment)
  if (!family) return equipment
  const tier = getForgeTier(owner, family)
  if (equipment === 'bow') return tier >= 2 ? 'bow_recurve' : 'bow'
  return equipment.replace(/_(ceramic|copper|bronze|iron)(?=_|$)/, `_${FORGE_MATERIALS[tier]}`)
}

/** Corpses keep the equipment captured at death, even after a village upgrade. */
export function resolveUnitForgeEquipment(
  equipment: string,
  unit: {
    type?: string
    isDead?: boolean
    lootEquipment?: string[]
    owner?: ForgeUpgradeOwner | null
  }
): string {
  if (unit.type === 'Hero' && !['axes', 'pickaxes', 'hammers'].includes(forgeFamilyForEquipment(equipment) ?? ''))
    return equipment
  if (unit.isDead && unit.lootEquipment) {
    const familyKey = (item: string) => equipmentBaseKey(item).replace(/_(ceramic|copper|bronze|iron)(?=_|$)/, '_metal')
    const saved = unit.lootEquipment.find(item => familyKey(item) === familyKey(equipment))
    if (saved) return equipmentBaseKey(saved)
  }
  return resolveForgeEquipment(equipment, unit.owner)
}

export function getForgeUpgradeCost(family: ForgeFamily, nextTier: number): ResourceAmount {
  if (nextTier < 1 || nextTier > 3) return {}
  const military = ['weapons', 'armor', 'arrows'].includes(family)
  const metal = (military ? 20 : 12) * nextTier
  return { wood: military ? 15 : 10, ...(nextTier === 3 ? { iron: metal } : { copper: metal }) }
}

export function getForgeGatherBonus(owner: ForgeUpgradeOwner | null | undefined, work: string, _type?: string): number {
  if (work === 'woodcutter') return getForgeTier(owner, 'axes')
  if (work === 'stoneminer' || work === 'goldminer') return getForgeTier(owner, 'pickaxes')
  return 0
}

export function getForgeBuildMultiplier(owner: ForgeUpgradeOwner | null | undefined, _type?: string): number {
  return 1 + getForgeTier(owner, 'hammers') * 0.25
}
