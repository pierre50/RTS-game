import {
  VILLAGE_ACTIVITY_RADIUS,
  VILLAGE_DETAIL_ENTER_RADIUS,
  VILLAGE_DETAIL_EXIT_RADIUS,
} from '../../config/villageActivity'
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

  update(): void {
    for (const [unit, state] of this.sessions) {
      const reason = observeVillage(this.context, state.home, VILLAGE_DETAIL_ENTER_RADIUS, [unit])
      if (!this.eligible(unit) || reason.reason !== 'distant' || this.context.isTutorialActive?.()) this.wake(unit)
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
        const home = { id: `player-work:${unit.label}`, i: unit.i, j: unit.j, spaceId: 'outside' }
        if (
          unit.dest &&
          (getEntitySpaceId(unit.dest) !== 'outside' ||
            Math.hypot(unit.dest.i - home.i, unit.dest.j - home.j) > VILLAGE_ACTIVITY_RADIUS)
        )
          continue
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
