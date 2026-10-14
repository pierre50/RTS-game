import { reconcileSettlementResidents } from '../lib/territory/settlementResidents'
import { AmbientTrafficSystem } from './travel/ambient/AmbientTrafficSystem'
import { RoadTravelSystem } from './travel/RoadTravelSystem'
import { getDeferredVillages } from './world/distantVillages/DeferredVillageStore'
import { AMBIENT_CAMERA_MARGIN, AMBIENT_CAMERA_EXIT_MARGIN } from './world/AmbientActivityArea'
import { isStaticSettlement } from '../config/world/settlementProfiles'
import { isVillageSupplyTrip } from '../lib/units/village/villageSupplyTrips'
import { observeVillage, type VillageObservation } from './world/VillageObservation'
import { PlayerWorkActivitySystem } from './world/PlayerWorkActivitySystem'
import {
  VILLAGE_DETAIL_ENTER_RADIUS,
  VILLAGE_DETAIL_EXIT_RADIUS,
  VILLAGE_SIMULATION_STEP_MS,
} from '../config/villageActivity'
import { registerVillageFlush, villageHome, withinVillageActivity } from '../lib/units/village/villageActivity'
import { setUnitSuspension } from '../lib/units/unitSuspension'
import { shouldVillagerWork } from '../lib/units/village/villagerSchedule'
import { CampLeashController } from './patrol/CampLeashController'
import { advanceVillageWork } from './world/VillageWorkSimulation'
import { DistantVillageSystem } from './world/distantVillages/DistantVillageSystem'
import type { GameContextLike, SchedulerTaskId } from '../types/context'
import {
  activeTownCenters,
  isVillageSimulationSupported,
  reportAbstractVillageState,
  reportVillageState,
  suspendVillageWorkers,
  villageResidentsChanged,
  villageUnitNeedsLeash,
  villageWorkerCount,
  type Village,
} from './VillageActivityRules'

export class VillageActivitySystem {
  private ambientTraffic: AmbientTrafficSystem
  private roadTravel: RoadTravelSystem
  private sleeping = false
  private villages = new Map<string, Village>()
  private task: SchedulerTaskId | null = null
  private refreshAt = 0
  private reportAt = 0
  private leash: CampLeashController
  private playerWork: PlayerWorkActivitySystem
  private distant: DistantVillageSystem
  constructor(private context: GameContextLike) {
    this.roadTravel = new RoadTravelSystem(context)
    this.leash = new CampLeashController(context)
    this.ambientTraffic = new AmbientTrafficSystem(context, this.leash)
    this.distant = new DistantVillageSystem(context)
    this.playerWork = new PlayerWorkActivitySystem(context)
    if (context.editor) return
    getDeferredVillages(this.context.map)?.update()
    this.reconcile()
    // Freeze fixed settlements before the first AI/autonomy tick can issue orders.
    this.distant.update(
      [...this.villages.values()]
        .filter(village => isStaticSettlement(village.owner))
        .map(village => ({
          home: village.home,
          owner: village.owner,
          observed: this.observation(village).reason !== 'distant',
        })),
      () => {}
    )
    registerVillageFlush(context, () => this.flush())
    this.task = context.scheduler.add(() => this.update(), 500, 'village.activity')
  }

  private reconcile(): void {
    const active = new Set<string>()
    for (const owner of this.context.players ?? []) {
      reconcileSettlementResidents(owner)
      if (owner.isPlayed || owner.type !== 'AI') continue
      for (const center of activeTownCenters(owner)) {
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
    }
    for (const [id, village] of this.villages) {
      const next = (village.owner.units ?? []).filter(
        unit => !unit.isDead && !unit.isDestroyed && villageHome(unit)?.id === id
      )
      if (!active.has(id) || villageResidentsChanged(village, next)) this.wake(village)
      village.units = next
      if (!active.has(id)) this.villages.delete(id)
    }
  }

  private observation(village: Village) {
    const sleeping = village.simplified || this.distant.has(village.owner)
    const radius = sleeping ? VILLAGE_DETAIL_ENTER_RADIUS : VILLAGE_DETAIL_EXIT_RADIUS
    return observeVillage(
      this.context,
      village.home,
      radius,
      village.units,
      isStaticSettlement(village.owner),
      sleeping ? AMBIENT_CAMERA_MARGIN : AMBIENT_CAMERA_EXIT_MARGIN
    )
  }

  private advance(village: Village): void {
    if (!village.simplified) return
    if (isStaticSettlement(village.owner)) return
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
      workers: villageWorkerCount(village),
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
    getDeferredVillages(this.context.map)?.update()
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
        if (report) reportAbstractVillageState(this.context, village)
        continue
      }
      this.updateLiveVillage(village, observations.get(village), report, now)
    }
  }

  private updateLiveVillage(
    village: Village,
    observation: VillageObservation | undefined,
    report: boolean,
    now: number
  ): void {
    const observed = observation?.reason !== 'distant'
    const supported = isVillageSimulationSupported(village)
    if (report) reportVillageState(this.context, village, observation, supported)
    if (observed || !supported) this.wake(village)
    else if (!village.simplified) this.suspendVillage(village, now)
    else if (now - village.since >= VILLAGE_SIMULATION_STEP_MS) this.advance(village)
    if (village.simplified) return
    for (const unit of village.units) {
      if (isVillageSupplyTrip(unit)) continue
      if (unit.action !== 'attack' && unit.dest && !withinVillageActivity(unit, unit.dest)) {
        this.leash.recall(unit)
      }
      if (villageUnitNeedsLeash(unit)) this.leash.update(unit)
    }
  }

  private suspendVillage(village: Village, now: number): void {
    this.context.performance?.markEvent?.('village.sleep', {
      village: village.home.id,
      civilization: village.owner.civ ?? '',
      workers: villageWorkerCount(village),
    })
    village.simplified = true
    village.since = now
    suspendVillageWorkers(village, () => this.wake(village))
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
    this.ambientTraffic.destroy()
    this.roadTravel.destroy()
    this.playerWork.destroy()
    this.distant.destroy()
    for (const village of this.villages.values()) this.wake(village)
    registerVillageFlush(this.context)
    if (this.task != null) this.context.scheduler.remove(this.task)
    this.villages.clear()
  }
}
