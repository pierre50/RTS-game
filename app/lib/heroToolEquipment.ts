import { SHEET_TYPES, WORK_TYPES } from '../constants'
import { applyBakedLpcUnitAssets } from './lpc/baked'
import type { DynamicEquipmentKey } from './lpc/equipment'
import { getTotalCarriedResources } from './resourceCarry'
import {
  getUnitWorkEquipment,
  refreshUnitEquipmentStats,
} from './equipmentStats'
import { applyUnitWorkAssets } from './unitWorkAppearance'
import type { UnitEntity } from '../types/entities'
import type { HeroEquippedItem } from '../types/heroTools'

export type { HeroEquippedItem } from '../types/heroTools'

export const HERO_TOOL_ORDER: HeroEquippedItem[] = ['interact', 'sword', 'bow', 'lasso']

const EQUIPPED_ITEM_WORK: Record<HeroEquippedItem, string> = {
  interact: WORK_TYPES.attacker,
  sword: 'heroSword',
  bow: WORK_TYPES.hunter,
  lasso: WORK_TYPES.attacker,
}

// Mirrors the base equipment attached to each work above (see VILLAGER_WORK_EQUIPMENT
// in lpc/equipment.ts: heroSword->age-scaled sword, hunter->bow) so inventory tool
// slots can render an icon. No entry for 'interact': bare hands.
export const EQUIPPED_ITEM_WEAPON: Partial<Record<HeroEquippedItem, DynamicEquipmentKey>> = {
  sword: 'sword_ceramic',
  bow: 'bow',
}

function isEquipmentKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

export function getEquippedItemWeapon(
  tool: HeroEquippedItem,
  age = 0,
  hero?: UnitEntity | null
): string | undefined {
  void age
  if (tool === 'sword') return hero?.inventory?.activeWeapons?.melee
  if (tool === 'bow') return hero?.inventory?.activeWeapons?.ranged
  if (tool === 'lasso') return hero?.inventory?.activeWeapons?.lasso
  return EQUIPPED_ITEM_WEAPON[tool]
}

export function isHeroToolAvailable(
  hero: UnitEntity | null | undefined,
  tool: HeroEquippedItem | null | undefined
): boolean {
  if (!tool || tool === 'interact') return true
  return Boolean(getEquippedItemWeapon(tool, hero?.owner?.age ?? 0, hero))
}

export function getHeroToolEquipment(hero: UnitEntity, tool: HeroEquippedItem): string[] {
  const fallback = getUnitWorkEquipment(EQUIPPED_ITEM_WORK[tool], hero.owner?.age)
  const activeWeapons = hero.inventory?.activeWeapons ?? {}
  if (tool === 'sword') {
    return [activeWeapons.melee, hero.inventory?.equipped?.offhand, activeWeapons.offhand].filter(isEquipmentKey)
  }
  if (tool === 'bow') {
    return [activeWeapons.ranged, activeWeapons.quiver, hero.inventory?.equipped?.arrow].filter(isEquipmentKey)
  }
  if (tool === 'lasso') return [activeWeapons.lasso].filter(isEquipmentKey)
  return fallback
}

function applyEquippedItemAppearance(hero: UnitEntity, tool: HeroEquippedItem): void {
  const work = EQUIPPED_ITEM_WORK[tool]
  if (hero.work === work) {
    applyBakedLpcUnitAssets(hero)
    refreshUnitEquipmentStats(hero)
    hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
    return
  }
  hero.work = work
  applyBakedLpcUnitAssets(hero)
  applyUnitWorkAssets(hero, work, { loading: getTotalCarriedResources(hero) > 0, refreshEquipmentStats: true })
  hero.setTextures?.(hero.sprite?.playing ? SHEET_TYPES.walking : SHEET_TYPES.standing)
}

export const applyToolAppearance = applyEquippedItemAppearance
