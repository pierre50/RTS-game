import { getActionAnimationReleaseFrame } from '../../../lib/animations/actionFrameSequences'
import type { UnitEntity } from '../../../types/entities'
import { finishManualHeroWorkSwing } from '../UnitManualHeroWork'
export function getWorkAnimationReleaseFrame(unit: UnitEntity, impactFrame: number): number {
  return getActionAnimationReleaseFrame(unit, unit.action, impactFrame)
}

export function finishWorkSwing(
  unit: UnitEntity,
  impactFrame: number,
  animationReleaseFrame = getWorkAnimationReleaseFrame(unit, impactFrame)
): void {
  finishManualHeroWorkSwing(unit, impactFrame, animationReleaseFrame)
}
