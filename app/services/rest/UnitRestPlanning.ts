import { getEntitySpaceMapLike } from '../../lib/mapSpaces'
import { isUnitSuspended } from '../../lib/units/unitSuspension'
import { canUseReservedPassageCellForTransit, createReservedPassageCellLookup } from '../../lib/buildings/passageCells'
import { searchInstancePath, withPreparedPaths, isPreparedPathValid, type PreparedPath } from '../Pathfinding'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import type { RuntimeCell } from '../../types/map'
import { getRestRoute } from './UnitRestRoute'
import { canReachRestWithPathLength } from './UnitRestTravel'
import {
  getCurrentOutsideRestSite,
  getRestCandidates,
  getRestTargetSite,
  getRestTargetTravelLimit,
  isRestTargetAvailable,
  type UnitRestSite,
} from './UnitRestShelter'
import { getNearestRestSite, shouldRest, isSleepTime } from './UnitRestRules'

import { rememberRestState, stopUnitForRest } from './UnitRestState'
import { wakeUnitInstant } from './UnitRestWake'
import { getDailyRoutinePhase, hasDailyRestSchedule } from '../../lib/units/village/villagerSchedule'

const FRAME_BUDGET_MS = 2
const MAX_STEPS_PER_FRAME = 128
const queues = new WeakMap<GameContextLike, RestPlanningQueue>()
type Plan = { site: UnitRestSite | null; paths: PreparedPath<RuntimeCell>[] }
type Job = {
  unit: UnitEntity
  valid: () => boolean
  cancel: () => void
  decline: () => void
  search: Generator<void, Plan, void>
  commit: (site: UnitRestSite | null) => boolean
}

/** The live system queues plans; restoration/time jumps can explicitly use the synchronous selector. */
export function selectRestSite(
  unit: UnitEntity,
  excluded: BuildingEntity | null | undefined,
  commit: (site: UnitRestSite | null) => boolean
): boolean {
  const queue = unit.context && queues.get(unit.context)
  if (!queue) return commit(getNearestRestSite(unit, excluded))
  return queue.request(unit, excluded, commit)
}

function* planRest(unit: UnitEntity, excluded?: BuildingEntity | null): Generator<void, Plan, void> {
  const passages = createReservedPassageCellLookup(unit.context)
  const options = {
    canPassThroughSolidCell: (cell: RuntimeCell) => canUseReservedPassageCellForTransit(cell, passages),
  }
  for (const target of getRestCandidates(unit, excluded)) {
    yield
    const site = getRestTargetSite(unit, target, false)
    if (!site) continue
    const legs = getRestRoute(unit, site.targetCell)
    if (!legs) continue
    const minimumLength = legs.reduce(
      (sum, leg) => sum + Math.max(Math.abs(leg.from.i - leg.to.i), Math.abs(leg.from.j - leg.to.j)),
      0
    )
    if (minimumLength > getRestTargetTravelLimit(unit, target) || !canReachRestWithPathLength(unit, minimumLength))
      continue
    const paths: PreparedPath<RuntimeCell>[] = []
    let length = 0
    let reachable = true
    for (const leg of legs) {
      if (leg.from.i === leg.to.i && leg.from.j === leg.to.j) continue
      const traveller = { ...unit, i: leg.from.i, j: leg.from.j, spaceId: leg.from.spaceId, currentCell: leg.from }
      const map = getEntitySpaceMapLike(traveller, unit.context!.map)
      if (!map) {
        reachable = false
        break
      }
      const path = yield* searchInstancePath(
        traveller,
        leg.to.i,
        leg.to.j,
        { grid: map.grid, context: unit.context! },
        options
      )
      if (!path.length) {
        reachable = false
        break
      }
      paths.push({ start: leg.from, path })
      length += path.length
    }
    if (!reachable || length > getRestTargetTravelLimit(unit, target) || !canReachRestWithPathLength(unit, length))
      continue
    // Occupancy can change while the search is suspended.
    if (!isRestTargetAvailable(unit, target)) continue
    if (
      !paths.every(prepared => {
        const traveller = { ...unit, spaceId: prepared.start.spaceId }
        const map = getEntitySpaceMapLike(traveller, unit.context!.map)
        return map && isPreparedPathValid(unit, prepared, { grid: map.grid, context: unit.context! }, options)
      })
    )
      continue
    return { site, paths }
  }
  return { site: getCurrentOutsideRestSite(unit), paths: [] }
}

export function hasPendingRestPlan(unit: UnitEntity): boolean {
  return Boolean(unit.context && queues.get(unit.context)?.has(unit))
}

