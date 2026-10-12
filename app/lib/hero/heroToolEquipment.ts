import { getEquippedWorkTool, workForTool } from '../equipment/workTools'
import { rangedWeaponEquipment } from '../equipment/rangedWeapon'
import { isEquipmentBroken } from '../equipment/equipmentCondition'
import { SHEET_TYPES, WORK_TYPES } from '../constants'
import { refreshBakedLpcUnitAssets } from '../lpc/baked'
import { refreshUnitEquipmentStats } from '../equipment/equipmentStats'
import { applyUnitActionFrameSequence } from '../units/visuals/unitWorkAppearance'
import type { UnitEntity } from '../../types/entities'
import type { HeroEquippedItem } from '../../types/heroTools'

export type { HeroEquippedItem } from '../../types/heroTools'

export const HERO_TOOL_ORDER: HeroEquippedItem[] = ['interact', 'sword', 'bow']

const EQUIPPED_ITEM_WORK: Record<HeroEquippedItem, string> = {
  interact: WORK_TYPES.attacker,
  sword: 'heroSword',
  bow: WORK_TYPES.hunter,
}

function isEquipmentKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

export function getEquippedItemWeapon(tool: HeroEquippedItem, hero?: UnitEntity | null): string | undefined {
  const item =
    tool === 'sword'
      ? hero?.inventory?.activeWeapons?.melee
      : tool === 'bow'
        ? hero?.inventory?.activeWeapons?.ranged
        : hero?.inventory?.activeWeapons?.tool
  return item
}

export function isHeroToolAvailable(
  hero: UnitEntity | null | undefined,
  tool: HeroEquippedItem | null | undefined
): boolean {
  if (!tool || tool === 'interact') return true
  const item = getEquippedItemWeapon(tool, hero)
  return Boolean(item && !isEquipmentBroken(item))
}

export function getHeroToolEquipment(hero: UnitEntity, tool: HeroEquippedItem): string[] {
  const activeWeapons = hero.inventory?.activeWeapons ?? {}
  if (tool === 'interact') {
    const item = getEquippedWorkTool(hero)
    return item ? [item] : []
  }
  if (tool === 'sword') {
    return [activeWeapons.melee, hero.inventory?.equipped?.offhand, activeWeapons.offhand].filter(isEquipmentKey)
  }
  if (tool === 'bow') {
    return rangedWeaponEquipment(activeWeapons.ranged, hero.inventory?.equipped?.arrow)
  }
  return []
}

export function getHeroPowerChargeToolForEquippedItem(
  hero: UnitEntity,
  tool: HeroEquippedItem | null | undefined
): 'bow' | 'catchingPole' | 'sword' | null {
  if (tool === 'bow') return 'bow'
  if (tool !== 'sword') return null
  return hero.inventory?.activeWeapons?.melee === 'catchingPole' ? 'catchingPole' : 'sword'
}

export function isHeroCatchingPoleEquipped(
  hero: UnitEntity | null | undefined,
  tool: HeroEquippedItem | null
): boolean {
  return Boolean(hero && getHeroPowerChargeToolForEquippedItem(hero, tool) === 'catchingPole')
}

function applyEquippedItemAppearance(hero: UnitEntity, tool: HeroEquippedItem): void {
  const work = tool === 'interact' ? workForTool(hero.inventory?.activeWeapons?.tool) : EQUIPPED_ITEM_WORK[tool]
  if (hero.work === work) {
    refreshBakedLpcUnitAssets(hero)
    refreshUnitEquipmentStats(hero)
    hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
    return
  }
  hero.work = work
  applyUnitActionFrameSequence(hero, work)
  refreshUnitEquipmentStats(hero)
  refreshBakedLpcUnitAssets(hero)
  hero.setTextures?.(hero.sprite?.playing ? SHEET_TYPES.walking : SHEET_TYPES.standing)
}

export const applyToolAppearance = applyEquippedItemAppearance
