import { EQUIPMENT_DURABILITY } from '../../config/equipmentDurability'
import { HERO_CRAFT_RECIPES } from '../hero/heroCraftRecipes'
import { migrateEquipmentMaterial } from './equipmentMaterials'
import { BUILDING_TYPES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, HeroEquipmentSlot, HeroWeaponSlot, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { isHeroInteractionTargetReachable } from '../hero/heroActionRange'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import {
  equipmentBaseKey,
  getEquipmentDurability,
  getEquipmentMaxUses,
  getEquipmentRemainingUses,
  withEquipmentDurability,
} from './equipmentCondition'
import { refreshUnitEquipmentStats } from './equipmentStats'

export type EquipmentRepairTarget = { location: 'bag' | 'weapon' | 'armor'; key: string; item: string }
export function getEquipmentRepairTargets(hero: UnitEntity): EquipmentRepairTarget[] {
  const inventory = hero.inventory
  const all: EquipmentRepairTarget[] = [
    ...(inventory?.equipment ?? []).map((item, index) => ({ location: 'bag' as const, key: String(index), item })),
    ...Object.entries(inventory?.activeWeapons ?? {}).map(([key, item]) => ({
      location: 'weapon' as const,
      key,
      item,
    })),
    ...Object.entries(inventory?.equipped ?? {}).map(([key, item]) => ({ location: 'armor' as const, key, item })),
  ]
  return all.filter(target => (getEquipmentDurability(target.item) ?? 100) < 100)
}
export function getEquipmentRepairCost(item: string): ResourceAmount {
  const remaining = getEquipmentDurability(item)
  if (remaining == null || remaining >= 100) return {}
  const wear = (100 - remaining) / 100
  const key = equipmentBaseKey(migrateEquipmentMaterial(item))
  if (/^(sword_|spear_|mace_|club_|dagger_|pike_|lance_|bow|slingshot$)/.test(key)) {
    // Uncraftable bow variants share the basic bow's maintenance ingredients.
    const recipe =
      HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === key) ??
      (key.startsWith('bow') ? HERO_CRAFT_RECIPES.find(recipe => recipe.outputEquipment === 'bow') : undefined)
    if (recipe) {
      const maximum = getEquipmentMaxUses(item)
      const used = maximum - (getEquipmentRemainingUses(item) ?? maximum)
      return Object.fromEntries(
        Object.entries(recipe.cost)
          .filter(([, amount]) => amount > 0)
          .map(([resource, amount]) => [
            resource,
            Math.min(
              amount / recipe.outputCount,
              Math.ceil(
                (amount * used * EQUIPMENT_DURABILITY.weaponRepairRecipeFraction) / (recipe.outputCount * maximum)
              )
            ),
          ])
      )
    }
  }
  if (key === 'slingshot') return { wood: Math.ceil(2 * wear), leather: Math.ceil(wear), sinew: Math.ceil(wear) }
  if (key.startsWith('bow')) return { wood: Math.ceil(6 * wear), sinew: Math.ceil(2 * wear) }
  if (key === 'armor_leather') return { leather: Math.ceil(6 * wear) }
  const material =
    key.includes('iron')
      ? 'ironIngot'
      : key.includes('ceramic')
        ? 'stone'
        : key.includes('bronze')
          ? 'bronzeIngot'
          : 'wood'
  return {
    [material]: Math.ceil((material === 'stone' ? 6 : 2) * wear),
    ...(key.startsWith('armor_') ? { leather: Math.ceil(2 * wear) } : { wood: Math.ceil(2 * wear) }),
  }
}
function targetExists(hero: UnitEntity, target: EquipmentRepairTarget): boolean {
  return getEquipmentRepairTargets(hero).some(
    value => value.location === target.location && value.key === target.key && value.item === target.item
  )
}
export function canRepairEquipment(
  player: PlayerLike,
  hero: UnitEntity,
  forge: BuildingEntity,
  target: EquipmentRepairTarget
): boolean {
  return Boolean(
    !hero.isDead &&
      !hero.isDestroyed &&
      !hero.actionLocked &&
      (forge.type === BUILDING_TYPES.forge || forge.type === BUILDING_TYPES.campForge) &&
      forge.isBuilt &&
      !forge.isDead &&
      !forge.isDestroyed &&
      isHeroInteractionTargetReachable(hero, null, forge) &&
      targetExists(hero, target) &&
      Object.keys(getMissingPlayerResources(player, getEquipmentRepairCost(target.item), { hero, settlement: forge }))
        .length === 0
  )
}
export function repairEquipment(
  player: PlayerLike,
  hero: UnitEntity,
  forge: BuildingEntity,
  target: EquipmentRepairTarget
): boolean {
  if (!canRepairEquipment(player, hero, forge, target)) return false
  if (!withdrawChestResources(player, getEquipmentRepairCost(target.item), { hero, settlement: forge })) return false
  const restored = withEquipmentDurability(target.item, 100)
  if (target.location === 'bag') hero.inventory!.equipment![Number(target.key)] = restored
  else if (target.location === 'weapon') hero.inventory!.activeWeapons![target.key as HeroWeaponSlot] = restored
  else hero.inventory!.equipped![target.key as HeroEquipmentSlot] = restored
  refreshUnitEquipmentStats(hero)
  hero.context?.menu?.updateHeroStatus?.(hero)
  return true
}
