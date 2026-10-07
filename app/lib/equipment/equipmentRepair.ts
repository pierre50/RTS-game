import { BUILDING_TYPES } from '../../constants'
import type { ResourceAmount } from '../../types/common'
import type { BuildingEntity, HeroEquipmentSlot, HeroWeaponSlot, UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { isHeroInteractionTargetReachable } from '../hero/heroActionRange'
import { getMissingPlayerResources, withdrawChestResources } from '../resources/playerResourceTotals'
import { equipmentBaseKey, getEquipmentDurability } from './equipmentCondition'
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
  const key = equipmentBaseKey(item)
  if (key.startsWith('bow')) return { wood: Math.ceil(6 * wear), sinew: Math.ceil(2 * wear) }
  if (key === 'armor_leather') return { leather: Math.ceil(6 * wear) }
  const material =
    key.includes('iron') || key === 'longsword' || key === 'halberd'
      ? 'ironIngot'
      : key.includes('ceramic')
        ? 'stone'
        : key.includes('bronze')
          ? 'bronzeIngot'
          : 'copperIngot'
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
      Object.keys(getMissingPlayerResources(player, getEquipmentRepairCost(target.item), { hero })).length === 0
  )
}
export function repairEquipment(
  player: PlayerLike,
  hero: UnitEntity,
  forge: BuildingEntity,
  target: EquipmentRepairTarget
): boolean {
  if (!canRepairEquipment(player, hero, forge, target)) return false
  if (!withdrawChestResources(player, getEquipmentRepairCost(target.item), { hero })) return false
  const restored = equipmentBaseKey(target.item)
  if (target.location === 'bag') hero.inventory!.equipment![Number(target.key)] = restored
  else if (target.location === 'weapon') hero.inventory!.activeWeapons![target.key as HeroWeaponSlot] = restored
  else hero.inventory!.equipped![target.key as HeroEquipmentSlot] = restored
  refreshUnitEquipmentStats(hero)
  hero.context?.menu?.updateHeroStatus?.(hero)
  return true
}
