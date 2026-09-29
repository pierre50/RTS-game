import {
  VILLAGE_ACTIVITY_RADIUS,
  VILLAGE_DETAIL_ENTER_RADIUS,
  VILLAGE_DETAIL_EXIT_RADIUS,
  VILLAGE_PATH_MARGIN,
} from '../../config/villageActivity'
import { activeConstructionSite, belongsToSettlement, collectiveAnchor } from '../../lib/economy/collectiveConstruction'
import { communalStoreBuilding } from '../../lib/economy/constructionStores'
import { allowsVillagerDeliveries, storageAcceptsResource } from '../../lib/resources/storagePolicy'
import { getEntitySpaceId } from '../../lib/mapSpaces'
import { type VillageHome } from '../../lib/units/villageActivity'
import { isUnitSuspended, setUnitSuspension } from '../../lib/units/unitSuspension'
import { cancelEnergyWait, updateUnitEnergy } from '../../lib/units/unitEnergy'
import { observeVillage } from './VillageObservation'
import { advanceVillageWork } from './VillageWorkSimulation'
import type { GameContextLike } from '../../types/context'
import type { UnitEntity } from '../../types/entities'

type WorkSession = { home: VillageHome; since: number; waking: boolean; advancing?: boolean }
const ACTIONS = new Set([
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

/** Autonomous player villagers share one economic transaction, without AI project planning. */
export class PlayerWorkActivitySystem {
  private sessions = new Map<UnitEntity, WorkSession>()
  private cooldown = new WeakMap<UnitEntity, number>()
  constructor(private context: GameContextLike) {}

  private now(): number {
    return this.context.dayNight?.getElapsedMs?.() ?? this.context.scheduler.elapsedMs
  }

  private eligible(unit: UnitEntity): boolean {
    return Boolean(
      unit.owner?.isPlayed &&
        unit.type === 'Villager' &&
        unit !== this.context.controls?.heroUnit &&
        unit.controlMode !== 'hero' &&
        !unit.followingHero &&
        !unit.isDead &&
        !unit.isDestroyed &&
        getEntitySpaceId(unit) === 'outside' &&
        !unit.shelterState &&
        !unit.spacePortalState &&
        (!unit.resourceDeliveryState || Boolean(unit.resourceDeliveryState.pickup)) &&
        !unit.trainingTargetType &&
        !unit.pendingOrder &&
        !unit.combatMode &&
        !unit.actionLocked &&
        (!unit.action || ACTIONS.has(unit.action))
    )
  }

  /** Keep the complete supply trip live if the bounded snapshot would omit part of it. */
  private localWork(unit: UnitEntity, home: VillageHome): boolean {
    const local = (point: { i: number; j: number; spaceId?: string | null }, margin = 0) =>
      getEntitySpaceId(point) === 'outside' &&
      Math.hypot(point.i - home.i, point.j - home.j) <= VILLAGE_ACTIVITY_RADIUS + margin
    if (!local(unit) || (unit.dest && !local(unit.dest))) return false
    if (unit.path?.some(cell => !local(cell, VILLAGE_PATH_MARGIN))) return false
    // Missing targets must keep retrying in the live world, including distant deposits.
    if (unit.autonomyBlockedJob || (unit.autonomousJob && !unit.dest)) return false
    const owner = unit.owner!
    const anchor = collectiveAnchor(owner, unit)
    if (!local(anchor)) return false
    const site = activeConstructionSite(owner, unit)
    if (site && !local(site)) return false
    const delivery = unit.resourceDeliveryState
    if (delivery?.building && !local(delivery.building)) return false
    if (delivery?.returnTask?.dest && !local(delivery.returnTask.dest)) return false
    // Include potential return depots even before the worker's bag is full.
    const resource =
      unit.collectiveTask ??
      unit.autonomousJob ??
      { woodcutter: 'wood', forager: 'food', farmer: 'food', hunter: 'food', stoneminer: 'stone', goldminer: 'gold' }[
        unit.work ?? ''
      ]
    if (resource && resource !== 'construction') {
      for (const building of owner.buildings ?? []) {
        if (building.isDead || building.isDestroyed || !allowsVillagerDeliveries(building, owner)) continue
        const depot = communalStoreBuilding(building, owner)
        // Collective deliveries stay in their origin settlement, as in offline work.
        if (depot && unit.collectiveTask && unit.collectiveHome && !belongsToSettlement(owner, anchor, depot)) continue
        if (depot && storageAcceptsResource(depot.type, resource) && !local(depot)) return false
      }
    }
    return true
  }

  update(): void {
    for (const [unit, state] of this.sessions) {
      const reason = observeVillage(this.context, state.home, VILLAGE_DETAIL_ENTER_RADIUS, [unit])
      if (
        !this.eligible(unit) ||
        !this.localWork(unit, state.home) ||
        reason.reason !== 'distant' ||
        this.context.isTutorialActive?.()
      )
        this.wake(unit)
    }
    if (this.context.isTutorialActive?.()) return
    // At most one transition per tick. No recurring worker simulation while away.
    for (const owner of this.context.players ?? []) {
      if (!owner.isPlayed) continue
      for (const unit of owner.units ?? []) {
        if (
          this.sessions.has(unit) ||
          isUnitSuspended(unit) ||
          !this.eligible(unit) ||
          (this.cooldown.get(unit) ?? 0) > this.now()
        )
          continue
        const anchor = collectiveAnchor(owner, unit)
        const home = { id: `player-work:${unit.label}`, i: anchor.i, j: anchor.j, spaceId: anchor.spaceId ?? 'outside' }
        if (!this.localWork(unit, home)) continue
        // Longer routes and interior orders continue in the ordinary runtime.
        if (observeVillage(this.context, home, VILLAGE_DETAIL_EXIT_RADIUS, [unit]).reason !== 'distant') continue
        // Settle the existing cohort before joining, so nobody receives work retroactively.
        const peer = [...this.sessions.keys()].find(candidate => candidate.owner === owner)
        if (peer) this.advance(peer, this.sessions.get(peer)!)
        this.sessions.set(unit, { home, since: this.now(), waking: false })
        setUnitSuspension(unit, { reason: 'distant-work', wake: () => this.wake(unit) })
        unit.stopInterval?.()
        unit.stopTimeout?.()
        cancelEnergyWait(unit)
        unit.path = []
        unit.gatherProgressState = null
        unit.sprite?.stop?.()
        if (unit.sprite) {
          delete unit.sprite.onFrameChange
          delete unit.sprite.onLoop
          delete unit.sprite.onComplete
        }
        this.context.performance?.markEvent?.('player.work.distant', {
          unit: unit.label,
          action: unit.action ?? 'idle',
        })
        return
      }
    }
  }

  private advance(unit: UnitEntity, state: WorkSession): void {
    const now = this.now()
    if (now <= state.since || !unit.owner || state.advancing) return
    const cohort = [...this.sessions].filter(([member]) => member.owner === unit.owner)
    const run = () =>
      advanceVillageWork(
        this.context,
        cohort.map(([, session]) => session.home),
        unit.owner!,
        cohort.map(([member]) => member),
        now - state.since,
        state.since
      )
    for (const [, session] of cohort) session.advancing = true
    try {
      if (this.context.performance) this.context.performance.measure('player.work.advance', run)
      else run()
      for (const [member, session] of cohort) {
        updateUnitEnergy(member, now - session.since)
        session.since = now
      }
    } finally {
      for (const [, session] of cohort) session.advancing = false
    }
  }

  private wake(unit: UnitEntity): void {
    const state = this.sessions.get(unit)
    if (!state || state.waking || state.advancing) return
    state.waking = true
    try {
      this.advance(unit, state)
    } catch (error) {
      state.waking = false
      throw error
    }
    this.sessions.delete(unit)
    setUnitSuspension(unit)
    this.cooldown.set(unit, this.now() + 2000)
    if (!unit.isDead && !unit.isDestroyed && unit.dest)
      unit.sendToEvt?.(unit.dest, unit.action, { forceRepath: true, preserveAutonomy: true })
    this.context.performance?.markEvent?.('player.work.detailed', { unit: unit.label })
  }

  flush(): void {
    for (const [unit, state] of this.sessions) this.advance(unit, state)
  }

  destroy(): void {
    for (const unit of this.sessions.keys()) this.wake(unit)
  }
}
