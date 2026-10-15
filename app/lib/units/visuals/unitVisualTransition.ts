import type { UnitEntity } from '../../../types/entities'
import { getUnitAnimation } from '../../../rendering/UnitAnimation'

type AnimationCallbackName = 'onComplete' | 'onFrameChange' | 'onLoop'

type UnitVisualTransitionOptions = {
  clearCallbacks?: boolean | AnimationCallbackName[]
  frame?: number
  invalidateAnimation?: boolean
  loop?: boolean
  play?: 'play' | 'stop' | 'preserve'
  syncLayers?: boolean
  syncMountedHorse?: boolean
  syncShadow?: boolean
}

function clearVisualCallbacks(unit: UnitEntity, callbacks: boolean | AnimationCallbackName[] = true): void {
  if (callbacks === false) return
  const animation = getUnitAnimation(unit)
  if (!animation) return
  const names = callbacks === true ? (['onComplete', 'onFrameChange', 'onLoop'] as const) : callbacks
  for (const name of names) {
    if (name === 'onComplete') animation.clearCompleteCallback()
    else if (name === 'onFrameChange') animation.clearFrameCallback()
    else animation.clearLoopCallback()
  }
}

function beginUnitVisualAnimation(unit: UnitEntity): number {
  unit.visualAnimationToken = (unit.visualAnimationToken ?? 0) + 1
  return unit.visualAnimationToken
}

export function isUnitVisualAnimationCurrent(unit: UnitEntity, token: number): boolean {
  return unit.visualAnimationToken === token
}

export function cancelUnitVisualAnimation(unit: UnitEntity, callbacks: boolean | AnimationCallbackName[] = true): void {
  beginUnitVisualAnimation(unit)
  clearVisualCallbacks(unit, callbacks)
}

export function setUnitVisualSheet(
  unit: UnitEntity,
  sheet: string,
  {
    clearCallbacks = true,
    frame,
    invalidateAnimation = true,
    loop,
    play = 'preserve',
    syncLayers = true,
    syncMountedHorse = false,
    syncShadow = true,
  }: UnitVisualTransitionOptions = {}
): number {
  const token = invalidateAnimation ? beginUnitVisualAnimation(unit) : (unit.visualAnimationToken ?? 0)
  unit.setTextures?.(sheet)
  clearVisualCallbacks(unit, clearCallbacks)
  const animation = getUnitAnimation(unit)
  if (loop !== undefined) animation?.setLoop(loop)

  if (frame !== undefined) {
    animation?.seek(frame, play === 'play')
  } else if (play === 'play') {
    animation?.play()
  } else if (play === 'stop') {
    animation?.stop()
  }

  if (syncMountedHorse) unit.syncMountedHorseSprite?.()
  if (syncLayers) unit.syncAppearanceLayers?.(sheet)
  if (syncShadow) unit.syncShadow?.()
  return token
}
