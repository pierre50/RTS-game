import { CELL_WIDTH, CELL_HEIGHT, STEP_TIME } from '../../constants/core'
import { ensureOutsideMapSpace, getEntitySpaceId, moveEntityToMapSpace } from '../../lib/mapSpaces'
import { setUnitSuspension, unitSuspensionReason, wakeUnitSimulation } from '../../lib/units/unitSuspension'
import { beginRoadJourney, registerRoadTravel, withRoadJourneyOrder } from '../../lib/units/roadJourney'
import { getEnergyMoveSpeedMultiplier } from '../../lib/units/unitEnergy'
import { ambientActivityArea } from '../world/AmbientActivityArea'
import { updateInstanceVisibility } from '../../lib/grid/visibility'
import { t } from '../../lib/lang'
import type { GameContextLike, SchedulerTaskId } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { BuildingEntity, UnitEntity } from '../../types/entities'
import { planRoadRoute, planTownApproach, type RoadPoint } from './RoadRoute'

type Journey = {
  town: BuildingEntity
  search?: Generator<void, RoadPoint[] | null>
  route?: RoadPoint[]
  lengths?: number[]
  index: number
  credit: number
  last: number
  waypoint?: RoadPoint
  retryAt: number
  lastProgressAt: number
  lastPosition: RoadPoint
  slices: number
}
const distance = (a: RoadPoint, b: RoadPoint) => Math.hypot(a.i - b.i, a.j - b.j)

/** One shared work budget, including groups; ordinary movement is only used for short legs. */
export class RoadTravelSystem {
  private journeys = new Map<UnitEntity, Journey>()
  private cursor = 0
  private restoreAt = 0
  private plans = new Map<
    string,
    { search: Generator<void, RoadPoint[] | null>; result?: RoadPoint[] | null; created: number }
  >()
  private task: SchedulerTaskId | null = null
  constructor(private context: GameContextLike) {
    if (context.editor) return
    registerRoadTravel(context, this)
    this.task = context.scheduler.add(
      () => {
        if (context.performance) context.performance.measure('travel.update', () => this.update())
        else this.update()
      },
      50,
      'unit.roadTravel'
    )
  }

  start(unit: UnitEntity, town: BuildingEntity): boolean {
    if (
      !unit.owner ||
      town.owner !== unit.owner ||
      !town.isBuilt ||
      town.isDead ||
      town.isDestroyed ||
      unit.isDead ||
      unit.isDestroyed ||
      unit.combatMode ||
      unit.action === 'attack' ||
      unit.action === 'flee' ||
      !town.label ||
      getEntitySpaceId(unit) !== 'outside' ||
      getEntitySpaceId(town) !== 'outside' ||
      distance(unit, town) < 48 ||
      unit.controlMode === 'hero'
    )
      return false
    if (unit.actionLocked) return Boolean(unit.queueOrder?.(() => this.start(unit, town)))
    this.cancel(unit)
    wakeUnitSimulation(unit)
    const begin = () => {
      unit.stop?.()
      unit.previousDest = null
      unit.autonomousJob = null
      unit.collectiveTask = null
      unit.collectiveHome = undefined
      unit.work = null
      unit.roadJourney = { targetLabel: town.label }
      this.journeys.set(unit, {
        town,
        search: this.plan(unit, town),
        index: 0,
        credit: 0,
        last: this.context.scheduler.elapsedMs,
        retryAt: 0,
        lastProgressAt: this.context.scheduler.elapsedMs,
        lastPosition: { i: unit.i, j: unit.j },
        slices: 0,
      })
    }
    if (!this.context.unitRest?.wakeRestingUnitForOrder(unit, begin)) begin()
    if (unit.roadJourney && !this.observed(unit, unit, ambientActivityArea(this.context))) {
      unit.stopInterval?.()
      unit.sprite?.stop?.()
      setUnitSuspension(unit, { reason: 'road-travel', wake: () => this.cancel(unit) })
    }
    return true
  }

  private *uncachedPlan(unit: UnitEntity, town: BuildingEntity): Generator<void, RoadPoint[] | null> {
    const route = yield* planRoadRoute(unit, town, this.context.map)
    if (route) return route
    return yield* planTownApproach(unit, town, this.context.map)
  }

  private *plan(unit: UnitEntity, town: BuildingEntity): Generator<void, RoadPoint[] | null> {
    // Groups departing the same cell share the cooperative search, including while
    // it is pending. Local movement still validates obstacles when observed.
    const key = `${unit.i}:${unit.j}:${town.label}:${town.i}:${town.j}`
    const now = this.context.scheduler.elapsedMs
    let shared = this.plans.get(key)
    if (!shared || (shared.result !== undefined && now - shared.created > 5000)) {
      shared = { search: this.uncachedPlan(unit, town), created: now }
      if (this.plans.size >= 128) this.plans.delete(this.plans.keys().next().value!)
      this.plans.set(key, shared)
    }
    while (shared.result === undefined) {
      const step = shared.search.next()
      if (step.done) shared.result = step.value
      else yield
    }
    if (shared.result === null) this.plans.delete(key)
    return shared.result
  }

