import { hasNpcWeaponInventory, getNpcWeaponChoice } from '../units/combat/npcWeapons'
import type { UnitEntity } from '../../types/entities'

const TOOL_AXE_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]
const TOOL_HAMMER_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 1, 0, 0, 0, 0]
const TOOL_DEFENSE_FRAME_SEQUENCE = [0, 1, 2, 3, 4, 5]
const TOOL_COMBAT_FRAME_SEQUENCE = [5, 5, 4, 3, 1, 0]
// Source pose 1 is the contact; pose 0 completes the follow-through.
const TOOL_COMBAT_IMPACT_FRAME = 4
type ActionToolKind = 'axe' | 'hammer' | 'pickaxe' | 'scythe'

const TOOL_ACTION_FRAME_SEQUENCES: Record<ActionToolKind, number[]> = {
  axe: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  hammer: TOOL_HAMMER_ACTION_FRAME_SEQUENCE,
  pickaxe: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  scythe: [0, 1, 2, 3, 4, 5],
}

// Only contexts without runtime equipment (for example economy estimates) use
// a work-to-equipment fallback. Combat uses a shorter cycle of the same tool poses.
const WORK_EQUIPMENT: Record<string, string> = {
  builder: 'hammer',
  woodcutter: 'axe',
  stoneminer: 'pickaxe',
  goldminer: 'pickaxe',
  farmer: 'scythe',
}

type ActionFrameSequenceContext = {
  heroDefenseActive?: boolean
  heroDefenseReverseTaskId?: number | null
  heroDefenseReleaseFallbackTaskId?: number | null
  action?: string | null
  actionFrameSequence?: number[] | null
  equipment?: string[] | null
  inventory?: {
    toolsStowed?: boolean
    activeWeapons?: Partial<Record<string, string>>
    equipped?: Partial<Record<string, string>>
  } | null
  work?: string | null
}

function getActionToolKindForEquipment(equipment: string | null | undefined): ActionToolKind | null {
  if (!equipment) return null
  if (equipment === 'axe' || equipment.startsWith('axe_')) return 'axe'
  if (equipment === 'hammer' || equipment.startsWith('hammer_')) return 'hammer'
  if (equipment === 'pickaxe' || equipment.startsWith('pickaxe_')) return 'pickaxe'
  if (equipment === 'scythe' || equipment.startsWith('scythe_')) return 'scythe'
  return null
}

function getContextActionEquipment(context: ActionFrameSequenceContext): string[] | null {
  const unit = context as UnitEntity
  if (context.action === 'attack' && hasNpcWeaponInventory(unit)) {
    const weapon = getNpcWeaponChoice(unit).weapon
    return weapon ? [weapon] : []
  }
  const inventory = context.inventory
  if (inventory?.activeWeapons) {
    const active = inventory.activeWeapons
    const weapon =
      context.work === 'heroSword'
        ? active.melee
        : context.work === 'hunter'
          ? active.ranged
          : inventory.toolsStowed
            ? undefined
            : active.tool
    // An empty selected slot is authoritative; do not resurrect a previous tool.
    return weapon ? [weapon] : []
  }
  if (context.equipment?.length) return context.equipment
  return null
}

export function getConfiguredActionFrameSequence(
  context: ActionFrameSequenceContext,
  explicitSequence?: number[] | null,
  { preferExplicit = false }: { preferExplicit?: boolean } = {}
): number[] | null {
  if (preferExplicit && explicitSequence?.length) return explicitSequence
  const equipment = getContextActionEquipment(context)
  const candidates = equipment ?? [WORK_EQUIPMENT[context.work ?? '']]
  for (const item of candidates) {
    const kind = getActionToolKindForEquipment(item)
    if (kind) {
      // Guard uses the original slash pose 2, including its reverse release.
      if (
        context.heroDefenseActive ||
        context.heroDefenseReverseTaskId != null ||
        context.heroDefenseReleaseFallbackTaskId != null
      )
        return TOOL_DEFENSE_FRAME_SEQUENCE
      if (context.action === 'attack' && kind !== 'scythe') return TOOL_COMBAT_FRAME_SEQUENCE
      return TOOL_ACTION_FRAME_SEQUENCES[kind]
    }
  }
  if (equipment !== null || context.work !== undefined) return explicitSequence ?? null
  return explicitSequence ?? context.actionFrameSequence ?? null
}

export function hasConfiguredActionFrameSequence(
  context: ActionFrameSequenceContext,
  explicitSequence?: number[] | null,
  options?: { preferExplicit?: boolean }
): boolean {
  return Boolean(getConfiguredActionFrameSequence(context, explicitSequence, options)?.length)
}

export function applyActionFrameSequence<T>(frames: T[], sequence?: number[] | null): T[] {
  if (!sequence?.length) return frames
  const maxFrame = Math.max(frames.length - 1, 0)
  return sequence.map(frame => frames[Math.min(frame, maxFrame)])
}

export function getActionAnimationReleaseFrame(
  workOrContext: string | ActionFrameSequenceContext | null | undefined,
  action: string | null | undefined,
  fallbackFrame: number
): number {
  const sequence =
    typeof workOrContext === 'object' && workOrContext !== null
      ? getConfiguredActionFrameSequence(workOrContext)
      : getConfiguredActionFrameSequence({ work: workOrContext, action })
  if (sequence === TOOL_COMBAT_FRAME_SEQUENCE) return TOOL_COMBAT_IMPACT_FRAME
  return sequence?.length ? sequence.length - 1 : fallbackFrame
}
