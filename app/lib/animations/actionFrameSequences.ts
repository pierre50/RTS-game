import { ACTION_TYPES, WORK_TYPES } from '../constants'

const TOOL_AXE_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]
const TOOL_HAMMER_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 1, 0, 0, 0, 0]
type ActionToolKind = 'axe' | 'hammer' | 'pickaxe'

const TOOL_ACTION_FRAME_SEQUENCES: Record<ActionToolKind, number[]> = {
  axe: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  hammer: TOOL_HAMMER_ACTION_FRAME_SEQUENCE,
  pickaxe: TOOL_AXE_ACTION_FRAME_SEQUENCE,
}

const ACTION = {
  build: ACTION_TYPES?.build ?? 'build',
  chopwood: ACTION_TYPES?.chopwood ?? 'chopwood',
  minecopper: ACTION_TYPES?.minecopper ?? 'minecopper',
  minegold: ACTION_TYPES?.minegold ?? 'minegold',
  mineiron: ACTION_TYPES?.mineiron ?? 'mineiron',
  minestone: ACTION_TYPES?.minestone ?? 'minestone',
}
const WORK = {
  builder: WORK_TYPES?.builder ?? 'builder',
  goldminer: WORK_TYPES?.goldminer ?? 'goldminer',
  stoneminer: WORK_TYPES?.stoneminer ?? 'stoneminer',
  woodcutter: WORK_TYPES?.woodcutter ?? 'woodcutter',
}

const ACTION_FRAME_SEQUENCES: Record<string, number[]> = {
  [`${WORK.builder}:${ACTION.build}`]: TOOL_HAMMER_ACTION_FRAME_SEQUENCE,
  [`${WORK.goldminer}:${ACTION.minecopper}`]: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  [`${WORK.goldminer}:${ACTION.minegold}`]: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  [`${WORK.goldminer}:${ACTION.mineiron}`]: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  [`${WORK.stoneminer}:${ACTION.minestone}`]: TOOL_AXE_ACTION_FRAME_SEQUENCE,
  [`${WORK.woodcutter}:${ACTION.chopwood}`]: TOOL_AXE_ACTION_FRAME_SEQUENCE,
}

type ActionFrameSequenceContext = {
  action?: string | null
  actionFrameSequence?: number[] | null
  equipment?: string[] | null
  inventory?: {
    activeWeapons?: Partial<Record<string, string>>
    equipped?: Partial<Record<string, string>>
  } | null
  owner?: { age?: number | null } | null
  work?: string | null
}

function getActionToolKindForEquipment(equipment: string | null | undefined): ActionToolKind | null {
  if (!equipment) return null
  if (equipment === 'axe' || equipment.startsWith('axe_')) return 'axe'
  if (equipment === 'hammer' || equipment.startsWith('hammer_')) return 'hammer'
  if (equipment === 'pickaxe' || equipment.startsWith('pickaxe_')) return 'pickaxe'
  return null
}

function getHeroActiveWeaponEquipment(context: ActionFrameSequenceContext): string[] {
  const activeWeapons = context.inventory?.activeWeapons ?? {}
  const equipped = context.inventory?.equipped ?? {}
  if (context.work === 'heroSword') {
    return [activeWeapons.melee, activeWeapons.offhand, equipped.offhand].filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    )
  }
  if (context.work === (WORK_TYPES?.hunter ?? 'hunter')) {
    return [activeWeapons.ranged, activeWeapons.quiver, equipped.arrow].filter(
      (item): item is string => typeof item === 'string' && item.length > 0
    )
  }
  return [activeWeapons.lasso].filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function getContextActionEquipment(context: ActionFrameSequenceContext): string[] {
  if (Array.isArray(context.equipment) && context.equipment.length) return context.equipment

  const heroActiveEquipment = getHeroActiveWeaponEquipment(context)
  if (heroActiveEquipment.length) return heroActiveEquipment

  return []
}

function getActionToolKind(context: ActionFrameSequenceContext): ActionToolKind | null {
  for (const equipment of getContextActionEquipment(context)) {
    const kind = getActionToolKindForEquipment(equipment)
    if (kind) return kind
  }
  if (context.work === WORK.builder) return 'hammer'
  if (context.work === WORK.woodcutter) return 'axe'
  if (context.work === WORK.stoneminer || context.work === WORK.goldminer) return 'pickaxe'
  return null
}

function getActionFrameSequence(work: string | null | undefined, action?: string | null): number[] | null {
  if (!work || !action) return null
  return ACTION_FRAME_SEQUENCES[`${work}:${action}`] ?? null
}

export function getConfiguredActionFrameSequence(
  context: ActionFrameSequenceContext,
  explicitSequence?: number[] | null,
  { preferExplicit = false }: { preferExplicit?: boolean } = {}
): number[] | null {
  if (preferExplicit && explicitSequence?.length) return explicitSequence

  const toolKind = getActionToolKind(context)
  if (context.action && toolKind) return TOOL_ACTION_FRAME_SEQUENCES[toolKind]

  const hasWorkActionContext = context.work !== undefined && context.action !== undefined
  if (hasWorkActionContext) {
    return getActionFrameSequence(context.work, context.action) ?? explicitSequence ?? null
  }

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
      : getActionFrameSequence(workOrContext, action)
  return sequence?.length ? sequence.length - 1 : fallbackFrame
}
