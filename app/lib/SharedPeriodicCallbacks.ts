import type { GameContextLike, SchedulerTaskId } from '../types/context'

type Scheduler = GameContextLike['scheduler']
type Group = { buckets: Set<() => void>[]; cursor: number; taskId: SchedulerTaskId; count: number; next: number }
const groups = new WeakMap<Scheduler, Map<string, Group>>()
const BUCKET_COUNT = 16

// Only one scheduler entry per cadence. Spread work across the period without
// changing its frequency, and let the game scheduler own pause/time progression.
export function registerPeriodicCallback(
  scheduler: Scheduler,
  callback: () => void,
  intervalMs: number,
  name: string
): { taskId: SchedulerTaskId; remove: () => void } {
  let registry = groups.get(scheduler)
  if (!registry) groups.set(scheduler, (registry = new Map()))
  const key = `${name}:${intervalMs}`
  let group = registry.get(key)
  if (!group) {
    const buckets = Array.from({ length: BUCKET_COUNT }, () => new Set<() => void>())
    group = { buckets, cursor: 0, taskId: 0, count: 0, next: 0 }
    const current = group
    group.taskId = scheduler.add(
      () => {
        const bucket = current.buckets[current.cursor]
        current.cursor = (current.cursor + 1) % BUCKET_COUNT
        // Snapshot this slice so callbacks can register/remove other animals safely.
        for (const update of [...bucket]) {
          if (!bucket.has(update)) continue
          try {
            update()
          } catch (error) {
            console.error(`[${name}] callback failed`, error)
          }
        }
      },
      intervalMs / BUCKET_COUNT,
      name,
      // Two slices cover normal 60 Hz jitter (a slice is 15.625 ms). After a
      // stall, rotate through the remaining animals on subsequent frames.
      name === 'animal.behavior' ? { maxRunsPerTick: 2 } : undefined
    )
    registry.set(key, group)
  }
  const current = group
  const bucket = current.buckets[current.next++ % BUCKET_COUNT]
  bucket.add(callback)
  current.count++
  let removed = false
  return {
    taskId: current.taskId,
    remove: () => {
      if (removed) return
      removed = true
      bucket.delete(callback)
      if (--current.count === 0) {
        scheduler.remove(current.taskId)
        registry.delete(key)
      }
    },
  }
}
