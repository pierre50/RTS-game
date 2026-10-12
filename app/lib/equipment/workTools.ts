import { equipmentBaseKey, isEquipmentBroken } from './equipmentCondition'
import type { ForgeUpgradeOwner } from './forgeUpgrades'

export const WORK_TOOL_FAMILIES = ['axe', 'pickaxe', 'hammer', 'scythe'] as const
export type WorkToolFamily = (typeof WORK_TOOL_FAMILIES)[number]
type ToolInventory = {
  toolsInitialized?: boolean
  toolsStowed?: boolean
  equipment?: string[]
  activeWeapons?: Partial<Record<'tool' | 'ranged' | 'offhand' | 'quiver', string>> & { melee?: string | null }
}
export type WorkToolActor = {
  type?: string
  work?: string | null
  inventory?: ToolInventory
  equipmentDurability?: Record<string, number>
  owner?: ForgeUpgradeOwner | null
  isDead?: boolean
}

export function workToolFamily(item: string | null | undefined): WorkToolFamily | undefined {
  const family = item && equipmentBaseKey(item).split('_')[0]
  return WORK_TOOL_FAMILIES.find(value => value === family)
}
export function getEquippedWorkTool(unit: Pick<WorkToolActor, 'inventory'> | null | undefined): string | undefined {
  const tool = unit?.inventory?.activeWeapons?.tool
  return !unit?.inventory?.toolsStowed && workToolFamily(tool) && !isEquipmentBroken(tool) ? tool : undefined
}
export function requiredWorkTool(action?: string | null): WorkToolFamily | undefined {
  if (action === 'chopwood') return 'axe'
  if (action?.startsWith('mine')) return 'pickaxe'
  if (action === 'build') return 'hammer'
  if (action === 'farm') return 'scythe'
  return undefined
}
export function toolFamilyForWork(work?: string | null): WorkToolFamily | undefined {
  if (work === 'woodcutter') return 'axe'
  if (work?.endsWith('miner')) return 'pickaxe'
  if (work === 'builder') return 'hammer'
  if (work === 'farmer') return 'scythe'
  return undefined
}
export function workForTool(tool?: string): string {
  return (
    ({ axe: 'woodcutter', pickaxe: 'stoneminer', hammer: 'builder', scythe: 'farmer' } as const)[
      workToolFamily(tool)!
    ] ?? 'attacker'
  )
}
export function hasRequiredWorkTool(unit: WorkToolActor, action?: string | null): boolean {
  if (action === 'farm') return true
  const required = requiredWorkTool(action)
  return !required || workToolFamily(getEquippedWorkTool(unit)) === required
}
export function getWorkToolTier(unit: WorkToolActor): number {
  const tool = getEquippedWorkTool(unit)
  return tool ? Math.max(0, ['ceramic', 'copper', 'bronze', 'iron'].indexOf(equipmentBaseKey(tool).split('_')[1]!)) : 0
}

/** Wheat can be picked by hand; other tool jobs require equipment before assignment. */
export function canAutonomouslyWork(
  unit: Pick<WorkToolActor, 'inventory'>,
  job: string,
  allowGroundGathering = false
): boolean {
  if (job === 'wheat') return true
  const tool = getEquippedWorkTool(unit)
  if (!tool) return false
  if (allowGroundGathering && (job === 'wood' || job === 'stone')) return true
  const required =
    job === 'wood'
      ? 'axe'
      : job === 'construction'
        ? 'hammer'
        : ['stone', 'gold', 'copper', 'tin', 'iron'].includes(job)
          ? 'pickaxe'
          : job === 'wheat'
            ? 'scythe'
            : undefined
  if (required && workToolFamily(tool) !== required) return false
  return job !== 'iron' || getWorkToolTier(unit) >= 2
}