  cancel(unit: UnitEntity): void {
    this.journeys.delete(unit)
    delete unit.roadJourney
    if (unitSuspensionReason(unit) === 'road-travel') setUnitSuspension(unit)
  }

  private finish(unit: UnitEntity, failure?: 'destination-lost' | 'search-budget' | 'no-route'): void {
    if (failure) {
      const state = this.journeys.get(unit)
      console.warn('[road-travel-failed]', {
        reason: failure,
        unit: unit.label,
        position: { i: unit.i, j: unit.j },
        town: state?.town.label,
        townPosition: state ? { i: state.town.i, j: state.town.j } : undefined,
        plannedCells: state?.route?.length,
        routeIndex: state?.index,
        searchSlices: state?.slices,
      })
    }
    const town = this.journeys.get(unit)?.town
    if (!failure && town && !unit.owner?.isPlayed)
      unit.villageHome = {
        id: `${unit.owner?.label}:${town.label}`,
        i: town.i,
        j: town.j,
        spaceId: 'outside',
      }
    this.cancel(unit)
    unit.stop?.()
    if (failure && unit.owner?.isPlayed) this.context.menu?.showMessage(t('npcTravelNoRoute'), 'warning')
  }

  private observed(point: RoadPoint, unit: UnitEntity, inCamera: (point: RoadPoint) => boolean): boolean {
    const hero = this.context.controls?.heroUnit
    if (hero) return getEntitySpaceId(hero) === 'outside' && distance(hero, point) <= 94
    return inCamera(point)
  }

  update(): void {
    // Saved progress is the unit's actual position; the stable destination is replanned on load.
    if (this.context.scheduler.elapsedMs >= this.restoreAt) {
      this.restoreAt = this.context.scheduler.elapsedMs + 1000
      for (const owner of this.context.players ?? [])
        for (const unit of owner.units ?? []) {
          if (!unit.roadJourney || this.journeys.has(unit)) continue
          const town = owner.buildings.find(building => building.label === unit.roadJourney?.targetLabel)
          if (!town || !beginRoadJourney(unit, town)) {
            delete unit.roadJourney
            if (town && !town.isDead && !town.isDestroyed) unit.sendToEvt?.(town, null, { allowPassageStop: true })
          }
        }
    }
    const now = this.context.scheduler.elapsedMs
    const inCamera = ambientActivityArea(this.context)
    const entries = [...this.journeys]
    const deadline = performance.now() + 2
    // Round robin prevents a long failed search from starving the rest of the group.
    for (let n = 0; n < entries.length; n++) {
      const [unit, state] = entries[(this.cursor + n) % entries.length]
      if (state.town.isDead || state.town.isDestroyed || state.town.owner !== unit.owner || !state.town.isBuilt) {
        this.finish(unit, 'destination-lost')
        continue
      }
      if (
        !unit.roadJourney ||
        unit.isDead ||
        unit.isDestroyed ||
        getEntitySpaceId(unit) !== 'outside' ||
        unit.combatMode ||
        unit.action === 'attack' ||
        unit.action === 'flee' ||
        unit.followingHero
      ) {
        this.cancel(unit)
        continue
      }
      if (performance.now() >= deadline) continue
      if (state.search) {
        if (this.observed(unit, unit, inCamera) && unitSuspensionReason(unit) === 'road-travel') setUnitSuspension(unit)
        state.last = now
        for (let slice = 0; slice < 32 && performance.now() < deadline; slice++) {
          const result = state.search.next()
          if (++state.slices > 32768) {
            this.finish(unit, 'search-budget')
            break
          }
          if (result.done) {
            state.search = undefined
            if (result.value === null) this.finish(unit, 'no-route')
            else if (!result.value.length) this.finish(unit)
            else {
              state.route = result.value
              state.lengths = []
              let previous: RoadPoint = unit,
                total = 0
              for (const point of result.value) {
                total += this.pixels(previous, point)
                state.lengths.push(total)
                previous = point
              }
              state.lastProgressAt = now
              state.lastPosition = { i: unit.i, j: unit.j }
            }
            break
          }
        }
        continue
      }
      this.advance(unit, state, now, inCamera)
    }
    this.cursor = entries.length ? (this.cursor + 1) % entries.length : 0
  }

