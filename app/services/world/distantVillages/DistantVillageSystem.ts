import { configureVillageNightWatch } from '../../../lib/units/village/villageNightWatch'
import { DAY_NIGHT_CONFIG } from '../../../config/gameplay'
import { restoreOfflineUnitSleepHealth } from '../../../lib/units/unitSleepHealth'
import { isStaticSettlement } from '../../../config/settlementProfiles'
import { traceRuntime } from '../../../lib/runtimeDiagnostics'
import { villageWorkNeedsLiveSearch } from '../../../lib/units/village/villageSupplyTrips'
import { isContinentWorld } from '../../../config/continentWorlds'
import { getEntitySpaceId } from '../../../lib/mapSpaces'
import { cancelEnergyWait, updateUnitEnergy } from '../../../lib/units/unitEnergy'
import { VILLAGE_ACTIVITY_RADIUS } from '../../../config/villageActivity'
import {
  setDistantOwner,
  registerDistantDailyPlanning,
  withinVillageActivity,
  type VillageHome,
} from '../../../lib/units/village/villageActivity'
import { isUnitSuspended, setUnitSuspension } from '../../../lib/units/unitSuspension'
import { advanceDistantVillageEconomy, planDistantVillageBuildings } from './DistantVillageEconomy'
import type { GameContextLike } from '../../../types/context'
import type { PlayerLike } from '../../../types/player'
import type { UnitEntity } from '../../../types/entities'

type DistantVillageCandidate = { home: VillageHome; owner: PlayerLike; observed: boolean }
type DistantOwner = {
  homes: VillageHome[]
  waking: boolean
  restSince: number
  // Dynamic villages additionally advance work and economic events.
  economy?: { since: number; advancing: boolean }
}
const WORK_ACTIONS = new Set([
  'chopwood',
  'forageberry',
  'farm',
  'minestone',
  'minegold',
  'minecopper',
  'minetin',
  'mineiron',
  'build',
  'delivery',
  'hunt',
  'takemeat',
])

/** Distance controls suspension independently from economic simulation.
 * Static RPG settlements only sleep; dynamic owners also retain an economic checkpoint.
 * Entities stay addressable for saves, quests and combat, without worker callbacks.
 */
export class DistantVillageSystem {
  private owners = new Map<PlayerLike, DistantOwner>()
  private pendingPlans = new Set<PlayerLike>()
  private shuttingDown = false
  constructor(private context: GameContextLike) {
    registerDistantDailyPlanning(context, () => {
      for (const [owner, state] of this.owners) if (state.economy) this.pendingPlans.add(owner)
    })
  }

  private now(): number {
    return this.context.dayNight?.getElapsedMs?.() ?? this.context.scheduler.elapsedMs
  }

  has(owner: PlayerLike): boolean {
    return this.owners.has(owner)
  }

  private safe(owner: PlayerLike): boolean {
    return (
      (isStaticSettlement(owner) ||
        owner.units.some(unit => unit.type === 'Villager' && !unit.isDead && !unit.isDestroyed)) &&
      owner.units.every(unit => {
        if (unit.isDead || unit.isDestroyed) return true
        if (isStaticSettlement(owner))
          return Boolean(
            unit.villageHome &&
              !unit.followingHero &&
              unit.controlMode !== 'hero' &&
              !unit.trainingTargetType &&
              !unit.spacePortalState &&
              !unit.pendingOrder &&
              !unit.combatMode &&
              unit.action !== 'attack' &&
              unit.action !== 'flee' &&
              !(unit as UnitEntity & { factionExpedition?: unknown }).factionExpedition
          )
        // Training remains under its existing live owner, including entry/exit.
        if (unit.trainingTargetType || unit.action === 'train') return true
        return Boolean(
          unit.villageHome &&
            !villageWorkNeedsLiveSearch(unit) &&
            !unit.followingHero &&
            unit.controlMode !== 'hero' &&
            !unit.campPatrolAnchor &&
            !unit.banditCampAnchor &&
            unit.type !== 'Scout' &&
            !(unit as UnitEntity & { factionExpedition?: unknown }).factionExpedition &&
            !unit.shelterState &&
            !unit.spacePortalState &&
            !unit.pendingOrder &&
            !unit.combatMode &&
            !unit.actionLocked &&
            getEntitySpaceId(unit) === 'outside' &&
            withinVillageActivity(unit, unit) &&
            (!unit.action || WORK_ACTIONS.has(unit.action)) &&
            (!unit.dest || withinVillageActivity(unit, unit.dest))
        )
      })
    )
  }

