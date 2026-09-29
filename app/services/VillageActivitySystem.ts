import { isVillageSupplyTrip, villageWorkNeedsLiveSearch } from '../lib/units/villageSupplyTrips'
import { observeVillage } from './world/VillageObservation'
import { PlayerWorkActivitySystem } from './world/PlayerWorkActivitySystem'
import {
  VILLAGE_ACTIVITY_RADIUS,
  VILLAGE_DETAIL_ENTER_RADIUS,
  VILLAGE_DETAIL_EXIT_RADIUS,
  VILLAGE_PATH_MARGIN,
  VILLAGE_SIMULATION_STEP_MS,
} from '../config/villageActivity'
import { campDistance } from '../lib/units/campBehavior'
import { getEntitySpaceId } from '../lib/mapSpaces'
import {
  registerVillageFlush,
  villageHome,
  withinVillageActivity,
  type VillageHome,
} from '../lib/units/villageActivity'
import { setUnitSuspension } from '../lib/units/unitSuspension'
import { shouldVillagerWork } from '../lib/units/villagerSchedule'
import { CampLeashController } from './patrol/CampLeashController'
import { advanceVillageWork } from './world/VillageWorkSimulation'
import { DistantVillageSystem } from './world/DistantVillageSystem'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import type { UnitEntity } from '../types/entities'
import type { PlayerLike } from '../types/player'

type Village = { home: VillageHome; owner: PlayerLike; units: UnitEntity[]; simplified: boolean; since: number }
const GATHER_ACTIONS = new Set(['chopwood', 'forageberry', 'farm', 'minestone', 'minegold', 'minecopper', 'mineiron'])

export class VillageActivitySystem {
  private sleeping = false
  private villages = new Map<string, Village>()
  private task: SchedulerTaskId | null = null
  private refreshAt = 0
  private reportAt = 0
  private leash: CampLeashController
  private playerWork: PlayerWorkActivitySystem
  private distant: DistantVillageSystem
  constructor(private context: GameContextLike) {
    this.leash = new CampLeashController(context)
    this.distant = new DistantVillageSystem(context)
    this.playerWork = new PlayerWorkActivitySystem(context)
    if (context.editor) return
    this.reconcile()
    registerVillageFlush(context, () => this.flush())
    this.task = context.scheduler.add(() => this.update(), 500, 'village.activity')
  }

  private reconcile(): void {
    const active = new Set<string>()
    for (const owner of this.context.players ?? []) {
      if (owner.isPlayed || owner.type !== 'AI') continue
      const centers = (owner.buildings ?? []).filter(
        b => b.type === 'TownCenter' && !b.isDead && !b.isDestroyed && getEntitySpaceId(b) === 'outside'
      )
      for (const center of centers) {
        const id = `${owner.label}:${center.label}`
        active.add(id)
        if (!this.villages.has(id))
          this.villages.set(id, {
            home: { id, i: center.i, j: center.j, spaceId: 'outside' },
            owner,
            units: [],
            simplified: false,
            since: this.context.scheduler.elapsedMs,
          })
      }
      for (const unit of owner.units ?? []) {
        if (unit.campPatrolAnchor || unit.banditCampAnchor || unit.isDead || unit.isDestroyed) continue
        if (!unit.villageHome || !active.has(unit.villageHome.id)) {
          const position =
            getEntitySpaceId(unit) === 'outside'
              ? unit
              : (this.context.map.spaces
                  ?.get(getEntitySpaceId(unit))
                  ?.portals?.find(portal => portal.targetSpaceId === 'outside')?.targetCell ?? unit)
          const nearest = centers.reduce<(typeof centers)[number] | undefined>(
            (best, center) =>
              !best ||
              Math.hypot(position.i - center.i, position.j - center.j) <
                Math.hypot(position.i - best.i, position.j - best.j)
                ? center
                : best,
            undefined
          )
          unit.villageHome = nearest ? this.villages.get(`${owner.label}:${nearest.label}`)?.home : undefined
        }
      }
    }
    for (const [id, village] of this.villages) {
      const next = (village.owner.units ?? []).filter(
        unit => !unit.isDead && !unit.isDestroyed && villageHome(unit)?.id === id
      )
      if (!active.has(id) || next.length !== village.units.length || next.some(unit => !village.units.includes(unit)))
        this.wake(village)
      village.units = next
      if (!active.has(id)) this.villages.delete(id)
    }
  }

  private supported(village: Village): boolean {
    return (
      village.units.some(unit => unit.type === 'Villager') &&
      village.units.every(unit =>
        unit.type !== 'Villager'
          ? !unit.action && !unit.spacePortalState
          : getEntitySpaceId(unit) === 'outside' &&
            !villageWorkNeedsLiveSearch(unit) &&
            !unit.shelterState &&
            !unit.spacePortalState &&
            !unit.resourceDeliveryState &&
            !unit.trainingTargetType &&
            !unit.pendingOrder &&
            !unit.combatMode &&
            !unit.waitingForEnergyAction &&
            !unit.actionLocked &&
            shouldVillagerWork(unit) &&
            (!unit.action || GATHER_ACTIONS.has(unit.action)) &&
            withinVillageActivity(unit, unit) &&
            (!unit.dest || withinVillageActivity(unit, unit.dest)) &&
            (['food', 'wood', 'stone', 'gold', 'copper', 'iron'].includes(unit.autonomousJob ?? '') ||
              ['woodcutter', 'forager', 'farmer', 'stoneminer', 'goldminer'].includes(unit.work ?? ''))
      )
    )
  }

  private observation(village: Village) {
    const radius =
      village.simplified || this.distant.has(village.owner) ? VILLAGE_DETAIL_ENTER_RADIUS : VILLAGE_DETAIL_EXIT_RADIUS
    return observeVillage(this.context, village.home, radius, village.units)
  }

