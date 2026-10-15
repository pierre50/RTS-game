import { SHEET_TYPES } from '../constants'
import { isUnitVisualAnimationCurrent, setUnitVisualSheet } from '../units/visuals/unitVisualTransition'
import { getUnitAnimation, type AnimationSnapshot } from '../../rendering/UnitAnimation'
import type { UnitEntity } from '../../types/entities'

const AUTOMATIC_PARRY_HOLD_FRAME = 2

type ParryVisualState = {
  animation: AnimationSnapshot
  sheet: string
}

const parryVisualStates = new WeakMap<UnitEntity, ParryVisualState>()

function stopPreviousParryVisual(unit: UnitEntity): void {
  const taskId = unit.automaticParryVisualTaskId
  if (taskId != null) unit.context?.scheduler?.remove?.(taskId)
  unit.automaticParryVisualTaskId = null
}

function captureParryVisualState(unit: UnitEntity): ParryVisualState | null {
  const existing = parryVisualStates.get(unit)
  if (existing) return existing
  const animation = getUnitAnimation(unit)
  if (!animation) return null
  return {
    animation: animation.captureSnapshot(),
    sheet: unit.currentSheet ?? SHEET_TYPES.standing,
  }
}

function restoreAutomaticParryVisual(unit: UnitEntity, token: number): void {
  const state = parryVisualStates.get(unit)
  if (!state || !isUnitVisualAnimationCurrent(unit, token)) return
  unit.automaticParryVisualTaskId = null
  unit.automaticParryVisualToken = null
  parryVisualStates.delete(unit)
  const animation = getUnitAnimation(unit)
  if (unit.isDead || unit.isDestroyed || !animation) return

  setUnitVisualSheet(unit, state.sheet, {
    clearCallbacks: false,
    frame: state.animation.frame,
    invalidateAnimation: false,
    loop: state.animation.loop,
    play: state.animation.playing ? 'play' : 'stop',
    syncMountedHorse: true,
  })
  animation.restoreCallbacks(state.animation)
}

export function showAutomaticParryVisual(unit: UnitEntity, durationMs: number): void {
  const animation = getUnitAnimation(unit)
  const scheduler = unit.context?.scheduler
  if (!animation || !scheduler?.addOneShot || unit.isDead || unit.isDestroyed) return
  if (unit.currentSheet === SHEET_TYPES.dying || unit.currentSheet === SHEET_TYPES.corpse) return

  const state = captureParryVisualState(unit)
  if (!state) return
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
