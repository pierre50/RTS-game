import { ACTION_TYPES, WORK_TYPES } from '../constants'

const TOOL_AXE_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 3, 1, 0, 0, 0, 0]
const TOOL_HAMMER_ACTION_FRAME_SEQUENCE = [5, 5, 4, 4, 1, 0, 0, 0, 0]
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
  work?: string | null
}

export function getActionFrameSequence(work: string | null | undefined, action?: string | null): number[] | null {
  if (!work || !action) return null
  return ACTION_FRAME_SEQUENCES[`${work}:${action}`] ?? null
}

export function getConfiguredActionFrameSequence(
  context: ActionFrameSequenceContext,
  explicitSequence?: number[] | null,
  { preferExplicit = false }: { preferExplicit?: boolean } = {}
): number[] | null {
  if (preferExplicit && explicitSequence?.length) return explicitSequence

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
  work: string | null | undefined,
  action: string | null | undefined,
  fallbackFrame: number
): number {
  const sequence = getActionFrameSequence(work, action)
  return sequence?.length ? sequence.length - 1 : fallbackFrame
}
