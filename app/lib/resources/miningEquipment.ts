import { equipmentBaseKey } from '../equipment/equipmentCondition'
import { getEquippedWorkTool, workToolFamily, type WorkToolActor } from '../equipment/workTools'
export type MiningActor = WorkToolActor & { equipment?: string[] }
export function getMiningPickaxe(unit: MiningActor | null | undefined): string {
  const tool = getEquippedWorkTool(unit)
  return tool && workToolFamily(tool) === 'pickaxe' ? equipmentBaseKey(tool) : ''
}
export function hasIronMiningPickaxe(unit: MiningActor | null | undefined): boolean {
  return ['pickaxe_bronze', 'pickaxe_iron'].includes(getMiningPickaxe(unit))
}
