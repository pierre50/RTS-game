import { UNIT_TYPES } from '../../../constants'
import { getInstancePath } from '../../../lib/grid/movement'
import { canUnitUseCellAsIdleDestination, createReservedPassageCellLookup } from '../../../lib/buildings/passageCells'
import { getEntitySpaceMapLike } from '../../../lib/mapSpaces'
import { isHeroControlled } from '../../../lib/units/unitControl'
import type { UnitEntity } from '../../../types/entities'

const PUSH_DELAY_MS = 180
const YIELD_COOLDOWN_MS = 1200
const CLEAR_DISTANCE = 36

type YieldState = { blocker: UnitEntity; startedAt: number; nextAttemptAt: number; passThrough: boolean }
const yieldStates = new WeakMap<UnitEntity, YieldState>()

function canYield(hero: UnitEntity, unit: UnitEntity): boolean {
  const heroOwner = hero.owner
  const npcOwner = unit.owner
  if (heroOwner && npcOwner && (heroOwner.isEnemy?.(npcOwner) || npcOwner.isEnemy?.(heroOwner))) return false
  return unit.type !== UNIT_TYPES.hero && !isHeroControlled(unit) && !unit.isDead && !unit.isDestroyed &&
    !unit.dest && !unit.action && !unit.path?.length && !unit.followingHero &&
    !unit.lookingAtHero && !unit.offlineWork && !unit.shelterState &&
    !unit.sleepVisualState && !unit.pendingOrder && !unit.combatMode &&
    !unit.isDirectMoving
}

function findSideStep(hero: UnitEntity, npc: UnitEntity) {
  const map = getEntitySpaceMapLike(npc, npc.context?.map)
  if (!map) return null
  const passageLookup = createReservedPassageCellLookup(npc.context)
  const awayX = npc.x - hero.x
  const awayY = npc.y - hero.y
  const candidates = []
  for (let di = -1; di <= 1; di++) {
    for (let dj = -1; dj <= 1; dj++) {
      if (di === 0 && dj === 0) continue
      const cell = map.grid[npc.i + di]?.[npc.j + dj]
      if (!canUnitUseCellAsIdleDestination(npc, cell, { passageLookup })) continue
      const deltaX = cell.x - npc.x
      const deltaY = cell.y - npc.y
      const score = deltaX * awayX + deltaY * awayY - Math.abs(deltaX * awayY - deltaY * awayX) * 0.15
      candidates.push({ cell, score })
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  for (const { cell } of candidates) {
    if (getInstancePath(npc, cell.i, cell.j, map).length) return cell
  }
  return null
}

/** Called only for a unit that is actually blocking the hero's next direct step. */
export function shouldIgnoreYieldingNpc(hero: UnitEntity, npc: UnitEntity): boolean {
  const now = Date.now()
  let state = yieldStates.get(hero)
  if (state && state.blocker !== npc) {
    yieldStates.delete(hero)
    state = undefined
  }
  if (!state) {
    state = { blocker: npc, startedAt: now, nextAttemptAt: 0, passThrough: false }
    yieldStates.set(hero, state)
  }
  if (state.passThrough) return true
  if (!canYield(hero, npc)) {
    yieldStates.delete(hero)
    return false
  }
  if (now - state.startedAt < PUSH_DELAY_MS || now < state.nextAttemptAt) return false

  state.nextAttemptAt = now + YIELD_COOLDOWN_MS
  const sideStep = findSideStep(hero, npc)
  if (sideStep) {
    npc.sendToEvt?.(sideStep, null, { preserveAutonomy: true })
    if (npc.dest === sideStep || npc.path?.length) return false
  }
  state.passThrough = true
  return true
}

export function clearNpcYieldWhenSeparated(hero: UnitEntity): void {
  const state = yieldStates.get(hero)
  if (!state) return
  if (Math.hypot(hero.x - state.blocker.x, hero.y - state.blocker.y) >= CLEAR_DISTANCE || state.blocker.isDestroyed) {
    yieldStates.delete(hero)
  }
}
