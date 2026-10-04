import { isStaticSettlement } from '../../config/settlementProfiles'
import { flushNaturalGrowth } from '../NaturalGrowthQueue'
import { DAY_NIGHT_CONFIG } from '../../config/gameplay'
import { VILLAGE_ACTIVITY_RADIUS } from '../../config/villageActivity'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { consumeVillagerMeals } from '../../lib/economy/villagerMeals'
import { getVillagerWorkingMinutes } from '../../lib/units/village/villagerSchedule'
import { restoreOfflineUnitSleepHealth, updateUnitSleepHealth } from '../../lib/units/unitSleepHealth'
import { updateUnitEnergy } from '../../lib/units/unitEnergy'
import { hasHostileInHeroSight } from '../../lib/hero/heroSleep'
import { advanceVillageWork } from './VillageWorkSimulation'
import { planDistantVillageBuildings } from './distantVillages/DistantVillageEconomy'
import type { VillageActivitySystem } from '../VillageActivitySystem'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { UnitEntity } from '../../types/entities'
import type { VillageHome } from '../../lib/units/village/villageActivity'

const HOUR_MS = DAY_NIGHT_CONFIG.dayLengthMs / DAY_NIGHT_CONFIG.hoursPerDay
const calendarMinute = (elapsed: number) => DAY_NIGHT_CONFIG.startHour * 60 + (elapsed / HOUR_MS) * 60

/** One owner per rendered frame; the clock commits only after the whole interval.
 * Movement, AI and cosmetic timers stay frozen, with no catch-up debt on waking.
 * The live calendar remains the sole owner of daily events and paid training.
 */
export class SleepSimulation {
  private work: (() => void)[] = []
  private started = false
  private workers = new Set<UnitEntity>()
  private plannedDay = new Map<PlayerLike, number>()
  interrupted = false

  constructor(
    private context: GameContextLike,
    private villages: VillageActivitySystem
  ) {}

  get busy(): boolean {
    return this.work.length > 0
  }

  begin(): void {
    this.started = true
    this.interrupted = false
    this.plannedDay.clear()
    this.workers.clear()
    this.villages.beginSleep()
    this.context.performance?.markEvent?.('sleep.begin', { elapsedMs: this.context.dayNight!.getElapsedMs() })
  }

  step(target: number): void {
    if (!this.busy) {
      const from = this.context.dayNight!.getElapsedMs()
      const deadline = this.context.scheduler.getSleepDeadlineMs?.() ?? Infinity
      if (deadline <= 0 || this.danger()) {
        this.interrupted = true
        return
      }
      // Never cross a day boundary: meals/work precede arrivals, regrowth and training.
      const hour = DAY_NIGHT_CONFIG.startHour + from / HOUR_MS
      const nextDayHour = (Math.floor((hour - DAY_NIGHT_CONFIG.newDayHour) / 24) + 1) * 24 + DAY_NIGHT_CONFIG.newDayHour
      const to = Math.min(target, from + HOUR_MS, (nextDayHour - DAY_NIGHT_CONFIG.startHour) * HOUR_MS, from + deadline)
      if (to <= from) return
      for (const owner of [...this.context.players]) this.work.push(() => this.advanceOwner(owner, from, to))
      this.work.push(() => {
        this.context.scheduler.advanceSleepTime!(to - from)
        for (const owner of this.context.players)
          for (const unit of owner.units) if (!unit.isDead && !unit.isDestroyed) updateUnitEnergy(unit, to - from)
        const previousDay = this.context.dayNight!.state.day
        this.context.dayNight!.setElapsedMs!(to)
        if (this.context.dayNight!.state.day !== previousDay) flushNaturalGrowth(this.context.map)
        this.interrupted = deadline <= to - from || this.danger()
      })
    }
    const task = this.work.shift()
    if (task) {
      if (this.context.performance) this.context.performance.measure('sleep.simulation', task)
      else task()
    }
  }

  private danger(): boolean {
    const hero = this.context.controls?.heroUnit
    return Boolean(
      this.context.tributeRaids?.interruptsSleep?.() ||
        (hero && (hero.isDead || hero.isDestroyed || hasHostileInHeroSight(hero)))
    )
  }

