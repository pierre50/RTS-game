import { ACTION_TYPES, WORK_TYPES } from '../../../constants'
import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

const HUNT_RANGE_DEBUG_THROTTLE_MS = 250
const DIRECT_MOVE_DEBUG_THROTTLE_MS = 250
const MOVEMENT_DEBUG_STORAGE_KEY = 'rts.debug.unitMovement'
const HUNT_RANGE_DEBUG_STORAGE_KEY = 'rts.debug.huntRange'
let lastHuntRangeDebugAt = 0
let lastDirectMoveDebugAt = 0
const lastCombatMoveDebugAt = new Map<string, number>()

export type DirectMoveDebugSnapshot = {
  at: number
  reason: string
  details: Record<string, unknown>
  dir: { x: number; y: number }
  unit: {
    label?: string
    type?: string
    controlMode?: string
    i: number
    j: number
    x: number
    y: number
    currentCell?: {
      i?: number
      j?: number
      solid?: boolean
      waterBorder?: boolean
      border?: boolean
      category?: string
      has?: { family?: string; type?: string; label?: string } | null
    }
  }
}

let lastDirectMoveDebugSnapshot: DirectMoveDebugSnapshot | null = null

export function serializeDirectMoveDebugCell(cell: RuntimeCell | null | undefined, unit?: UnitEntity): Record<string, unknown> | null {
  if (!cell) return null
  return {
    i: cell.i,
    j: cell.j,
    solid: cell.solid,
    waterBorder: cell.waterBorder,
    border: cell.border,
    category: cell.category,
    has: cell.has
      ? {
          family: cell.has.family,
          type: cell.has.type,
          label: cell.has.label,
          sameObject: unit ? cell.has === unit : undefined,
        }
      : null,
  }
}

export function isMovementDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage?.getItem(MOVEMENT_DEBUG_STORAGE_KEY) === '1'
  }
  return Boolean((globalThis as { RTS_DEBUG_UNIT_MOVEMENT?: boolean }).RTS_DEBUG_UNIT_MOVEMENT)
}

export function setMovementDebugEnabled(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem(MOVEMENT_DEBUG_STORAGE_KEY, enabled ? '1' : '0')
  } else {
    ;(globalThis as { RTS_DEBUG_UNIT_MOVEMENT?: boolean }).RTS_DEBUG_UNIT_MOVEMENT = enabled
  }
}

export function getLastDirectMoveDebugSnapshot(): DirectMoveDebugSnapshot | null {
  return lastDirectMoveDebugSnapshot
}

function createDirectMoveDebugSnapshot(
  unit: UnitEntity,
  reason: string,
  details: Record<string, unknown>,
  dirX: number,
  dirY: number
): DirectMoveDebugSnapshot {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return {
    at: now,
    reason,
    details,
    dir: {
      x: Math.round(dirX * 1000) / 1000,
      y: Math.round(dirY * 1000) / 1000,
    },
    unit: {
      label: unit.label,
      type: unit.type,
      controlMode: unit.controlMode,
      i: unit.i,
      j: unit.j,
      x: Math.round((unit.x ?? 0) * 100) / 100,
      y: Math.round((unit.y ?? 0) * 100) / 100,
      currentCell: serializeDirectMoveDebugCell(unit.currentCell) ?? undefined,
    },
  }
}

export function debugDirectMoveProbe(
  unit: UnitEntity,
  reason: string,
  details: Record<string, unknown>,
  dirX: number,
  dirY: number
): void {
  if (!isMovementDebugEnabled()) return
  const snapshot = createDirectMoveDebugSnapshot(unit, reason, details, dirX, dirY)
  lastDirectMoveDebugSnapshot = snapshot
  if (snapshot.at - lastDirectMoveDebugAt < DIRECT_MOVE_DEBUG_THROTTLE_MS) return
  lastDirectMoveDebugAt = snapshot.at
  console.debug('[direct-move-probe]', snapshot)
}

function isHuntRangeDebugEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return window.localStorage?.getItem(HUNT_RANGE_DEBUG_STORAGE_KEY) === '1'
  }
  return Boolean((globalThis as { RTS_DEBUG_HUNT_RANGE?: boolean }).RTS_DEBUG_HUNT_RANGE)
}

