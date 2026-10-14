import { equipmentBaseKey, isEquipmentBroken } from './equipmentCondition'
import type { ForgeUpgradeOwner } from './forgeUpgrades'
import { ACTION_TYPES, RESOURCE_TYPES, UNIT_TYPES } from '../../constants/entities'

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
/** Which tools a work gesture accepts; `bareHands` lets an empty Tool slot do it too. */
type WorkToolRule = { tools: readonly WorkToolFamily[]; bareHands: boolean }
/** `tool`/`hands`: allowed. `missingTool`: needs a listed tool. `wrongTool`: another tool is held. */
export type WorkToolUse = 'tool' | 'hands' | 'missingTool' | 'wrongTool'

const AXE: WorkToolRule = { tools: ['axe'], bareHands: false }
const PICKAXE: WorkToolRule = { tools: ['pickaxe'], bareHands: false }
const HAMMER: WorkToolRule = { tools: ['hammer'], bareHands: false }
const SCYTHE_OR_HANDS: WorkToolRule = { tools: ['scythe'], bareHands: true }
const HANDS: WorkToolRule = { tools: [], bareHands: true }

const FORAGE_TOOL_RULES: Record<string, WorkToolRule> = {
  [RESOURCE_TYPES.medicinalHerb]: SCYTHE_OR_HANDS,
  [RESOURCE_TYPES.toxicHerb]: SCYTHE_OR_HANDS,
  [RESOURCE_TYPES.fiberPlant]: SCYTHE_OR_HANDS,
}

const JOB_WORK_TARGETS: Record<string, [action: string, targetType?: string]> = {
  construction: [ACTION_TYPES.build],
  wood: [ACTION_TYPES.chopwood],
  stone: [ACTION_TYPES.minestone],
  gold: [ACTION_TYPES.minegold],
  copper: [ACTION_TYPES.minecopper],
  tin: [ACTION_TYPES.minetin],
  iron: [ACTION_TYPES.mineiron],
  wheat: [ACTION_TYPES.farm],
  berry: [ACTION_TYPES.forageberry, RESOURCE_TYPES.berrybush],
  herb: [ACTION_TYPES.forageberry, RESOURCE_TYPES.medicinalHerb],
  toxicHerb: [ACTION_TYPES.forageberry, RESOURCE_TYPES.toxicHerb],
  fiber: [ACTION_TYPES.forageberry, RESOURCE_TYPES.fiberPlant],
}

/** The single source of truth for tool/target compatibility; undefined means the action is not tool work. */
function workToolRule(action?: string | null, targetType?: string | null): WorkToolRule | undefined {
  if (action === ACTION_TYPES.chopwood) return AXE
  if (action?.startsWith('mine')) return PICKAXE
  if (action === ACTION_TYPES.build) return HAMMER
  if (action === ACTION_TYPES.farm) return SCYTHE_OR_HANDS
  if (action === ACTION_TYPES.forageberry) return FORAGE_TOOL_RULES[targetType ?? ''] ?? HANDS
  return undefined
}

function jobToolRule(job: string): WorkToolRule | undefined {
  const target = JOB_WORK_TARGETS[job]
  return target && workToolRule(...target)
}

/**
 * A hero never has its held tool silently put away: an unlisted tool blocks the gesture.
 * NPCs manage their own loadout, so they keep an unrelated tool on them and work bare-handed,
 * and only use an optional tool when it is their trade's tool (a forager does not scythe herbs).
 */
export function workToolUse(
  unit: WorkToolActor | null | undefined,
  action?: string | null,
  targetType?: string | null
): WorkToolUse | undefined {
  const rule = workToolRule(action, targetType)
  if (!rule) return undefined
  const family = workToolFamily(getEquippedWorkTool(unit))
  const isHero = unit?.type === UNIT_TYPES.hero
  if (family && rule.tools.includes(family) && (isHero || !rule.bareHands || toolFamilyForWork(unit?.work) === family))
    return 'tool'
  if (rule.bareHands && (!family || !isHero)) return 'hands'
  return rule.bareHands ? 'wrongTool' : 'missingTool'
}

export function canDoWorkWithTool(
  unit: WorkToolActor | null | undefined,
  action?: string | null,
  targetType?: string | null
): boolean {
  const use = workToolUse(unit, action, targetType)
  return use !== 'missingTool' && use !== 'wrongTool'
}

/** The i18n key explaining a blocked gesture, or undefined when the gesture is allowed. */
export function workToolBlockedMessageKey(
  unit: WorkToolActor | null | undefined,
  action?: string | null,
  targetType?: string | null
): string | undefined {
  const use = workToolUse(unit, action, targetType)
  const rule = workToolRule(action, targetType)
  if (use === 'missingTool') return `toolRequired_${rule!.tools[0]}`
  if (use === 'wrongTool') return rule!.tools.length ? `toolWrong_${rule!.tools[0]}` : 'toolWrong_hands'
  return undefined
}

/** The hero's work follows the tool it actually swings, e.g. scything herbs animates as a farmer. NPC jobs stay put. */
export function workForToolUse(
  unit: WorkToolActor | null | undefined,
  action: string | null | undefined,
  targetType: string | null | undefined,
  defaultWork: string
): string {
  const tool = getEquippedWorkTool(unit)
  return unit?.type === UNIT_TYPES.hero &&
    workToolRule(action, targetType)?.bareHands &&
    workToolUse(unit, action, targetType) === 'tool'
    ? workForTool(tool)
    : defaultWork
}
export function getWorkToolTier(unit: WorkToolActor): number {
  const tool = getEquippedWorkTool(unit)
  return tool ? Math.max(0, ['ceramic', 'copper', 'bronze', 'iron'].indexOf(equipmentBaseKey(tool).split('_')[1]!)) : 0
}

/** Wheat can be picked by hand; other jobs need a held tool, and mandatory-tool jobs need theirs. */
export function canAutonomouslyWork(
  unit: Pick<WorkToolActor, 'inventory'>,
  job: string,
  allowGroundGathering = false
): boolean {
  if (job === 'wheat') return true
  const tool = getEquippedWorkTool(unit)
  if (!tool) return false
  if (allowGroundGathering && (job === 'wood' || job === 'stone')) return true
  const rule = jobToolRule(job)
  if (rule && !rule.bareHands && !rule.tools.includes(workToolFamily(tool)!)) return false
  return job !== 'iron' || getWorkToolTier(unit) >= 2
}
