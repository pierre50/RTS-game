import { isNightWatchDuty } from '../lib/units/villageNightWatch'
import { isChiefUnit } from '../lib/chief'
import { getEntitySpaceId } from '../lib/mapSpaces'
import { isDistantOwner } from '../lib/units/villageActivity'
import { canUnitStartAmbientWalk } from '../lib/units/walkAround'
import { getBuildingInteriorEntryCell, isBuildingInteriorSupported } from '../lib/buildings/interiors'
import {
  ensureRuntimeBuildingInteriorSpace,
  getBuildingInteriorSpaceForUnit,
  routeUnitIntoBuildingInteriorSpaceAndMoveBack,
  routeUnitOutOfBuildingInteriorSpace,
} from './BuildingInteriorSpaceSystem'
import {
  CIVIL_VISIT_TYPES,
  MILITARY_VISIT_TYPES,
  VISIT_RADIUS,
  usableVisitBuilding,
  localVisitCells,
  visitDestination,
} from './IdleVillageDestinations'
import { isIdleVisitEligible } from './patrol/IdleVisitEligibility'
import {
  filterNearbyStrollCells,
  filterNightPatrolCells,
  findNightPatrolHome,
  findVisitCenters,
  INTERIOR_MILITARY_VISIT_TYPES,
  resolveVisitHome,
  rotateVisitChoices,
  visitLimit,
} from './patrol/IdleVisitPlanning'
import type { GameContextLike } from '../types/context'
import type { UnitEntity, BuildingEntity } from '../types/entities'
import type { GridPosition } from '../types/grid'
import type { RuntimeCell } from '../types/map'
import type { PlayerLike } from '../types/player'

type Visit = {
  destination?: UnitEntity['dest']
  building?: BuildingEntity
  phase: 'travel' | 'pause' | 'exit'
  interior: boolean
  until: number
}
type ScanStep = 'next' | 'search' | 'stop'
type VisitAttempt = 'skip' | 'refused' | 'started'
const TICK_MS = 3000
const MAX_VISITORS = 2

/** Slow, interruptible visits shared by player idle units and local AI residents. */
export class IdleUnitPatrolSystem {
  private task: number | null = null
  private visits = new Map<UnitEntity, Visit>()
  private ready = new WeakMap<UnitEntity, number>()
  private homes = new WeakMap<UnitEntity, GridPosition>()
  private lastBuilding = new WeakMap<UnitEntity, BuildingEntity>()
  private cursor = 0
  constructor(public context: GameContextLike) {
    this.start()
  }
  start(): void {
    if (this.context.editor || this.task != null) return
    this.task = this.context.scheduler.add(() => this.update(), TICK_MS, 'unitIdle.visits')
  }

  private eligible(unit: UnitEntity): boolean {
    return isIdleVisitEligible(unit)
  }

  private delay(unit: UnitEntity): void {
    this.ready.set(unit, this.context.scheduler.elapsedMs + this.context.map.randomRange(5000, 25000))
  }

  private endVisit(unit: UnitEntity): void {
    this.visits.delete(unit)
    this.delay(unit)
  }

  update(): void {
    const now = this.context.scheduler.elapsedMs
    const units = (this.context.players ?? [])
      .filter(owner => !isDistantOwner(owner))
      .flatMap(owner => owner.units ?? [])
    const living = new Set(units)
    for (const [unit, visit] of this.visits) {
      if (!living.has(unit) || !this.eligible(unit) || (visit.building && !usableVisitBuilding(visit.building)))
        this.endVisit(unit)
    }
    let searches = 0
    for (let n = 0; n < Math.min(units.length, 64); n++) {
      const unit = units[this.cursor++ % units.length]
      const step = this.scanUnit(unit, now)
      if (step === 'stop') return
      if (step !== 'search') continue
      if (++searches > 2) return
      if (this.beginVisit(unit)) return // A single new route/interior per scan, no teleport burst.
    }
    this.cursor %= Math.max(1, units.length)
  }

  private scanUnit(unit: UnitEntity, now: number): ScanStep {
    if (!this.eligible(unit)) {
      this.delay(unit)
      return 'next'
    }
    const visit = this.visits.get(unit)
    if (unit.path?.length || unit.dest || unit.spacePortalState) {
      this.updateMovingUnit(unit, visit, now)
      return 'next'
    }
    if (visit) return this.updateVisit(unit, visit, now)
    return this.scanIdleUnit(unit, now)
  }

  private updateMovingUnit(unit: UnitEntity, visit: Visit | undefined, now: number): void {
    if (!visit) {
      this.delay(unit)
      return
    }
    const entered = visit.interior && getBuildingInteriorSpaceForUnit(unit)?.building === visit.building
    const diverted = !entered && !unit.spacePortalState && unit.dest && unit.dest !== visit.destination
    if (visit.phase === 'pause' || diverted || now > visit.until) this.endVisit(unit)
  }

  private updateVisit(unit: UnitEntity, visit: Visit, now: number): ScanStep {
    if (visit.phase === 'travel') {
      this.settleArrival(unit, visit, now)
      return 'next'
    }
    if (now < visit.until) return 'next'
    const space = getBuildingInteriorSpaceForUnit(unit)
    if (space && visit.phase !== 'exit') {
      visit.phase = 'exit'
      visit.until = now + 90000
      if (routeUnitOutOfBuildingInteriorSpace(this.context, unit, space)) return 'stop'
    }
    this.endVisit(unit)
    return 'next'
  }

