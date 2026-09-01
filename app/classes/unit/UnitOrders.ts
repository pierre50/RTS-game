import type { RuntimeCell } from '../../types/map'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

type UnitOrderHost = UnitEntity & {
  stop: () => void
  sendToEvt: NonNullable<UnitEntity['sendToEvt']>
}

function isEntityDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): dest is RuntimeEntity {
  return Boolean(dest && 'label' in dest)
}

function isDestroyedDestination(dest: RuntimeEntity | RuntimeCell | null | undefined): boolean {
  return isEntityDestination(dest) && Boolean(dest.isDestroyed)
}

export function setUnitDestination(unit: UnitOrderHost, dest: RuntimeEntity | RuntimeCell | null): void {
  if (!dest || isDestroyedDestination(dest)) {
    unit.stop()
    return
  }

  unit.handleSetDest?.(dest, unit)
  unit.dest = dest
  unit.realDest = {
    i: dest.i,
    j: dest.j,
    x: dest.x,
    y: dest.y,
    label: isEntityDestination(dest) ? dest.label : '',
  }
}

export function queueUnitPendingOrder(
  unit: UnitOrderHost,
  orderOrDest: (() => void) | RuntimeEntity | RuntimeCell,
  action: string | null = null,
): boolean {
  if (typeof orderOrDest === 'function') {
    unit.pendingOrder = { execute: orderOrDest }
    return true
  }

  const dest = orderOrDest
  if (!dest || isDestroyedDestination(dest)) return false
  unit.pendingOrder = { dest, action }
  return true
}

export function flushUnitPendingOrder(unit: UnitOrderHost): boolean {
  if (!unit.pendingOrder || unit.isDead) return false

  const pendingOrder = unit.pendingOrder
  unit.pendingOrder = null
  if (typeof pendingOrder.execute === 'function') {
    pendingOrder.execute()
    return true
  }

  const { dest, action } = pendingOrder
  if (!dest || isDestroyedDestination(dest)) return false
  unit.sendToEvt(dest, action ?? null)
  return true
}

export function handleUnitChangeDest(unit: UnitEntity): void {
  const dest = unit.dest
  if (dest && 'isUsedBy' in dest && dest.isUsedBy === unit) {
    dest.isUsedBy = null
  }
}