  private suspend(owner: PlayerLike): void {
    for (const unit of owner.units) {
      if (
        unit.isDead ||
        unit.isDestroyed ||
        unit.trainingTargetType ||
        unit.action === 'train' ||
        isUnitSuspended(unit)
      )
        continue
      setUnitSuspension(unit, { reason: 'distant-work', wake: () => this.wake(owner) })
      unit.stopInterval?.()
      unit.stopTimeout?.()
      cancelEnergyWait(unit)
      unit.path = []
      unit.gatherProgressState = null
      unit.sprite?.stop?.()
      if (unit.sprite) {
        delete unit.sprite.onFrameChange
        delete unit.sprite.onLoop
      }
    }
  }

  /** Dynamic owners settle their local work before entering economic simulation. */
  update(candidates: DistantVillageCandidate[], prepare: (owner: PlayerLike) => void): void {
    const grouped = new Map<PlayerLike, DistantVillageCandidate[]>()
    for (const village of candidates) {
      if (
        !isStaticSettlement(village.owner) &&
        (this.context.isTutorialActive?.() || !isContinentWorld(this.context.map.worldId))
      )
        continue
      const list = grouped.get(village.owner) ?? []
      list.push(village)
      grouped.set(village.owner, list)
    }
    for (const owner of this.owners.keys()) {
      const villages = grouped.get(owner)
      if (villages) {
        for (const unit of owner.units) {
          if (unit.villageHome || unit.isDead || unit.isDestroyed) continue
          const nearest = villages.reduce<(typeof villages)[number] | undefined>(
            (best, village) =>
              !best ||
              Math.hypot(unit.i - village.home.i, unit.j - village.home.j) <
                Math.hypot(unit.i - best.home.i, unit.j - best.home.j)
                ? village
                : best,
            undefined
          )
          if (nearest && Math.hypot(unit.i - nearest.home.i, unit.j - nearest.home.j) <= VILLAGE_ACTIVITY_RADIUS)
            unit.villageHome = nearest.home
        }
      }
      const homes = this.owners.get(owner)?.homes ?? []
      const changedHomes =
        villages?.length !== homes.length ||
        villages?.some(v => !homes.some(home => home.id === v.home.id && home.i === v.home.i && home.j === v.home.j))
      if (!villages?.length || changedHomes || villages.some(v => v.observed) || !this.safe(owner)) this.wake(owner)
    }
    let entered = false
    for (const [owner, villages] of grouped) {
      if (this.owners.has(owner)) {
        this.suspend(owner)
        continue
      }
      // Stagger initial transitions/planning instead of waking all AIs together.
      if ((!isStaticSettlement(owner) && entered) || villages.some(v => v.observed) || !this.safe(owner)) continue
      configureVillageNightWatch(owner)
      const economic = !isStaticSettlement(owner)
      if (economic) prepare(owner)
      this.owners.set(owner, {
        homes: villages.map(v => v.home),
        waking: false,
        restSince: this.now(),
        ...(economic ? { economy: { since: this.now(), advancing: false } } : {}),
      })
      setDistantOwner(owner, () => this.wake(owner))
      this.suspend(owner)
      if (!isStaticSettlement(owner)) {
        this.pendingPlans.add(owner)
        entered = true
      }
      this.context.performance?.markEvent?.('village.abstract', { owner: owner.label, villages: villages.length })
    }
    const owner = this.pendingPlans.values().next().value as PlayerLike | undefined
    if (owner) {
      const state = this.owners.get(owner)
      if (state?.economy) {
        this.advance(owner, state)
        const day = this.context.dayNight?.state.day ?? 1
        const alreadyPlanned =
          (owner as PlayerLike & { offlineBuildingPlanDay?: number }).offlineBuildingPlanDay === day
        if (alreadyPlanned) {
          this.pendingPlans.delete(owner)
          return
        }
        planDistantVillageBuildings(this.context, owner, state.homes)
        // Recruitment uses normal paid training. Only those trainees stay live.
        for (const unit of owner.units) setUnitSuspension(unit)
        try {
          ;(owner as PlayerLike & { planDistantProduction?: () => void }).planDistantProduction?.()
        } finally {
          this.suspend(owner)
        }
      }
      this.pendingPlans.delete(owner)
    }
  }