  private settleArrival(unit: UnitEntity, visit: Visit, now: number): void {
    const arrived = visit.interior
      ? getBuildingInteriorSpaceForUnit(unit)?.building === visit.building
      : Boolean(visit.destination && unit.i === visit.destination.i && unit.j === visit.destination.j)
    if (!arrived) {
      this.endVisit(unit)
      return
    }
    visit.phase = 'pause'
    visit.until = now + this.context.map.randomRange(10000, 25000)
  }

  private scanIdleUnit(unit: UnitEntity, now: number): ScanStep {
    const readyAt = this.ready.get(unit)
    if (readyAt === undefined) {
      this.delay(unit)
      return 'next'
    }
    if (now < readyAt) return 'next'
    this.delay(unit)
    // Also recovers an idle visitor saved inside a building: visits need no saved timers.
    const space = getBuildingInteriorSpaceForUnit(unit)
    if (space)
      return space.building.owner === unit.owner && routeUnitOutOfBuildingInteriorSpace(this.context, unit, space)
        ? 'stop'
        : 'next'
    if (getEntitySpaceId(unit) !== 'outside' || !canUnitStartAmbientWalk(unit)) return 'next'
    return 'search'
  }

  private reservedDestinations(): Set<Visit['destination']> {
    return new Set([...this.visits.values()].map(visit => visit.destination))
  }

  private walkToRandomCell(unit: UnitEntity, cells: RuntimeCell[]): boolean {
    const target = cells[this.context.map.randomRange(0, Math.max(0, cells.length - 1))]
    if (!target || !unit.sendTo) return false
    unit.sendTo(target)
    if (!unit.dest) return false
    this.visits.set(unit, {
      destination: unit.dest,
      phase: 'travel',
      interior: false,
      until: this.context.scheduler.elapsedMs + 90000,
    })
    return true
  }

  private beginNightPatrol(unit: UnitEntity): boolean {
    const home = findNightPatrolHome(unit)
    if (!home) return false
    const reserved = this.reservedDestinations()
    const cells = filterNightPatrolCells(this.context, unit, home, localVisitCells(this.context, unit, home), reserved)
    return this.walkToRandomCell(unit, cells)
  }

  private beginVisit(unit: UnitEntity): boolean {
    const clock = this.context.dayNight?.state
    if (isNightWatchDuty(unit, (clock?.hour ?? 12) * 60 + (clock?.minute ?? 0))) return this.beginNightPatrol(unit)
    const owner = unit.owner
    // Everyone gets a turn; the shared cursor staggers departures across scans.
    if (!owner || [...this.visits.keys()].filter(other => other.owner === owner).length >= visitLimit(owner))
      return false
    const centers = findVisitCenters(unit, owner)
    const home = resolveVisitHome(unit, centers, this.homes.get(unit))
    this.homes.set(unit, home)
    const reserved = this.reservedDestinations()
    const cells = localVisitCells(this.context, unit, home).filter(cell => !reserved.has(cell))
    if (!cells.length) return false
    const civilian = unit.type === 'Villager' && !isChiefUnit(unit)
    for (const building of this.visitChoices(unit, owner, home, civilian)) {
      const attempt = this.tryBuildingVisit(unit, building, cells, civilian)
      if (attempt !== 'skip') return attempt === 'started'
    }
    return this.walkToRandomCell(unit, filterNearbyStrollCells(this.context, unit, home, cells, centers.length > 0))
  }

  private visitChoices(unit: UnitEntity, owner: PlayerLike, home: GridPosition, civilian: boolean): BuildingEntity[] {
    const types = civilian ? CIVIL_VISIT_TYPES : MILITARY_VISIT_TYPES
    const buildings = owner.buildings.filter(
      b =>
        usableVisitBuilding(b) &&
        types.has(b.type) &&
        (!b.owner || b.owner === owner) &&
        Math.hypot(b.i - home.i, b.j - home.j) <= VISIT_RADIUS &&
        [...this.visits.values()].filter(v => v.building === b).length < MAX_VISITORS
    )
    const start = this.context.map.randomRange(0, Math.max(0, buildings.length - 1))
    return rotateVisitChoices(buildings, start, this.lastBuilding.get(unit))
  }

  private enterInterior(unit: UnitEntity, building: BuildingEntity): boolean {
    const space = ensureRuntimeBuildingInteriorSpace(this.context, building)
    return Boolean(space && routeUnitIntoBuildingInteriorSpaceAndMoveBack(this.context, unit, space))
  }

  private tryBuildingVisit(
    unit: UnitEntity,
    building: BuildingEntity,
    cells: RuntimeCell[],
    civilian: boolean
  ): VisitAttempt {
    const interior =
      isBuildingInteriorSupported(building) &&
      (civilian || INTERIOR_MILITARY_VISIT_TYPES.includes(building.type)) &&
      this.context.map.randomRange(0, 2) === 0
    const destination = visitDestination(this.context, unit, building, cells, interior)
    if (!destination) return 'skip'
    const entering =
      interior &&
      destination === getBuildingInteriorEntryCell(building, this.context.map.grid) &&
      this.enterInterior(unit, building)
    if (!entering) {
      // Never linger on the doorway when interior entry could not start.
      const exterior = visitDestination(this.context, unit, building, cells, false)
      if (!exterior || !unit.sendTo) return 'skip'
      unit.sendTo(exterior)
      if (!unit.dest) return 'refused' // A refused order is not a visit or a reserved visitor slot.
    }
    this.visits.set(unit, {
      building,
      destination: unit.dest,
      phase: 'travel',
      interior: entering,
      until: this.context.scheduler.elapsedMs + 90000,
    })
    this.lastBuilding.set(unit, building)
    return 'started'
  }

  destroy(): void {
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.task = null
    this.visits.clear()
  }
}