export class RestPlanningQueue {
  private jobs = new Map<UnitEntity, Job>()
  private running = new Set<UnitEntity>()
  private taskId: SchedulerTaskId | null = null
  private frame = -1
  private spent = 0
  private steps = 0
  constructor(private context: GameContextLike) {
    queues.set(context, this)
  }

  request(unit: UnitEntity, excluded: BuildingEntity | null | undefined, commit: Job['commit']): boolean {
    const existing = this.jobs.get(unit)
    if (existing?.valid()) return true
    this.jobs.delete(unit)
    this.running.delete(unit)
    existing?.cancel()
    // Keep the interrupted activity in the existing rest state, so wake/combat/order
    // cancellation uses the same lifecycle as a resident already walking home.
    const previousState = unit.shelterState
    const previousPath = unit.path ? [...unit.path] : []
    const shelterState = rememberRestState(unit, {
      status: 'movingToRest',
      reason: 'sleep',
      location: 'outside',
      shelter: null,
      targetCell: null,
    })
    stopUnitForRest(unit)
    const { i, j, spaceId, dest, action, owner } = unit
    const phase = () => (hasDailyRestSchedule(unit) ? getDailyRoutinePhase(unit) : isSleepTime(this.context))
    const requestedPhase = phase()
    const map = this.context.map
    const valid = () =>
      !unit.isDead &&
      !unit.isDestroyed &&
      !isUnitSuspended(unit) &&
      unit.context === this.context &&
      this.context.map === map &&
      unit.owner === owner &&
      unit.i === i &&
      unit.j === j &&
      unit.spaceId === spaceId &&
      unit.dest === dest &&
      unit.action === action &&
      unit.shelterState === shelterState &&
      !unit.lookingAtHero &&
      shouldRest(unit) &&
      phase() === requestedPhase
    const cancel = () => {
      if (unit.shelterState === shelterState && !unit.isDead && !unit.isDestroyed && !isUnitSuspended(unit))
        wakeUnitInstant(unit, {
          force: true,
          mode:
            unit.dest === dest && unit.action === action && !unit.lookingAtHero && shouldRest(unit)
              ? 'resume'
              : 'order',
        })
    }
    const decline = () => {
      if (unit.shelterState !== shelterState) return
      unit.shelterState = previousState
      if (previousPath.length) unit.setPath?.(previousPath)
    }
    let result: boolean | undefined
    this.jobs.set(unit, {
      unit,
      valid,
      cancel,
      decline,
      search: planRest(unit, excluded),
      commit: site => {
        result = commit(site)
        return result
      },
    })
    if (this.taskId == null)
      this.taskId = this.context.scheduler.add(() => this.flush(), 1, 'unit.restPlanning', { maxRunsPerTick: 1 })
    this.flush()
    return result ?? true
  }

  has(unit: UnitEntity): boolean {
    return this.jobs.has(unit)
  }

  flush(): void {
    const frame = this.context.scheduler.elapsedMs ?? 0
    if (frame !== this.frame) {
      this.frame = frame
      this.spent = 0
      this.steps = 0
    }
    const start = performance.now()
    try {
      while (
        this.jobs.size &&
        this.steps < MAX_STEPS_PER_FRAME &&
        this.spent + performance.now() - start < FRAME_BUDGET_MS
      ) {
        // Keep only a few A* frontiers alive on very large maps.
        const job = [...this.jobs.values()].find(job => this.running.has(job.unit) || this.running.size < 4)!
        this.running.add(job.unit)
        if (!job.valid()) {
          this.jobs.delete(job.unit)
          this.running.delete(job.unit)
          job.cancel()
          continue
        }
        this.steps++
        let step: IteratorResult<void, Plan>
        try {
          step = job.search.next()
        } catch (error) {
          this.jobs.delete(job.unit)
          this.running.delete(job.unit)
          job.cancel()
          throw error
        }
        if (step.done) {
          this.jobs.delete(job.unit)
          this.running.delete(job.unit)
          if (job.valid() && !withPreparedPaths(step.value.paths, () => job.commit(step.value.site))) job.decline()
        } else {
          // Round-robin prevents a long unreachable route starving the other residents.
          this.jobs.delete(job.unit)
          this.jobs.set(job.unit, job)
        }
      }
    } finally {
      this.spent += performance.now() - start
      if (!this.jobs.size && this.taskId != null) {
        this.context.scheduler.remove(this.taskId)
        this.taskId = null
      }
    }
  }

  forget(units: UnitEntity[]): void {
    for (const unit of units) {
      this.jobs.delete(unit)
      this.running.delete(unit)
    }
  }

  clear(): void {
    this.jobs.clear()
    this.running.clear()
    if (this.taskId != null) this.context.scheduler.remove(this.taskId)
    this.taskId = null
  }
  destroy(): void {
    this.clear()
    queues.delete(this.context)
  }
}