function isRuntimeEntity(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

function isBanditDebugUnit(unit: UnitEntity): boolean {
  if (!isMovementDebugEnabled()) return false
  const type = unit.type?.toLowerCase() ?? ''
  const name = unit.name?.toLowerCase() ?? ''
  const category = unit.category?.toLowerCase() ?? ''
  const ownerName = unit.owner?.name?.toLowerCase() ?? ''
  const ownerLabel = unit.owner?.label?.toLowerCase() ?? ''
  return (
    category.includes('bandit') ||
    type.includes('bandit') ||
    name.includes('bandit') ||
    ownerName.includes('bandit') ||
    ownerLabel.includes('bandit')
  )
}

export function debugHuntRangeCheck(
  unit: UnitEntity,
  action: string | null | undefined,
  dest: RuntimeEntity | RuntimeCell,
  effectiveRange: number | undefined,
  distance: number
): void {
  if (!isHuntRangeDebugEnabled() || action !== ACTION_TYPES.hunt || !effectiveRange) return
  const now = Date.now()
  if (now - lastHuntRangeDebugAt < HUNT_RANGE_DEBUG_THROTTLE_MS) return
  lastHuntRangeDebugAt = now
  console.debug('[villager-hunt-range]', {
    unitLabel: unit.label,
    action,
    work: unit.work,
    ownerAge: unit.owner?.age ?? 0,
    targetType: isRuntimeEntity(dest) ? dest.type : 'cell',
    targetLabel: isRuntimeEntity(dest) ? dest.label : undefined,
    rangeCells: effectiveRange,
    distanceToTarget: Number(distance.toFixed(2)),
    inRange: distance <= effectiveRange,
  })
}

function shouldDebugCombatMove(unit: UnitEntity): boolean {
  return Boolean(
    isBanditDebugUnit(unit) ||
      (isMovementDebugEnabled() &&
        (unit.combatMode ||
          unit.action === ACTION_TYPES.attack ||
          unit.waitingForEnergyAction === ACTION_TYPES.attack ||
          (typeof WORK_TYPES.attacker === 'string' && unit.work === WORK_TYPES.attacker)))
  )
}

export function debugCombatMove(
  unit: UnitEntity,
  reason: string,
  cell: RuntimeCell,
  details: Record<string, unknown> = {}
): void {
  if (!shouldDebugCombatMove(unit)) return
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const key = unit.label ?? `${unit.type ?? 'unit'}:${unit.i},${unit.j}`
  const last = lastCombatMoveDebugAt.get(key) ?? 0
  if (now - last < 600) return
  lastCombatMoveDebugAt.set(key, now)
  const occupant = cell.has
  const dest = unit.dest as Partial<RuntimeEntity | RuntimeCell> | null | undefined
  console.warn(isBanditDebugUnit(unit) ? '[bandit-move]' : '[combat-move]', reason, {
    unit: {
      label: unit.label,
      type: unit.type,
      category: unit.category,
      owner: unit.owner?.label,
      ownerName: unit.owner?.name,
      action: unit.action,
      combatMode: unit.combatMode,
      waitingForEnergyAction: unit.waitingForEnergyAction,
      currentSheet: unit.currentSheet,
      spritePlaying: unit.sprite?.playing,
      i: unit.i,
      j: unit.j,
      x: Math.round((unit.x ?? 0) * 100) / 100,
      y: Math.round((unit.y ?? 0) * 100) / 100,
    },
    cell: {
      i: cell.i,
      j: cell.j,
      solid: cell.solid,
      category: cell.category,
      has: occupant
        ? {
            label: occupant.label,
            type: occupant.type,
            family: occupant.family,
            isDestroyed: occupant.isDestroyed,
            isDead: occupant.isDead,
            sameLabel: occupant.label === unit.label,
            sameObject: occupant === unit,
          }
        : null,
    },
    dest: dest
      ? {
          label: 'label' in dest ? dest.label : undefined,
          type: 'type' in dest ? dest.type : undefined,
          family: 'family' in dest ? dest.family : undefined,
          i: dest.i,
          j: dest.j,
          solid: 'solid' in dest ? dest.solid : undefined,
        }
      : null,
    pathLength: unit.path?.length ?? 0,
    ...details,
  })
}

export function debugBlockedDirectMove(
  unit: UnitEntity,
  reason: string,
  details: Record<string, unknown>,
  dirX: number,
  dirY: number
): void {
  lastDirectMoveDebugSnapshot = createDirectMoveDebugSnapshot(unit, reason, details, dirX, dirY)
  if (!isMovementDebugEnabled()) return
  if (lastDirectMoveDebugSnapshot.at - lastDirectMoveDebugAt < DIRECT_MOVE_DEBUG_THROTTLE_MS) return
  lastDirectMoveDebugAt = lastDirectMoveDebugSnapshot.at
  console.debug('[direct-move-blocked]', lastDirectMoveDebugSnapshot)
}
