import { notifyVillageStateChanged } from '../../lib/units/village/villageStateEvents'
import type { RuntimeCell } from '../../types/map'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { syncUnitSittingPose } from '../../lib/units/visuals/unitSittingPose'

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

  if (unit.dest !== dest) notifyVillageStateChanged(unit.owner)
  unit.handleSetDest?.(dest, unit)
  unit.dest = dest
  unit.realDest = {
    i: dest.i,
    j: dest.j,
    x: dest.x,
    y: dest.y,
    label: isEntityDestination(dest) ? dest.label : '',
  }
  syncUnitSittingPose(unit)
}

export function queueUnitPendingOrder(
  unit: UnitOrderHost,
  orderOrDest: (() => void) | RuntimeEntity | RuntimeCell,
  action: string | null = null
): boolean {
  if (typeof orderOrDest === 'function') {
    unit.pendingOrder = { execute: orderOrDest }
    syncUnitSittingPose(unit)
    return true
  }

  const dest = orderOrDest
  if (!dest || isDestroyedDestination(dest)) return false
  unit.pendingOrder = { dest, action }
  syncUnitSittingPose(unit)
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
