import type { RuntimeEntity, UnitEntity, UnitResourceDeliveryReturnTask } from '../../../types/entities'
import type { RuntimeCell } from '../../../types/map'

const GOLD_MINER_FLOW_DEBUG = typeof window !== 'undefined' && typeof document !== 'undefined'

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

function isGoldMinerFlow(unit: UnitEntity, task?: UnitResourceDeliveryReturnTask | null): boolean {
  return Boolean(
    unit.autonomousJob === 'gold' ||
      unit.work === 'goldminer' ||
      unit.action === 'minegold' ||
      task?.autonomousJob === 'gold' ||
      task?.work === 'goldminer' ||
      task?.action === 'minegold'
  )
}

export function logGoldMinerFlow(
  unit: UnitEntity,
  event: string,
  details: Record<string, unknown> = {},
  task: UnitResourceDeliveryReturnTask | null | undefined = unit.resourceDeliveryState?.returnTask
): void {
  const stone =
    details.job === 'stone' ||
    unit.autonomousJob === 'stone' ||
    unit.work === 'stoneminer' ||
    unit.action === 'minestone' ||
    task?.autonomousJob === 'stone' ||
    task?.work === 'stoneminer' ||
    task?.action === 'minestone'
  if (!GOLD_MINER_FLOW_DEBUG || (!stone && !isGoldMinerFlow(unit, task))) return
  const clock = unit.context?.dayNight?.state
  const delivery = unit.resourceDeliveryState
  console.info(stone ? '[stone-miner]' : '[gold-miner]', {
    event,
    unit: unit.label ?? null,
    time: clock ? `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}` : null,
    position: { i: unit.i, j: unit.j },
    space: unit.spaceId ?? 'outside',
    action: unit.action ?? null,
    work: unit.work ?? null,
    autonomousJob: unit.autonomousJob ?? null,
    actionLocked: Boolean(unit.actionLocked),
    inactive: Boolean(unit.inactif),
    pathLength: unit.path?.length ?? 0,
    destination: targetSnapshot(unit.dest),
    blockedTarget: targetSnapshot(unit.blockedGatherApproach?.target),
    delivery: delivery
      ? {
          phase: delivery.phase,
          building: delivery.building?.label ?? null,
          chest: delivery.chest?.label ?? null,
          spaceId: delivery.spaceId ?? null,
        }
      : null,
    returnTask: task
      ? {
          action: task.action ?? null,
          autonomousJob: task.autonomousJob ?? null,
          destination: targetSnapshot(task.dest),
          work: task.work ?? null,
        }
      : null,
    gold: unit.inventory?.resources?.gold ?? 0,
    stone: unit.inventory?.resources?.stone ?? 0,
    ...details,
  })
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