  private advance(unit: UnitEntity, state: Journey, now: number, inCamera: (point: RoadPoint) => boolean): void {
    const route = state.route!
    if (distance(unit, state.lastPosition) > 0) {
      state.lastProgressAt = now
      state.lastPosition = { i: unit.i, j: unit.j }
    }
    // A detailed leg may have followed a short, equivalent shortcut.
    if (state.waypoint && distance(unit, state.waypoint) < 0.1 && !unit.path?.length) {
      state.index = route.findIndex((point, index) => index >= state.index && point === state.waypoint) + 1
      state.waypoint = undefined
    }
    while (state.index < route.length && distance(unit, route[state.index]) < 0.1) state.index++
    if (state.index >= route.length) {
      this.finish(unit)
      return
    }
    const dt = Math.max(0, now - state.last)
    state.last = now
    const next = route[state.index]
    if (this.observed(unit, unit, inCamera) || this.observed(next, unit, inCamera)) {
      if (unitSuspensionReason(unit) === 'road-travel') {
        setUnitSuspension(unit)
        state.lastProgressAt = now
      }
      state.credit = 0
      if (unit.path?.length) return
      if (now < state.retryAt) return
      state.retryAt = now + 1000
      // Occupancy and small pauses are normal; only stalled travel triggers a new route.
      if (now - state.lastProgressAt >= 10000) {
        state.search = this.plan(unit, state.town)
        state.route = undefined
        state.index = 0
        state.slices = 0
        state.waypoint = undefined
        state.lastProgressAt = now
        return
      }
      // A crowd on the preferred waypoint must not make the entire city unreachable.
      for (let index = Math.min(state.index + 7, route.length - 1); index >= state.index; index--) {
        const waypoint = route[index]
        const target = this.context.map.grid[waypoint.i]?.[waypoint.j]
        if (!target || target.solid || target.category === 'Water') continue
        state.waypoint = waypoint
        withRoadJourneyOrder(unit, () => unit.sendToEvt?.(target, null, { forceRepath: true, allowPassageStop: true }))
        if (unit.path?.length || distance(unit, waypoint) < 0.1) break
      }
      return
    }
    if (unitSuspensionReason(unit) !== 'road-travel') {
      // Finish a visible local leg before switching to abstract progress.
      if (unit.path?.length) return
      unit.stopInterval?.()
      unit.sprite?.stop?.()
      setUnitSuspension(unit, { reason: 'road-travel', wake: () => this.cancel(unit) })
    }
    state.credit += ((unit.speed ?? 0) * getEnergyMoveSpeedMultiplier(unit) * dt) / STEP_TIME
    // Distance to the observation circle bounds the jump: even a bent road cannot
    // enter that circle before covering this much distance. No terrain/hostile scans.
    const hero = this.context.controls?.heroUnit
    const maxJump = hero
      ? getEntitySpaceId(hero) === 'outside'
        ? (Math.max(0, distance(unit, hero) - 90) * Math.min(CELL_WIDTH, CELL_HEIGHT)) / Math.SQRT2
        : Infinity
      : 0
    const lengths = state.lengths!
    const base = state.index ? lengths[state.index - 1] : 0
    const budget = base + Math.min(state.credit, maxJump)
    let low = state.index,
      high = route.length
    while (low < high) {
      const mid = (low + high) >>> 1
      if (lengths[mid] <= budget) low = mid + 1
      else high = mid
    }
    let end = low - 1
    // Without a hero (strategy camera), conservatively inspect a bounded short leg.
    if (!hero) {
      end = state.index - 1
      for (let n = state.index; n < Math.min(route.length, state.index + 8); n++) {
        if (lengths[n] - base > state.credit || this.observed(route[n], unit, inCamera)) break
        end = n
      }
    }
    if (end < state.index) return
    // Materialize only on a free cell. A temporary crowd cannot cancel the trip.
    let target: RuntimeCell | undefined = this.context.map.grid[route[end].i]?.[route[end].j]
    for (
      let tries = 0;
      tries < 8 && end >= state.index && (!target || target.solid || target.category === 'Water');
      tries++
    ) {
      end--
      target = end >= state.index ? this.context.map.grid[route[end].i]?.[route[end].j] : undefined
    }
    if (end < state.index || !target || target.solid || target.category === 'Water') return
    state.credit -= lengths[end] - base
    moveEntityToMapSpace(this.context.map, unit, ensureOutsideMapSpace(this.context.map), target)
    updateInstanceVisibility(unit)
    state.index = end + 1
  }

  private pixels(a: RoadPoint, b: RoadPoint): number {
    return Math.hypot(((b.i - a.i - (b.j - a.j)) * CELL_WIDTH) / 2, ((b.i - a.i + (b.j - a.j)) * CELL_HEIGHT) / 2)
  }

  destroy(): void {
    if (this.task != null) this.context.scheduler.remove(this.task)
    for (const unit of this.journeys.keys()) {
      if (unitSuspensionReason(unit) === 'road-travel') setUnitSuspension(unit)
    }
    this.journeys.clear()
    this.plans.clear()
    registerRoadTravel(this.context)
  }
}
