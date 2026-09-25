import { isContinentWorld } from '../../config/continentWorlds'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { cancelEnergyWait, updateUnitEnergy } from '../../lib/units/unitEnergy'
import { VILLAGE_ACTIVITY_RADIUS } from '../../config/villageActivity'
import {
  setDistantOwner,
  registerDistantDailyPlanning,
  withinVillageActivity,
  type VillageHome,
} from '../../lib/units/villageActivity'
import { isUnitSuspended, setUnitSuspension } from '../../lib/units/unitSuspension'
import { advanceDistantVillageEconomy, planDistantVillageBuildings } from './DistantVillageEconomy'
import type { GameContextLike } from '../../types/context'
import type { PlayerLike } from '../../types/player'
import type { UnitEntity } from '../../types/entities'

type DistantVillageCandidate = { home: VillageHome; owner: PlayerLike; observed: boolean }
type DistantOwner = { homes: VillageHome[]; since: number; waking: boolean }
const WORK_ACTIONS = new Set([
  'chopwood',
  'forageberry',
  'farm',
  'minestone',
  'minegold',
  'minecopper',
  'mineiron',
  'build',
  'delivery',
  'hunt',
  'takemeat',
])

/** A faction is one economic transaction, even if its villages share chests.
 * Mixed/hostile areas remain detailed; a distant faction has no recurring AI work.
 * Entities stay addressable for saves, quests and combat, without worker callbacks.
 */
export class DistantVillageSystem {
  private owners = new Map<PlayerLike, DistantOwner>()
  private pendingPlans = new Set<PlayerLike>()
  constructor(private context: GameContextLike) {
    registerDistantDailyPlanning(context, () => {
      for (const owner of this.owners.keys()) this.pendingPlans.add(owner)
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
      owner.units.some(unit => unit.type === 'Villager' && !unit.isDead && !unit.isDestroyed) &&
      owner.units.every(unit => {
        if (unit.isDead || unit.isDestroyed) return true
        // Training remains under its existing live owner, including entry/exit.
        if (unit.trainingTargetType || unit.action === 'train') return true
        return Boolean(
          unit.villageHome &&
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

  /** Returns owners newly entering; caller settles any legacy local work first. */
  update(candidates: DistantVillageCandidate[], prepare: (owner: PlayerLike) => void): void {
    const grouped = new Map<PlayerLike, DistantVillageCandidate[]>()
    if (isContinentWorld(this.context.map.worldId) && !this.context.isTutorialActive?.()) {
      for (const village of candidates) {
        const list = grouped.get(village.owner) ?? []
        list.push(village)
        grouped.set(village.owner, list)
      }
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
      if (entered || villages.some(v => v.observed) || !this.safe(owner)) continue
      prepare(owner)
      this.owners.set(owner, { homes: villages.map(v => v.home), since: this.now(), waking: false })
      setDistantOwner(owner, () => this.wake(owner))
      this.suspend(owner)
      this.pendingPlans.add(owner)
      entered = true
      this.context.performance?.markEvent?.('village.abstract', { owner: owner.label, villages: villages.length })
    }
    const owner = this.pendingPlans.values().next().value as PlayerLike | undefined
    if (owner) {
      const state = this.owners.get(owner)
      if (state) {
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
    const now = this.now()
    if (now <= state.since) return
    const run = () => advanceDistantVillageEconomy(this.context, owner, state.homes, state.since, now)
    if (this.context.performance) this.context.performance.measure('village.abstractAdvance', run)
    else run()
    for (const unit of owner.units) if (isUnitSuspended(unit)) updateUnitEnergy(unit, now - state.since)
    // Commit the checkpoint only after the transaction succeeds.
    state.since = now
  }

  wake(owner: PlayerLike): void {
    const state = this.owners.get(owner)
    if (!state || state.waking) return
    state.waking = true
    try {
      this.advance(owner, state)
    } catch (error) {
      state.waking = false
      throw error
    }
    this.owners.delete(owner)
    this.pendingPlans.delete(owner)
    setDistantOwner(owner)
    for (const unit of owner.units) {
      if (!isUnitSuspended(unit)) continue
      setUnitSuspension(unit)
      if (!unit.isDead && !unit.isDestroyed && unit.dest)
        unit.sendToEvt?.(unit.dest, unit.action, { forceRepath: true, preserveAutonomy: true })
    }
    this.context.performance?.markEvent?.('village.detailed', { owner: owner.label })
  }

  flush(): void {
    for (const [owner, state] of this.owners) this.advance(owner, state)
  }

  destroy(): void {
    for (const owner of this.owners.keys()) this.wake(owner)
    registerDistantDailyPlanning(this.context)
  }
}
