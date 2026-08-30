import type { UnitEntity } from '../../types/entities'

type SpriteCallbackName = 'onComplete' | 'onFrameChange' | 'onLoop'

type UnitVisualTransitionOptions = {
  clearCallbacks?: boolean | SpriteCallbackName[]
  frame?: number
  invalidateAnimation?: boolean
  loop?: boolean
  play?: 'play' | 'stop' | 'preserve'
  syncLayers?: boolean
  syncMountedHorse?: boolean
  syncShadow?: boolean
}

function clearSpriteCallbacks(unit: UnitEntity, callbacks: boolean | SpriteCallbackName[] = true): void {
  if (!unit.sprite || callbacks === false) return
  const names = callbacks === true ? (['onComplete', 'onFrameChange', 'onLoop'] as const) : callbacks
  for (const name of names) {
    unit.sprite[name] = undefined
  }
}

function beginUnitVisualAnimation(unit: UnitEntity): number {
  unit.visualAnimationToken = (unit.visualAnimationToken ?? 0) + 1
  return unit.visualAnimationToken
}

export function isUnitVisualAnimationCurrent(unit: UnitEntity, token: number): boolean {
  return unit.visualAnimationToken === token
}

export function cancelUnitVisualAnimation(unit: UnitEntity, callbacks: boolean | SpriteCallbackName[] = true): void {
  beginUnitVisualAnimation(unit)
  clearSpriteCallbacks(unit, callbacks)
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
  clearSpriteCallbacks(unit, clearCallbacks)
  if (unit.sprite && loop !== undefined) unit.sprite.loop = loop

  if (unit.sprite && frame !== undefined) {
    if (play === 'play') unit.sprite.gotoAndPlay?.(frame)
    else unit.sprite.gotoAndStop?.(frame)
  } else if (unit.sprite && play === 'play') {
    unit.sprite.play?.()
  } else if (unit.sprite && play === 'stop') {
    unit.sprite.stop?.()
  }

  if (syncMountedHorse) unit.syncMountedHorseSprite?.()
  if (syncLayers) unit.syncAppearanceLayers?.(sheet)
  if (syncShadow) unit.syncShadow?.()
  return token
}
