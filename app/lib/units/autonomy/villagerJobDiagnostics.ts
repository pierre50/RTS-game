import type { RuntimeEntity, UnitEntity } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

function targetSnapshot(target: RuntimeEntity | RuntimeCell | null | undefined): object | null {
  if (!target) return null
  return {
    action: 'action' in target ? (target.action ?? null) : undefined,
    destroyed: 'isDestroyed' in target ? Boolean(target.isDestroyed) : undefined,
    i: target.i,
    j: target.j,
    label: 'label' in target ? (target.label ?? null) : null,
    quantity: 'quantity' in target ? (target.quantity ?? null) : undefined,
    solid: 'solid' in target ? Boolean(target.solid) : undefined,
    type: 'type' in target ? (target.type ?? null) : null,
  }
}

/** One snapshot per stationary-walking episode, called by the runtime monitor. */
export function logStationaryVillager(unit: UnitEntity): void {
  if (typeof window === 'undefined') return
  const next = unit.path?.[unit.path.length - 1]
  console.warn('[villager-stalled-walk]', {
    unit: unit.label,
    position: { i: unit.i, j: unit.j, x: unit.x, y: unit.y },
    space: unit.spaceId ?? 'outside',
    action: unit.action,
    job: unit.autonomousJob,
    sheet: unit.currentSheet,
    interval: unit.interval,
    pathLength: unit.path?.length ?? 0,
    nextCell: targetSnapshot(next),
    nextOccupant: targetSnapshot(next?.has),
    destination: targetSnapshot(unit.dest),
    actionLocked: unit.actionLocked,
    lookingAtHero: unit.lookingAtHero,
    shelter: unit.shelterState?.reason,
    portal: unit.spacePortalState?.portalId,
    delivery: unit.resourceDeliveryState?.phase,
    time: unit.context?.dayNight?.state,
  })
}