  private advanceOwner(owner: PlayerLike, from: number, to: number): void {
    if (isStaticSettlement(owner)) {
      for (const unit of owner.units) unit.lastMealAt = calendarMinute(to)
      return
    }
    const hero = this.context.controls?.heroUnit
    const units = owner.units.filter(unit => !unit.isDead && !unit.isDestroyed)
    const workers = units.filter(
      unit =>
        unit !== hero &&
        unit.type === 'Villager' &&
        !unit.followingHero &&
        unit.controlMode !== 'hero' &&
        !unit.trainingTargetType &&
        !unit.campPatrolAnchor &&
        !unit.banditCampAnchor &&
        !unit.spacePortalState &&
        !unit.combatMode
    )
    const homes: VillageHome[] = []
    const addHome = (point: { i: number; j: number }, label: string) => {
      if (homes.some(home => Math.hypot(home.i - point.i, home.j - point.j) <= VILLAGE_ACTIVITY_RADIUS)) return
      homes.push({ ...point, id: `sleep:${owner.label}:${label}`, spaceId: 'outside' })
    }
    for (const building of owner.buildings)
      if (building.type === 'TownCenter' && !building.isDestroyed && !building.isDead)
        addHome({ i: building.i, j: building.j }, building.label)
    for (const unit of workers) {
      const point =
        getEntitySpaceId(unit) === 'outside'
          ? unit
          : this.context.map.spaces
              ?.get(getEntitySpaceId(unit))
              ?.portals?.find(portal => portal.targetSpaceId === 'outside')?.targetCell
      if (point) addHome({ i: point.i, j: point.j }, unit.label)
    }
    const fromMinute = calendarMinute(from),
      toMinute = calendarMinute(to)
    const day = this.context.dayNight!.state.day
    if (homes.length && this.plannedDay.get(owner) !== day) {
      this.plannedDay.set(owner, day)
      if ((owner as PlayerLike & { offlineBuildingPlanDay?: number }).offlineBuildingPlanDay !== day)
        planDistantVillageBuildings(this.context, owner, homes, workers)
    }
    // Most of the night requires no terrain snapshot at all.
    const working = workers.some(unit => getVillagerWorkingMinutes(unit, fromMinute, toMinute) > 0)
    const simulated = new Set<UnitEntity>()
    if (working && homes.length) {
      for (const unit of workers) {
        if (this.workers.has(unit)) continue
        this.workers.add(unit)
        unit.stopInterval?.()
        unit.stopTimeout?.()
        unit.path = []
        unit.gatherProgressState = null
        unit.sprite?.stop?.()
        if (unit.sprite) {
          delete unit.sprite.onFrameChange
          delete unit.sprite.onLoop
        }
      }
      advanceVillageWork(this.context, homes, owner, workers, to - from, from, true)
      for (const unit of workers) simulated.add(unit)
    }
    for (const unit of units) {
      if (unit === hero) updateUnitSleepHealth(unit, to - from)
      else if (!simulated.has(unit)) restoreOfflineUnitSleepHealth(unit, fromMinute, toMinute)
      // lastMealAt makes this safe for workers already charged by the shared simulation.
      consumeVillagerMeals(unit, fromMinute, toMinute, unit.lastMealAt == null)
    }
  }

  end(): void {
    if (!this.started) return
    this.started = false
    this.work = []
    this.villages.endSleep()
    this.context.unitRest?.synchronizeAfterTimeJump?.()
    for (const unit of this.workers)
      if (!unit.isDead && !unit.isDestroyed && !unit.shelterState && unit.dest)
        unit.sendToEvt?.(unit.dest, unit.action, { forceRepath: true, preserveAutonomy: true })
    this.workers.clear()
    this.context.performance?.markEvent?.('sleep.end', {
      elapsedMs: this.context.dayNight!.getElapsedMs(),
      interrupted: this.interrupted,
    })
    this.context.menu?.refreshInventory?.()
  }
}
