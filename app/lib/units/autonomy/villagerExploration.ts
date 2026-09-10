import type { UnitEntity } from '../../../types/entities'
import { villagerAutonomySuspension } from './villagerAutonomyAvailability'

const pending = new WeakMap<UnitEntity, { id: number; scheduler: NonNullable<UnitEntity['context']>['scheduler'] }>()
const memories = new WeakMap<UnitEntity, { space: unknown; radius: number; cells: Map<string, number> }>()

export function cancelVillagerExplorationResume(unit: UnitEntity): void {
  const task = pending.get(unit)
  if (task) task.scheduler?.remove(task.id)
  pending.delete(unit)
}

export function scheduleVillagerExplorationResume(
  unit: UnitEntity,
  resume: (unit: UnitEntity) => unknown,
  delay = 250
): void {
  const scheduler = unit.context?.scheduler
  if (!unit.autonomousJob || !scheduler?.addOneShot || pending.has(unit)) return
  const job = unit.autonomousJob
  const space = unit.spaceId
  const task = { id: 0, scheduler }
  pending.set(unit, task)
  task.id = scheduler.addOneShot(
    () => {
      if (pending.get(unit) !== task) return
      pending.delete(unit)
      if (
        unit.isDead ||
        unit.isDestroyed ||
        unit.autonomousJob !== job ||
        unit.spaceId !== space ||
        unit.dest ||
        unit.action ||
        unit.path?.length ||
        villagerAutonomySuspension(unit)
      )
        return
      resume(unit)
    },
    delay,
    'unit.autonomyExplorationResume'
  )
}

function memory(unit: UnitEntity, space: unknown) {
  let state = memories.get(unit)
  if (!state || state.space !== space) {
    state = { space, radius: 50, cells: new Map() }
    memories.set(unit, state)
  }
  for (const [key, expiry] of state.cells) if (expiry <= performance.now()) state.cells.delete(key)
  return state
}

export function getVillagerExplorationSearch(unit: UnitEntity, space: unknown, maxRadius: number) {
  const state = memory(unit, space)
  return {
    radius: Math.min(state.radius, maxRadius),
    canTry: (i: number, j: number) => !state.cells.has(`${i}:${j}`),
    remember: (i: number, j: number) => state.cells.set(`${i}:${j}`, performance.now() + 60000),
    expand: () => {
      state.radius = Math.min(maxRadius, state.radius + 50)
    },
  }
}
