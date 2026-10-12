import { withEquipmentDurability } from './equipmentCondition'
import { resolveForgeEquipment } from './forgeUpgrades'
import { WORK_TOOL_FAMILIES, workToolFamily, toolFamilyForWork, type WorkToolActor } from './workTools'

/** Convert formerly implicit tools once; empty slots and lost tools stay empty thereafter. */
export function initializeWorkTools(unit: WorkToolActor): void {
  if (!['Hero', 'Villager'].includes(unit.type ?? '') || unit.isDead || unit.inventory?.toolsInitialized) return
  const inventory = (unit.inventory ??= {})
  const bag = (inventory.equipment ??= [])
  const slots = (inventory.activeWeapons ??= {})
  if (workToolFamily(slots.melee)) {
    bag.push(slots.melee!)
    delete slots.melee
  }
  for (const family of WORK_TOOL_FAMILIES) {
    if (workToolFamily(slots.tool) === family || bag.some(item => workToolFamily(item) === family)) continue
    const key = resolveForgeEquipment(`${family}_ceramic`, unit.owner)
    const condition = unit.equipmentDurability?.[key]
    bag.push(condition == null ? key : withEquipmentDurability(key, condition))
  }
  if (!slots.tool) {
    const desired = toolFamilyForWork(unit.work) ?? 'axe'
    const index = bag.findIndex(item => workToolFamily(item) === desired)
    if (index >= 0) slots.tool = bag.splice(index, 1)[0]!
  }
  inventory.toolsInitialized = true
}
