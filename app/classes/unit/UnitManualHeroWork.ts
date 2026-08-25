import { isHeroControlled, isManualHeroActionReleased } from '../../lib/unitControl'
import { logHeroSlashFrame, playReverseSlashRecovery } from '../../lib/slashRecoveryAnimation'
import type { UnitEntity } from '../../types/entities'

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

function finishManualHeroWorkRecovery(unit: UnitEntity, releaseFrame: number): boolean {
  if (!isHeroControlled(unit)) return false
  const actionAtRelease = unit.action ?? null
  const destAtRelease = unit.dest
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
    },
    releaseFrame,
  })
  if (!handled) setActionSpriteLoop(unit, true)
  return handled
}

export function finishManualHeroWorkSwing(unit: UnitEntity, releaseFrame: number): void {
  if (finishManualHeroWorkRecovery(unit, releaseFrame)) return
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
