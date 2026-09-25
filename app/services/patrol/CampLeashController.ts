import { clearCombatAttackRecovery } from '../../lib/combat/combatAttackLoop'
import {
  campAnchor,
  campDistance,
  canCampPursue,
  CAMP_RETURN_RANGE,
  CAMP_TETHER_RANGE,
} from '../../lib/units/campBehavior'
import { getEntitySpaceId, sameMapSpace } from '../../lib/mapSpaces'
import { instanceIsInInsightRange } from '../../lib/units/insightDetection'
import { playerSeesTarget } from '../../lib/units/playerTargetKnowledge'
import { cancelPendingAggression } from '../../lib/combat/combatFeedback'
import { getCellsAroundPoint } from '../../lib/grid/cells'
import { canUnitUseCellAsIdleDestination } from '../../lib/buildings/passageCells'
import { clearUnitSpacePortalRoute, routeUnitThroughSpacePortal } from '../SpacePortalSystem'
import type { GameContextLike } from '../../types/context'
import type { RuntimeCell } from '../../types/map'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'

const SEARCH_MS = 3000
const RETURN_RETRY_MS = 2000

type Tracking = {
  target?: RuntimeEntity
  lostAt?: number
  retryAt: number
  lastKnown?: RuntimeCell
  returnCandidate?: number
}

export class CampLeashController {
  private tracking = new WeakMap<UnitEntity, Tracking>()
  constructor(private context: GameContextLike) {}

  recall(unit: UnitEntity): void {
    const state = (unit.campBehavior ??= { phase: 'guard' })
    state.phase = 'return'
    clearUnitSpacePortalRoute(unit)
    cancelPendingAggression(unit)
    clearCombatAttackRecovery(unit)
    unit.handleChangeDest?.()
    unit.stopInterval?.()
    unit.stopTimeout?.()
    unit.path = []
    unit.action = null
    unit.dest = null
    unit.realDest = null
    unit.previousDest = null
    unit.pendingOrder = null
    unit.actionLocked = false
  }

  /** True means this unit is returning and must not acquire a new target. */
  update(unit: UnitEntity): boolean {
    const anchor = campAnchor(unit)
    if (!anchor) return false
    const now = this.context.scheduler.elapsedMs
    const state = (unit.campBehavior ??= { phase: 'guard' })
    let track = this.tracking.get(unit)
    if (!track) {
      track = { retryAt: 0 }
      this.tracking.set(unit, track)
    }
    const dest = unit.spacePortalState?.combatTarget ?? unit.dest
    if (dest && 'family' in dest && (unit.action === 'attack' || unit.spacePortalState?.combatTarget)) {
      track.target = dest as RuntimeEntity
      if (state.phase !== 'return') state.phase = 'pursue'
    }
    let abandon = campDistance(unit) > (state.tetherRange ?? CAMP_TETHER_RANGE)
    if (state.phase === 'pursue') {
      const target = track.target
      const visible =
        target &&
        sameMapSpace(unit, target) &&
        instanceIsInInsightRange(unit, target) &&
        playerSeesTarget(unit.owner, target)
      // A valid portal pursuit gets the same short grace period as a lost target.
      if (target?.isDead || target?.isDestroyed) abandon = true
      else if (visible && target) {
        track.lostAt = undefined
        const grid = this.context.map.spaces?.get(getEntitySpaceId(target))?.grid ?? this.context.map.grid
        track.lastKnown = grid[target.i]?.[target.j]
        if (!canCampPursue(unit, target)) abandon = true
      } else {
        if (!abandon && track.lostAt == null && !unit.spacePortalState && track.lastKnown) {
          unit.sendToEvt?.(track.lastKnown, null, { forceRepath: true, preserveAutonomy: true })
          track.lostAt = now
          return true
        }
        track.lostAt ??= now
        if (now - track.lostAt >= SEARCH_MS) abandon = true
      }
    }
    if (abandon && state.phase !== 'return') {
      this.recall(unit)
      track.retryAt = 0
    }
    if (state.phase !== 'return') return false
    const home = state.homeSpaceId ?? 'outside'
    if (getEntitySpaceId(unit) === home && campDistance(unit) <= CAMP_RETURN_RANGE) {
      state.phase = 'guard'
      this.tracking.delete(unit)
      return true
    }
    if (now < track.retryAt || unit.spacePortalState) return true
    track.retryAt = now + RETURN_RETRY_MS
    if (getEntitySpaceId(unit) !== home) {
      const portal = this.context.map.spaces
        ?.get(getEntitySpaceId(unit))
        ?.portals?.find(entry => entry.targetSpaceId === home)
      if (portal)
        routeUnitThroughSpacePortal(this.context, unit, portal, {
          shouldContinue: () => unit.campBehavior?.phase === 'return',
        })
      return true
    }
    // Reuse a running path, and only retry blocked routes at a bounded cadence.
    if (unit.path?.length && unit.dest && !unit.action) return true
    const grid = this.context.map.spaces?.get(home)?.grid ?? this.context.map.grid
    const cells = getCellsAroundPoint(anchor.i, anchor.j, grid, CAMP_RETURN_RANGE, cell =>
      canUnitUseCellAsIdleDestination(unit, cell)
    )
    cells.sort((a, b) => Math.hypot(a.i - unit.i, a.j - unit.j) - Math.hypot(b.i - unit.i, b.j - unit.j))
    const candidates = cells.slice(0, 4)
    if (candidates.length) {
      const index = (track.returnCandidate ?? 0) % candidates.length
      track.returnCandidate = index + 1
      unit.sendToEvt?.(candidates[index], null, { forceRepath: true, preserveAutonomy: true })
    }
    return true
  }
}