  private advance(village: Village): void {
    if (!village.simplified) return
    const now = this.context.scheduler.elapsedMs
    const elapsed = Math.max(0, now - village.since)
    const run = () =>
      advanceVillageWork(
        this.context,
        village.home,
        village.owner,
        village.units.filter(
          u =>
            u.type === 'Villager' && u.owner === village.owner && !u.isDead && !u.isDestroyed && shouldVillagerWork(u)
        ),
        elapsed
      )
    if (this.context.performance) this.context.performance.measure('village.simulate', run)
    else run()
    village.since = now
  }

  private wake(village: Village): void {
    if (!village.simplified) return
    const run = () => this.resumeVillage(village)
    if (this.context.performance) this.context.performance.measure('village.wake', run)
    else run()
  }

  private resumeVillage(village: Village): void {
    this.context.performance?.markEvent?.('village.wake', {
      village: village.home.id,
      civilization: village.owner.civ ?? '',
      workers: village.units.filter(unit => unit.type === 'Villager').length,
      pendingMs: this.context.scheduler.elapsedMs - village.since,
    })
    this.advance(village)
    village.simplified = false
    for (const unit of village.units) {
      if (unit.type !== 'Villager') continue
      setUnitSuspension(unit)
      if (!unit.isDead && !unit.isDestroyed && unit.dest)
        unit.sendToEvt?.(unit.dest, unit.action, { forceRepath: true, preserveAutonomy: true })
    }
  }

  update(): void {
    if (this.sleeping) return
    this.playerWork.update()
    const now = this.context.scheduler.elapsedMs
    if (now >= this.refreshAt) {
      this.refreshAt = now + 5000
      this.reconcile()
    }
    const report = now >= this.reportAt
    if (report) this.reportAt = now + 5000
    const observations = new Map([...this.villages.values()].map(village => [village, this.observation(village)]))
    this.distant.update(
      [...this.villages.values()].map(village => ({
        home: village.home,
        owner: village.owner,
        observed: observations.get(village)?.reason !== 'distant',
      })),
      owner => {
        for (const village of this.villages.values()) if (village.owner === owner) this.wake(village)
      }
    )
    for (const village of this.villages.values()) {
      if (this.distant.has(village.owner)) {
        if (report)
          this.context.performance?.markEvent?.('village.state', {
            village: village.home.id,
            civilization: village.owner.civ ?? '',
            abstract: true,
            simplified: true,
            observed: false,
            units: village.units.length,
          })
        continue
      }
      const observation = observations.get(village)
      const observed = observation?.reason !== 'distant'
      const supported = this.supported(village)
      if (report)
        this.context.performance?.markEvent?.('village.state', {
          village: village.home.id,
          civilization: village.owner.civ ?? '',
          simplified: village.simplified,
          observed,
          observationReason: observation?.reason ?? 'unknown',
          observer: observation?.actor ?? '',
          observerDistance: observation?.distance ?? -1,
          supported,
          units: village.units.length,
          activities: [...new Set(village.units.map(unit => unit.action ?? 'idle'))].join(','),
        })
      if (observed || !supported) this.wake(village)
      else if (!village.simplified) {
        this.context.performance?.markEvent?.('village.sleep', {
          village: village.home.id,
          civilization: village.owner.civ ?? '',
          workers: village.units.filter(unit => unit.type === 'Villager').length,
        })
        village.simplified = true
        village.since = now
        for (const unit of village.units) {
          if (unit.type !== 'Villager') continue
          setUnitSuspension(unit, { reason: 'distant-work', wake: () => this.wake(village) })
          unit.stopInterval?.()
          unit.stopTimeout?.()
          unit.path = []
          unit.gatherProgressState = null
          unit.sprite?.stop?.()
          if (unit.sprite) {
            delete unit.sprite.onFrameChange
            delete unit.sprite.onLoop
            delete unit.sprite.onComplete
          }
        }
      } else if (now - village.since >= VILLAGE_SIMULATION_STEP_MS) this.advance(village)
      if (village.simplified) continue
      for (const unit of village.units) {
        if (isVillageSupplyTrip(unit)) continue
        if (unit.action !== 'attack' && unit.dest && !withinVillageActivity(unit, unit.dest)) {
          this.leash.recall(unit)
        }
        if (
          unit.action === 'attack' ||
          unit.campBehavior?.phase === 'pursue' ||
          unit.campBehavior?.phase === 'return' ||
          campDistance(unit) > VILLAGE_ACTIVITY_RADIUS + VILLAGE_PATH_MARGIN
        )
          this.leash.update(unit)
      }
    }
  }

  flush(): void {
    if (this.sleeping) return
    this.playerWork.flush()
    this.distant.flush()
    for (const village of this.villages.values()) this.advance(village)
  }
  /** Settle old checkpoints before another simulation takes ownership of time. */
  beginSleep(): void {
    this.flush()
    this.playerWork.destroy()
    this.distant.destroy()
    for (const village of this.villages.values()) this.wake(village)
    this.sleeping = true
  }

  endSleep(): void {
    if (!this.sleeping) return
    this.sleeping = false
    this.playerWork = new PlayerWorkActivitySystem(this.context)
    this.distant = new DistantVillageSystem(this.context)
    for (const village of this.villages.values()) village.since = this.context.scheduler.elapsedMs
    this.refreshAt = 0
  }

  destroy(): void {
    this.playerWork.destroy()
    this.distant.destroy()
    for (const village of this.villages.values()) this.wake(village)
    registerVillageFlush(this.context)
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.villages.clear()
  }
}
