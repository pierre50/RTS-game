import { isHeroControlled, isManualHeroActionReleased } from '../../lib/units/unitControl'
import { onSpriteLoopAtFrame } from '../../lib/graphics'
import { logHeroSlashFrame, playReverseSlashRecovery } from '../../lib/entities/slashRecoveryAnimation'
import { hasConfiguredActionFrameSequence } from '../../lib/animations/actionFrameSequences'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'

type ManualHeroWorkContext = {
  action: string | null
  dest: RuntimeEntity | RuntimeCell | null | undefined
}

export function stopManualHeroAction(unit: UnitEntity): void {
  unit.previousDest = null
  unit.stop?.()
}

function stopManualHeroActionAfterLoop(unit: UnitEntity): void {
  const sprite = unit.sprite
  if (!sprite) {
    stopManualHeroAction(unit)
    return
  }
  sprite.onLoop = () => {
    sprite.onLoop = undefined
    unit.actionLocked = false
    stopManualHeroAction(unit)
  }
}

export function lockManualHeroAction(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.actionLocked = true
}

export function restartManualHeroActionAnimation(unit: UnitEntity): void {
  if (!isHeroControlled(unit)) return
  unit.sprite?.gotoAndPlay?.(0)
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
  if (!unit.getActionCondition?.(destAtRelease, actionAtRelease)) {
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
  const sprite = unit.sprite
  if (sprite) {
    sprite.onFrameChange = undefined
    sprite.onLoop = undefined
  }
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
  if (unit.sprite) {
    unit.sprite.onFrameChange = undefined
    unit.sprite.onLoop = undefined
  }
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
  const hasCustomActionFrameSequence = hasConfiguredActionFrameSequence(
    unit,
    unit.actionFrameSequence,
    { preferExplicit: true }
  )
  const shouldSkipReverseRecovery = hasCustomActionFrameSequence && animationReleaseFrame >= releaseFrame
  const sprite = unit.sprite
  const currentFrame = Math.floor(sprite?.currentFrame ?? releaseFrame)
  if (isHeroControlled(unit) && sprite && targetReleaseFrame > currentFrame) {
    let released = false
    const finishAtVisualRelease = () => {
      if (released) return
      released = true
      sprite.onLoop = undefined
      if (shouldSkipReverseRecovery) {
        resumeOrStopManualHeroWork(unit, context)
        return
      }
      if (finishManualHeroWorkRecovery(unit, targetReleaseFrame, context)) return
      if (isManualHeroActionReleased(unit)) stopManualHeroActionAfterLoop(unit)
    }
    sprite.onLoop = finishAtVisualRelease
    onSpriteLoopAtFrame(sprite, targetReleaseFrame, () =>
      finishAtVisualRelease()
    )
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
  if (unit.sprite) unit.sprite.loop = loop
  if (unit.shadow) unit.shadow.loop = loop
  const layers = (unit as UnitEntity & { appearanceLayerSprites?: Map<number, { loop: boolean }> })
    .appearanceLayerSprites
  for (const sprite of layers?.values() ?? []) {
    sprite.loop = loop
  }
}
