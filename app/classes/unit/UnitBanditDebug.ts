import { SHEET_TYPES } from '../../constants'
import { getInstanceDegree, isBanditUnit } from '../../lib'
import { getEntitySpaceGrid } from '../../lib/mapSpaces'
import type { UnitEntity } from '../../types/entities'

const BANDIT_STOP_DEBUG_THROTTLE_MS = 600
const BANDIT_DEBUG_STORAGE_KEY = 'rts.debug.banditMovement'
const banditStepDebugState = new WeakMap<
  UnitEntity,
  { stillTicks: number; x: number; y: number; lastReason?: string }
>()
let lastBanditStopDebugAt = 0

function isBanditMovementDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage?.getItem(BANDIT_DEBUG_STORAGE_KEY) === '1'
  }
  return Boolean((globalThis as { RTS_DEBUG_BANDIT_MOVEMENT?: boolean }).RTS_DEBUG_BANDIT_MOVEMENT)
}

function isBanditDebugUnit(unit: UnitEntity): boolean {
  return isBanditMovementDebugEnabled() && isBanditUnit(unit)
}

export function debugBanditStop(unit: UnitEntity, reason: string): void {
  if (!isBanditDebugUnit(unit)) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastBanditStopDebugAt < BANDIT_STOP_DEBUG_THROTTLE_MS) return
  lastBanditStopDebugAt = now
  const cell = unit.currentCell
  const occupant = cell?.has
  console.warn('[bandit-move]', reason, {
    unit: {
      label: unit.label,
      type: unit.type,
      action: unit.action,
      combatMode: unit.combatMode,
      currentSheet: unit.currentSheet,
      spritePlaying: unit.sprite?.playing,
      i: unit.i,
      j: unit.j,
      pathLength: unit.path?.length ?? 0,
    },
    currentCell: cell
      ? {
          i: cell.i,
          j: cell.j,
          solid: cell.solid,
          has: occupant
            ? {
                label: occupant.label,
                type: occupant.type,
                family: occupant.family,
                isDead: occupant.isDead,
                isDestroyed: occupant.isDestroyed,
                sameLabel: occupant.label === unit.label,
                sameObject: occupant === unit,
              }
            : null,
        }
      : null,
  })
}

function debugBanditStep(unit: UnitEntity, reason: string): void {
  if (!isBanditDebugUnit(unit)) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastBanditStopDebugAt < BANDIT_STOP_DEBUG_THROTTLE_MS) return
  lastBanditStopDebugAt = now
  const cell = unit.currentCell
  const next = unit.path?.at(-1)
  const grid = getEntitySpaceGrid(unit, unit.context?.map)
  const nextCell = next ? grid?.[next.i]?.[next.j] : null
  console.warn('[bandit-stuck]', reason, {
    unit: {
      label: unit.label,
      type: unit.type,
      name: unit.name,
      category: unit.category,
      owner: unit.owner?.label,
      ownerName: unit.owner?.name,
      action: unit.action,
      work: unit.work,
      combatMode: unit.combatMode,
      currentSheet: unit.currentSheet,
      spritePlaying: unit.sprite?.playing,
      inactif: unit.inactif,
      interval: (unit as { interval?: unknown }).interval,
      i: unit.i,
      j: unit.j,
      x: Math.round((unit.x ?? 0) * 100) / 100,
      y: Math.round((unit.y ?? 0) * 100) / 100,
      pathLength: unit.path?.length ?? 0,
    },
    currentCell: cell
      ? {
          i: cell.i,
          j: cell.j,
          solid: cell.solid,
          has: cell.has
            ? {
                label: cell.has.label,
                type: cell.has.type,
                family: cell.has.family,
                sameLabel: cell.has.label === unit.label,
                sameObject: cell.has === unit,
              }
            : null,
        }
      : null,
    nextCell: nextCell
      ? {
          i: nextCell.i,
          j: nextCell.j,
          solid: nextCell.solid,
          has: nextCell.has
            ? {
                label: nextCell.has.label,
                type: nextCell.has.type,
                family: nextCell.has.family,
                sameLabel: nextCell.has.label === unit.label,
                sameObject: nextCell.has === unit,
              }
            : null,
        }
      : null,
  })
}

export function watchBanditStep(unit: UnitEntity, beforeX: number, beforeY: number): void {
  if (!isBanditDebugUnit(unit)) {
    banditStepDebugState.delete(unit)
    return
  }
  const walking =
    unit.currentSheet === SHEET_TYPES.walking || Boolean(unit.sprite?.playing && (unit.path?.length ?? 0) > 0)
  if (!walking || unit.isDead || unit.isDestroyed) {
    banditStepDebugState.delete(unit)
    return
  }
  const pathLength = unit.path?.length ?? 0
  if (pathLength <= 0) {
    debugBanditStep(unit, 'walking-without-path')
    const dest = unit.dest
    if (unit.action && dest && unit.isUnitAtDest?.(unit.action, dest)) {
      unit.degree = getInstanceDegree(unit, dest.x, dest.y)
      unit.getAction?.(unit.action)
    } else {
      unit.stopInterval?.()
      unit.setTextures?.(SHEET_TYPES.standing)
      unit.sprite?.stop()
      unit.inactif = true
    }
    banditStepDebugState.delete(unit)
    return
  }
  const state = banditStepDebugState.get(unit) ?? { stillTicks: 0, x: beforeX, y: beforeY }
  const moved = Math.hypot((unit.x ?? 0) - beforeX, (unit.y ?? 0) - beforeY) > 0.01
  state.stillTicks = moved ? 0 : state.stillTicks + 1
  state.x = unit.x ?? beforeX
  state.y = unit.y ?? beforeY
  banditStepDebugState.set(unit, state)
  if (state.stillTicks >= 8) {
    debugBanditStep(unit, 'walking-no-position-progress')
    state.stillTicks = 0
  }
}