  private advance(owner: PlayerLike, state: DistantOwner): void {
    const economy = state.economy
    if (!economy) {
      const now = this.now()
      if (now <= state.restSince) return
      const minuteMs = DAY_NIGHT_CONFIG.dayLengthMs / (DAY_NIGHT_CONFIG.hoursPerDay * 60)
      for (const unit of owner.units) {
        if (!isUnitSuspended(unit)) continue
        restoreOfflineUnitSleepHealth(
          unit,
          DAY_NIGHT_CONFIG.startHour * 60 + state.restSince / minuteMs,
          DAY_NIGHT_CONFIG.startHour * 60 + now / minuteMs
        )
        updateUnitEnergy(unit, now - state.restSince)
      }
      state.restSince = now
      return
    }
    const now = this.now()
    if (now <= economy.since || economy.advancing) return
    const run = () => advanceDistantVillageEconomy(this.context, owner, state.homes, economy.since, now)
    economy.advancing = true
    try {
      if (this.context.performance) this.context.performance.measure('village.abstractAdvance', run)
      else run()
      for (const unit of owner.units) if (isUnitSuspended(unit)) updateUnitEnergy(unit, now - economy.since)
      // Commit the checkpoint only after the transaction succeeds.
      economy.since = now
    } finally {
      economy.advancing = false
    }
  }

  wake(owner: PlayerLike): void {
    const state = this.owners.get(owner)
    if (!state || state.waking || state.economy?.advancing) return
    traceRuntime(
      'village.wake',
      () => this.wakeNow(owner, state),
      { owner: owner.label, civ: owner.civ, units: owner.units.length, buildings: owner.buildings.length },
      `village.wake.${owner.label}`
    )
  }

  private wakeNow(owner: PlayerLike, state: DistantOwner): void {
    state.waking = true
    try {
      traceRuntime(
        'village.catchUp',
        () => this.advance(owner, state),
        { owner: owner.label },
        `village.catchUp.${owner.label}`
      )
    } catch (error) {
      state.waking = false
      throw error
    }
    this.owners.delete(owner)
    this.pendingPlans.delete(owner)
    setDistantOwner(owner)
    const resuming = owner.units.filter(isUnitSuspended)
    const alreadyResting = new Set(resuming.filter(unit => unit.shelterState))
    for (const unit of resuming) setUnitSuspension(unit)
    if (!this.shuttingDown) this.context.unitRest?.synchronizeVillageRest?.(resuming)
    for (const unit of resuming) {
      const destination = unit.dest
      if (!unit.isDead && !unit.isDestroyed && !unit.shelterState && !alreadyResting.has(unit) && destination)
        traceRuntime(
          'village.resumeOrder',
          () => unit.sendToEvt?.(destination, unit.action, { forceRepath: true, preserveAutonomy: true }),
          {
            owner: owner.label,
            unit: unit.label,
            type: unit.type,
            action: unit.action,
            i: unit.i,
            j: unit.j,
            toI: destination.i,
            toJ: destination.j,
          },
          `village.resumeOrder.${owner.label}.${unit.label}`
        )
    }
    this.context.performance?.markEvent?.('village.detailed', { owner: owner.label })
  }

  flush(): void {
    for (const [owner, state] of this.owners) this.advance(owner, state)
  }

  destroy(): void {
    this.shuttingDown = true
    for (const owner of this.owners.keys()) this.wake(owner)
    registerDistantDailyPlanning(this.context)
  }
}
