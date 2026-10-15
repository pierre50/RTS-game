import { isHeroControlled, isManualHeroActionReleased } from '../../lib/units/unitControl'
import { getUnitAnimation } from '../../rendering/UnitAnimation'
import { logHeroSlashFrame, playReverseSlashRecovery } from '../../lib/entities/slashRecoveryAnimation'
import { hasConfiguredActionFrameSequence } from '../../lib/animations/actionFrameSequences'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { canHeroStrikeLockedMine } from '../../lib/resources/ironMining'

type ManualHeroWorkContext = {
  action: string | null
  dest: RuntimeEntity | RuntimeCell | null | undefined
}

export function stopManualHeroAction(unit: UnitEntity): void {
  unit.previousDest = null
  unit.stop?.()
}

function stopManualHeroActionAfterLoop(unit: UnitEntity): void {
  const animation = getUnitAnimation(unit)
  if (!animation) {
    stopManualHeroAction(unit)
    return
  }
  animation.onLoop(() => {
    animation.clearLoopCallback()
    unit.actionLocked = false
    stopManualHeroAction(unit)
  })
}

export function lockManualHeroAction(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.actionLocked = true
}

export function restartManualHeroActionAnimation(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  getUnitAnimation(unit)?.restart()
}

function resumeManualHeroWorkAction(
  unit: UnitEntity,
  actionAtRelease: string | null,
  destAtRelease: RuntimeEntity | RuntimeCell | null | undefined
): void {
  if (!actionAtRelease || unit.isDead || unit.isDestroyed) return
  if (isManualHeroActionReleased(unit)) {
    stopManualHeroAction(unit)
    return
  }
  if (unit.action !== actionAtRelease || unit.dest !== destAtRelease) return
  if (
    !unit.getActionCondition?.(destAtRelease, actionAtRelease) &&
    !canHeroStrikeLockedMine(
      unit,
      destAtRelease && 'type' in destAtRelease ? (destAtRelease as RuntimeEntity) : null,
      actionAtRelease
    )
  ) {
    unit.affectNewDest?.()
    return
  }
  logHeroSlashFrame(unit, 'manual:resume-action', { actionAtRelease })
  unit.getAction?.(actionAtRelease)
}

function finishManualHeroWorkRecovery(
  unit: UnitEntity,
  releaseFrame: number,
  context: ManualHeroWorkContext = {
    action: unit.action ?? null,
    dest: unit.dest,
  }
): boolean {
  if (!isHeroControlled(unit)) return false
  const actionAtRelease = context.action
  const destAtRelease = context.dest
  getUnitAnimation(unit)?.clearCallbacks()
  setActionSpriteLoop(unit, false)
  const handled = playReverseSlashRecovery(unit, {
    onComplete: () => {
      setActionSpriteLoop(unit, true)
      unit.actionLocked = false
      resumeManualHeroWorkAction(unit, actionAtRelease, destAtRelease)
    },
    releaseFrame,
  })
  if (!handled) setActionSpriteLoop(unit, true)
  return handled
}

function resumeOrStopManualHeroWork(unit: UnitEntity, context: ManualHeroWorkContext): void {
  const actionAtRelease = context.action
  const destAtRelease = context.dest
  getUnitAnimation(unit)?.clearCallbacks()
  setActionSpriteLoop(unit, true)
  unit.actionLocked = false
  resumeManualHeroWorkAction(unit, actionAtRelease, destAtRelease)
}

export function finishManualHeroWorkSwing(
  unit: UnitEntity,
  releaseFrame: number,
  animationReleaseFrame = releaseFrame,
  context: ManualHeroWorkContext = {
    action: unit.action ?? null,
    dest: unit.dest,
  }
): void {
  const targetReleaseFrame = Math.max(releaseFrame, animationReleaseFrame)
  const hasCustomActionFrameSequence = hasConfiguredActionFrameSequence(unit, unit.actionFrameSequence, {
    preferExplicit: true,
  })
  const shouldSkipReverseRecovery = hasCustomActionFrameSequence && animationReleaseFrame >= releaseFrame
  const animation = getUnitAnimation(unit)
  const currentFrame = Math.floor(animation?.currentFrame ?? releaseFrame)
  if (isHeroControlled(unit) && animation && targetReleaseFrame > currentFrame) {
    let released = false
    const finishAtVisualRelease = () => {
      if (released) return
      released = true
      animation.clearLoopCallback()
      if (shouldSkipReverseRecovery) {
        resumeOrStopManualHeroWork(unit, context)
        return
      }
      if (finishManualHeroWorkRecovery(unit, targetReleaseFrame, context)) return
      if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
    }
    animation.onLoop(finishAtVisualRelease)
    animation.onFrameEachLoop(targetReleaseFrame, () => finishAtVisualRelease())
    return
  }
  if (shouldSkipReverseRecovery) {
    resumeOrStopManualHeroWork(unit, context)
    return
  }
  if (finishManualHeroWorkRecovery(unit, targetReleaseFrame, context)) return
  if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
}

export function setActionSpriteLoop(unit: UnitEntity, loop: boolean): void {
  getUnitAnimation(unit)?.setLoop(loop)
}
