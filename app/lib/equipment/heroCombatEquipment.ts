import { getEquippedWorkTool, toolFamilyForWork, workToolFamily } from './workTools'
import { rangedWeaponEquipment } from './rangedWeapon'
import type { UnitEntity } from '../../types/entities'
import type { PlayerLike } from '../../types/player'
import { UNIT_TYPES, WORK_TYPES } from '../constants'
import { isEquipmentBroken } from './equipmentCondition'

export type EquipmentEntityLike = {
  buildingLevel?: number
  assetLevel?: unknown
  equipment?: string[]
  equipmentDurability?: Record<string, number>
  experience?: UnitEntity['experience']
  family?: string
  inventory?: UnitEntity['inventory']
  owner?: Pick<PlayerLike, 'civ' | 'config' | 'forgeUpgrades'> | null
  type?: string
  work?: string | null
}

export function usesHeroInventoryEquipment(entity: EquipmentEntityLike): boolean {
  return Boolean(entity.inventory && (entity.type === UNIT_TYPES.hero || (entity as UnitEntity).controlMode === 'hero'))
}

function getHeroInventoryArmorEquipment(entity: EquipmentEntityLike): string[] {
  const { arrow, ...equippedWithoutArrow } = entity.inventory?.equipped ?? {}
  void arrow
  return Object.values(equippedWithoutArrow).filter((item): item is string => typeof item === 'string')
}

export function getHeroInventoryActiveWeaponEquipment(entity: EquipmentEntityLike): string[] {
  const activeWeapons = entity.inventory?.activeWeapons ?? {}
  const tool = getEquippedWorkTool(entity)
  if (tool && toolFamilyForWork(entity.work) === workToolFamily(tool)) return [tool]
  if (entity.work === 'heroSword') {
    return [activeWeapons.melee, activeWeapons.offhand].filter((item): item is string => typeof item === 'string')
  }
  if (entity.work === WORK_TYPES.hunter) {
    if (!activeWeapons.ranged || isEquipmentBroken(activeWeapons.ranged)) return []
    return rangedWeaponEquipment(activeWeapons.ranged, entity.inventory?.equipped?.arrow)
  }
  return []
}

export function getHeroInventoryCombatEquipment(entity: EquipmentEntityLike): string[] {
  return [...getHeroInventoryArmorEquipment(entity), ...getHeroInventoryActiveWeaponEquipment(entity)]
}
