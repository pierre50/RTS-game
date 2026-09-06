import { SHEET_TYPES } from '../constants'
import { isUnitVisualAnimationCurrent, setUnitVisualSheet } from '../units/unitVisualTransition'
import type { UnitEntity } from '../../types/entities'

const AUTOMATIC_PARRY_HOLD_FRAME = 2

type SpriteCallbackName = 'onComplete' | 'onFrameChange' | 'onLoop'
type ParrySprite = NonNullable<UnitEntity['sprite']>
type ParryVisualState = {
  frame: number
  loop?: boolean
  playing: boolean
  sheet: string
  callbacks: Partial<Pick<ParrySprite, SpriteCallbackName>>
}

const parryVisualStates = new WeakMap<UnitEntity, ParryVisualState>()

function stopPreviousParryVisual(unit: UnitEntity): void {
  const taskId = unit.automaticParryVisualTaskId
  if (taskId != null) unit.context?.scheduler?.remove?.(taskId)
  unit.automaticParryVisualTaskId = null
}

function captureParryVisualState(unit: UnitEntity, sprite: ParrySprite): ParryVisualState {
  const existing = parryVisualStates.get(unit)
  if (existing) return existing
  return {
    callbacks: {
      onComplete: sprite.onComplete,
      onFrameChange: sprite.onFrameChange,
      onLoop: sprite.onLoop,
    },
    frame: Math.max(0, Math.floor(sprite.currentFrame ?? 0)),
    loop: sprite.loop,
    playing: Boolean(sprite.playing),
    sheet: unit.currentSheet ?? SHEET_TYPES.standing,
  }
}

function restoreSpriteCallbacks(sprite: ParrySprite, state: ParryVisualState): void {
  sprite.onComplete = state.callbacks.onComplete
  sprite.onFrameChange = state.callbacks.onFrameChange
  sprite.onLoop = state.callbacks.onLoop
}

function restoreAutomaticParryVisual(unit: UnitEntity, token: number): void {
  const state = parryVisualStates.get(unit)
  if (!state || !isUnitVisualAnimationCurrent(unit, token)) return
  unit.automaticParryVisualTaskId = null
  unit.automaticParryVisualToken = null
  parryVisualStates.delete(unit)
  if (unit.isDead || unit.isDestroyed || !unit.sprite) return

  setUnitVisualSheet(unit, state.sheet, {
    clearCallbacks: false,
    frame: state.frame,
    invalidateAnimation: false,
    loop: state.loop,
    play: state.playing ? 'play' : 'stop',
    syncMountedHorse: true,
  })
  restoreSpriteCallbacks(unit.sprite, state)
}

export function showAutomaticParryVisual(unit: UnitEntity, durationMs: number): void {
  const sprite = unit.sprite
  const scheduler = unit.context?.scheduler
  if (!sprite || !scheduler?.addOneShot || unit.isDead || unit.isDestroyed) return
  if (unit.currentSheet === SHEET_TYPES.dying || unit.currentSheet === SHEET_TYPES.corpse) return

  const state = captureParryVisualState(unit, sprite)
  parryVisualStates.set(unit, state)
  stopPreviousParryVisual(unit)
  const token = setUnitVisualSheet(unit, SHEET_TYPES.action, {
    clearCallbacks: false,
    frame: AUTOMATIC_PARRY_HOLD_FRAME,
    loop: false,
    play: 'stop',
    syncMountedHorse: true,
  })
  unit.automaticParryVisualToken = token
  unit.automaticParryVisualTaskId = scheduler.addOneShot(
    () => restoreAutomaticParryVisual(unit, token),
    durationMs,
    'combat.automaticParryVisual'
  )
}
