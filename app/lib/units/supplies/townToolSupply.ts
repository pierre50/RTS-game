import { equipOwnedTool } from './toolPreparation'
import { craftCarriedStoneTool, groundToolTarget } from './groundToolRecovery'
import { takeOrCraftTownEquipment, townSupplies, storeTownEquipment } from './townSupplies'
import { equipmentBaseKey, isEquipmentBroken } from '../../equipment/equipmentCondition'
import { getWeaponSlot } from '../../equipment/equipmentSlots'
import { canNpcWieldWeapon, npcWeaponDefinition } from '../combat/npcWeapons'
import { workToolFamily } from '../../equipment/workTools'
import type { UnitEntity } from '../../../types/entities'
import type { PlayerLike } from '../../../types/player'
import type { SaveEntityState, SavePlayerState } from '../../../types/save'

/** Replace broken tools or supply the first tool of a resident who owns none. */
export function supplyTownTool(
  unit: UnitEntity | SaveEntityState,
  owner: PlayerLike | SavePlayerState | null | undefined = (unit as UnitEntity).owner
): boolean {
  const live = unit as UnitEntity & { isFleeing?: boolean }
  const worn = unit.inventory?.activeWeapons?.tool
  const requested = groundToolTarget(unit, owner) ?? worn
  if (
    !owner ||
    unit.type === 'Hero' ||
    unit.controlMode === 'hero' ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed ||
    !requested ||
    !workToolFamily(requested) ||
    (worn === requested && worn != null && !isEquipmentBroken(worn)) ||
    (live.combatMode === 'recover' && live.waitingForEnergyAction === 'attack') ||
    (live.combatMode === 'flee' && unit.dest) ||
    live.isFleeing ||
    live.campBehavior?.phase === 'pursue' ||
    live.spacePortalState?.combatTarget ||
    ['attack', 'flee', 'hunt', 'train'].includes(unit.action ?? '')
  )
    return false
  if (equipOwnedTool(unit, workToolFamily(requested)!)) {
    unit.autonomousJob = null
    live.stop?.()
    return true
  }
  const target = unit.inventory?.toolSupplyTarget
  const desired = target && workToolFamily(target) === workToolFamily(requested) ? target : equipmentBaseKey(requested)
  const supplies = townSupplies(unit, owner)
  const stoneTool = `${workToolFamily(requested)}_ceramic`
  let stockedTool: string | undefined
  if (!worn || workToolFamily(worn) !== workToolFamily(requested)) {
    for (const store of supplies?.stores ?? []) {
      const bag = store.inventory?.equipment ?? []
      const index = bag.findIndex(
        item => workToolFamily(item) === workToolFamily(requested) && !isEquipmentBroken(item)
      )
      if (index >= 0) {
        stockedTool = bag.splice(index, 1)[0]
        break
      }
    }
  }
  // Consume actual stock or carried materials; the fallback never creates free equipment.
  const replacement =
    stockedTool ??
    takeOrCraftTownEquipment(unit, owner, desired) ??
    (desired !== stoneTool ? takeOrCraftTownEquipment(unit, owner, stoneTool) : undefined) ??
    craftCarriedStoneTool(unit, owner)
  if (!replacement) return false
  if (worn && !isEquipmentBroken(worn)) {
    unit.inventory!.equipment ??= []
    unit.inventory!.equipment.push(worn)
  } else if (supplies?.depot && worn && equipmentBaseKey(worn) !== stoneTool) storeTownEquipment(supplies.depot, worn)
  unit.inventory ??= {}
  unit.inventory.activeWeapons ??= {}
  unit.inventory.activeWeapons.tool = replacement
  unit.autonomousJob = null
  live.stop?.()
  if (
    worn &&
    isEquipmentBroken(worn) &&
    workToolFamily(worn) === workToolFamily(requested) &&
    equipmentBaseKey(replacement) !== desired
  )
    unit.inventory!.toolSupplyTarget = desired
  else delete unit.inventory!.toolSupplyTarget
  return true
}

/** Residents replace exhausted carried weapons on returning to a friendly town, never missing items. */
export function supplyTownWeapons(
  unit: UnitEntity | SaveEntityState,
  owner: PlayerLike | SavePlayerState | null | undefined = (unit as UnitEntity).owner
): boolean {
  if (
    !owner ||
    unit.type === 'Hero' ||
    unit.controlMode === 'hero' ||
    unit.isDead ||
    unit.isDestroyed ||
    unit.inventory?.toolsStowed
  )
    return false
  const live = unit as UnitEntity & { isFleeing?: boolean }
  if (
    live.isFleeing ||
    live.campBehavior?.phase === 'pursue' ||
    live.spacePortalState?.combatTarget ||
    (live.combatMode === 'recover' && live.waitingForEnergyAction === 'attack') ||
    (live.combatMode === 'flee' && unit.dest) ||
    ['attack', 'flee', 'hunt', 'train'].includes(unit.action ?? '')
  )
    return false
  const bag = unit.inventory?.equipment
  if (!bag) return false
  const actor = { type: unit.type, owner: owner as PlayerLike }
  const archer = ['Bowman', 'BanditArcher'].includes(unit.type)
  const usable = (item: string) => canNpcWieldWeapon(actor, item) && !isEquipmentBroken(item)
  const melee = (item: string) => getWeaponSlot(item) === 'melee'
  const ranged = (item: string) => getWeaponSlot(item) === 'ranged'
  const dagger = (item: string) => equipmentBaseKey(item).startsWith('dagger_')
  // Archers retain two independent roles. Other soldiers renew only their primary role.
  const roles = archer
    ? [ranged, dagger]
    : unit.type === 'Villager'
      ? [ranged, melee]
      : [bag.some(melee) ? melee : ranged]
  let changed = false
  for (const matches of roles) {
    if (bag.some(item => matches(item) && usable(item))) continue
    const exhausted = [...bag.entries()]
      .filter(([, item]) => matches(item) && isEquipmentBroken(item) && canNpcWieldWeapon(actor, item))
      .sort((a, b) => (npcWeaponDefinition(b[1], actor)?.power ?? 0) - (npcWeaponDefinition(a[1], actor)?.power ?? 0))
    for (const [index, item] of exhausted) {
      const replacement = takeOrCraftTownEquipment(unit, owner, equipmentBaseKey(item))
      if (!replacement) continue
      storeTownEquipment(townSupplies(unit, owner)!.depot, item)
      bag[index] = replacement
      changed = true
      break
    }
  }
  return changed
}
