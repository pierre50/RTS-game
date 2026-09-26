import { SHEET_TYPES } from '../../constants'

const UNIT_SHEET_FALLBACK_ANIMATION_SPEED: Record<string, number> = {
  [SHEET_TYPES.standing]: 0.2,
  [SHEET_TYPES.corpse]: 0,
}

export function getUnitSpritesheetAnimationSpeed(
  sheet: { data?: { animationSpeed?: number } } | null | undefined,
  sheetType?: string | null
): number {
  return sheet?.data?.animationSpeed ?? (sheetType ? UNIT_SHEET_FALLBACK_ANIMATION_SPEED[sheetType] : undefined) ?? 0.4
}

export function getAnimationCycleMs(frameCount: number, animationSpeed: number): number {
  return (frameCount / (Math.max(0.01, animationSpeed) * 60)) * 1000
}
