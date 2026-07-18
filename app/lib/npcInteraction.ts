import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES } from '../constants'
import { findInstancesInSight } from './grid/visibility'
import { getInstanceDegree } from './maths'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'

// A resource/building's clickable art often extends past its own grid cell (a tall mine or tree
// sprite, say) — cell.has only catches an exact-cell click, so a visually-on-target click can
// land on a neighboring empty cell. Widen the search to the closest interactable within this
// pixel radius of the actual click point before falling back to a plain move.
const CLICK_TARGET_SEARCH_RANGE = 15
const CLICK_TARGET_TOLERANCE_PX = 60

// Cell-unit ranges, matching TOOL_ACTION_RANGE's scale (app/lib/heroTools.ts).
const NPC_INTERACT_RANGE = 2.5
// How far the hero can wander from an open orders panel's targets before it auto-closes.
const NPC_MENU_KEEP_RANGE = 10

// Hold-to-charge "communication zone" (left click): starts at the base range and grows
// the longer the button is held, up to the max range.
export const COMM_BASE_RANGE = 2.5
export const COMM_MAX_RANGE = 7
export const COMM_CHARGE_MS = 1200

const FOLLOW_SLACK = 2
// Escort behavior for followers: hostiles inside the engage radius around the hero get
// attacked; a follower whose fight drags it past the leash radius breaks off and comes back.
const ESCORT_ENGAGE_RANGE = 7
const ESCORT_LEASH_RANGE = 12

const RESOURCE_SEND_TO: Partial<Record<string, (npc: UnitEntity, target: RuntimeEntity) => void>> = {
  Tree: (npc, target) => npc.sendToTree?.(target),
  Stone: (npc, target) => npc.sendToStone?.(target),
  Gold: (npc, target) => npc.sendToGold?.(target),
  Berrybush: (npc, target) => npc.sendToBerrybush?.(target),
  Fish: (npc, target) => npc.sendToFish?.(target),
  ShoreFish: (npc, target) => npc.sendToFish?.(target),
  Salmon: (npc, target) => npc.sendToFish?.(target),
}

function cellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

function isRuntimeEntityDest(value: RuntimeEntity | RuntimeCell | null | undefined): value is RuntimeEntity {
  return Boolean(value && !('has' in value && 'corpses' in value))
}

// A unit mid-fight is the only thing that can't be interrupted — everything else (idle, walking,
// gathering, building) is fair game.
function isFighting(target: UnitEntity): boolean {
  return target.action === ACTION_TYPES.attack
}

function isFriendlyAvailable(hero: UnitEntity, target: UnitEntity): boolean {
  if (target === hero || target.isDead || target.isDestroyed) return false
  if (target.family !== FAMILY_TYPES.unit) return false
  if (target.owner !== hero.owner) return false
  return !isFighting(target)
}

function isCommEligible(hero: UnitEntity, target: UnitEntity): boolean {
  if (target.lookingAtHero) return true
  return isFriendlyAvailable(hero, target)
}

function noticeNpc(target: UnitEntity, hero: UnitEntity): void {
  if (target.lookingAtHero) return
  const sprite = target.sprite
  if (sprite) {
    sprite.onLoop = undefined
    sprite.onFrameChange = undefined
    sprite.onComplete = undefined
  }
  target.previousDest = target.dest ?? null
  target.lookingAtHero = true
  target.dest = null
  target.path = []
  target.degree = getInstanceDegree(target, hero.x, hero.y)
  target.setTextures?.(SHEET_TYPES.standing)
}

function releaseNpc(target: UnitEntity): void {
  if (!target.lookingAtHero) return
  target.lookingAtHero = false
  const dest = target.previousDest
  // goBackToPrevious() only knows how to resume a resource/building errand; a unit that was just
  // walking to empty ground (no entity dest) needs a plain move re-issued instead, or it'd just stop.
  if (dest && !isRuntimeEntityDest(dest)) {
    target.previousDest = null
    target.sendTo?.(dest)
    return
  }
  target.goBackToPrevious?.()
}

// Closest available ally within quick-interact range (quick 'e' key) — frozen the moment it's
// picked, not before. No passive "stops whenever you walk by" scanning: freezing only happens
// at the moment of interaction, otherwise an order given right as you approach could get
// immediately re-frozen by a proximity scan and never actually execute.
export function findInteractableNpc(hero: UnitEntity): UnitEntity | null {
  const candidates = findInstancesInSight<UnitEntity, UnitEntity>(
    hero,
    target => isCommEligible(hero, target),
    NPC_INTERACT_RANGE
  )
  let closest: UnitEntity | null = null
  let closestDist = Infinity
  for (const candidate of candidates) {
    const dist = cellDistance(hero, candidate)
    if (dist < closestDist) {
      closest = candidate
      closestDist = dist
    }
  }
  if (closest) noticeNpc(closest, hero)
  return closest
}

// Releases any of these npcs still frozen from an interaction the player didn't follow through
// on (e.g. closed the panel without picking an order) so they resume whatever they were doing.
export function releaseIfStillLooking(npcs: UnitEntity[]): void {
  for (const npc of npcs) releaseNpc(npc)
}

// Whether the hero is still close enough to any of these npcs to keep their orders panel open.
export function isAnyNpcNear(hero: UnitEntity, npcs: UnitEntity[], range = NPC_MENU_KEEP_RANGE): boolean {
  return npcs.some(npc => npc && !npc.isDead && !npc.isDestroyed && cellDistance(hero, npc) <= range)
}

// All villagers eligible for the hold-to-charge "communication zone", within the given radius.
export function findCommGroup(hero: UnitEntity, radius: number): UnitEntity[] {
  const candidates = findInstancesInSight<UnitEntity, UnitEntity>(
    hero,
    target => isCommEligible(hero, target),
    radius
  )
  return candidates.filter(target => cellDistance(hero, target) <= radius)
}

export function getCommRadiusForHold(elapsedMs: number): number {
  const ratio = Math.max(0, Math.min(1, elapsedMs / COMM_CHARGE_MS))
  return COMM_BASE_RANGE + ratio * (COMM_MAX_RANGE - COMM_BASE_RANGE)
}

// Finalizes a hold-to-charge release: pauses+faces any newly-caught worker, returns the full group.
export function resolveCommGroup(hero: UnitEntity, radius: number): UnitEntity[] {
  const group = findCommGroup(hero, radius)
  for (const npc of group) noticeNpc(npc, hero)
  return group
}

function resetNpcDirectives(target: UnitEntity): void {
  target.lookingAtHero = false
  target.followingHero = false
}

export function resumeNpcWork(target: UnitEntity): void {
  target.followingHero = false
  releaseNpc(target)
}

export function sendNpcToStockpile(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.sendToDelivery?.()
}

export function keepNpcHere(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.stop?.()
}

export function startFollowingHero(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.followingHero = true
  target.stop?.()
}

function hasCombatOrder(target: RuntimeEntity): target is (UnitEntity | AnimalEntity) & {
  action?: string | null
  dest?: RuntimeCell | RuntimeEntity | null
} {
  return (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal) && 'action' in target && 'dest' in target
}

// Something mid-swing against one of ours — an enemy soldier on a villager, a wild predator
// on the hero — regardless of its own allegiance.
function isAttackingAlly(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!hasCombatOrder(target)) return false
  return target.action === ACTION_TYPES.attack && isRuntimeEntityDest(target.dest) && target.dest?.owner === hero.owner
}

// A threat worth engaging: anything actively attacking one of ours, or any enemy unit near
// the hero. Idle animals don't qualify — escorts must not hunt every passing gazelle.
function isEscortThreat(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.isDead || target.isDestroyed || (target.hitPoints ?? 0) <= 0) return false
  if (isAttackingAlly(hero, target)) return true
  return target.family === FAMILY_TYPES.unit && Boolean(target.owner && hero.owner?.isEnemy?.(target.owner))
}

function findEscortThreats(hero: UnitEntity): RuntimeEntity[] {
  return findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => isEscortThreat(hero, target),
    ESCORT_ENGAGE_RANGE
  )
}

// Closest threat this follower can actually fight; active attackers outrank enemies that
// are merely close.
function pickEscortTarget(hero: UnitEntity, unit: UnitEntity, threats: RuntimeEntity[]): RuntimeEntity | null {
  let best: RuntimeEntity | null = null
  let bestAttacking = false
  let bestDist = Infinity
  for (const threat of threats) {
    if (!unit.getActionCondition?.(threat, ACTION_TYPES.attack)) continue
    const attacking = isAttackingAlly(hero, threat)
    if (best && bestAttacking && !attacking) continue
    const dist = cellDistance(unit, threat)
    if (best && bestAttacking === attacking && dist >= bestDist) continue
    best = threat
    bestAttacking = attacking
    bestDist = dist
  }
  return best
}

function isEscortFighting(unit: UnitEntity): boolean {
  if (unit.action !== ACTION_TYPES.attack) return false
  return isRuntimeEntityDest(unit.dest) && !unit.dest?.isDead && !unit.dest?.isDestroyed
}

// Escort update for every unit following the hero: engage threats near the hero, break off a
// fight that drags past the leash radius, otherwise trail the hero's cell (move orders
// throttled by distance so it doesn't spam pathfinding every tick).
export function updateNpcFollow(hero: UnitEntity): void {
  const units = hero.owner?.units
  const map = hero.context?.map
  if (!units || !map) return
  const heroCell = map.grid[hero.i]?.[hero.j]
  if (!heroCell) return
  let threats: RuntimeEntity[] | null = null
  for (const unit of units) {
    if (!unit.followingHero || unit === hero || unit.isDead || unit.isDestroyed) continue
    if (unit.lookingAtHero) continue
    if (isEscortFighting(unit)) {
      if (cellDistance(hero, unit) > ESCORT_LEASH_RANGE) unit.sendTo?.(heroCell)
      continue
    }
    threats ??= findEscortThreats(hero)
    const target = pickEscortTarget(hero, unit, threats)
    if (target) {
      unit.sendToAttack?.(target)
      continue
    }
    if (cellDistance(hero, unit) <= FOLLOW_SLACK) continue
    if (unit.dest === heroCell) continue
    unit.sendTo?.(heroCell)
  }
}

function findNearestInteractable(
  hero: UnitEntity,
  worldPoint: Point,
  cell: RuntimeCell | null,
  matches: (target: RuntimeEntity) => boolean
): RuntimeEntity | null {
  if (cell?.has && matches(cell.has)) return cell.has
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, matches, CLICK_TARGET_SEARCH_RANGE)
  let closest: RuntimeEntity | null = null
  let closestDist = CLICK_TARGET_TOLERANCE_PX
  for (const candidate of candidates) {
    const dist = Math.hypot(candidate.x - worldPoint.x, candidate.y - worldPoint.y)
    if (dist < closestDist) {
      closest = candidate
      closestDist = dist
    }
  }
  return closest
}

function isEnemyTarget(hero: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(target.owner && hero.owner?.isEnemy?.(target.owner))
}

function isClickDispatchable(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target.family === FAMILY_TYPES.resource || target.family === FAMILY_TYPES.building) return true
  if (target.family === FAMILY_TYPES.animal) return true
  return target.family === FAMILY_TYPES.unit && isEnemyTarget(hero, target) && !target.isDead
}

function resolveClickTarget(hero: UnitEntity, worldPoint: Point, cell: RuntimeCell): RuntimeEntity | null {
  return findNearestInteractable(hero, worldPoint, cell, target => isClickDispatchable(hero, target))
}

// What the hero's cursor is currently hovering — a resource, an animal, or an enemy — tolerant of
// the same "sprite art is bigger than its grid cell" slop as resolveClickTarget.
export function resolveHoverTarget(hero: UnitEntity, worldPoint: Point, cell: RuntimeCell | null): RuntimeEntity | null {
  return findNearestInteractable(
    hero,
    worldPoint,
    cell,
    target =>
      isClickDispatchable(hero, target) ||
      target.family === FAMILY_TYPES.animal ||
      (target.family === FAMILY_TYPES.unit && target.owner !== hero.owner && !target.isDead)
  )
}

// "Aller vers": dispatches a single npc to a clicked target — gather if it's a resource, help
// build if it's an unfinished building, otherwise a plain move (mirrors normal RTS click-to-command).
function sendNpcToCell(npc: UnitEntity, cell: RuntimeCell, target: RuntimeEntity | null): void {
  resetNpcDirectives(npc)
  if (target) {
    const kind = target.category || target.type
    const resourceSend = kind ? RESOURCE_SEND_TO[kind] : undefined
    if (resourceSend) {
      resourceSend(npc, target)
      return
    }
    if (target.family === FAMILY_TYPES.building && npc.getActionCondition?.(target, ACTION_TYPES.build)) {
      npc.sendToBuilding?.(target as BuildingEntity)
      return
    }
    if (target.family === FAMILY_TYPES.animal) {
      if (npc.getActionCondition?.(target, ACTION_TYPES.hunt)) {
        npc.sendToHunt?.(target)
        return
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.takemeat)) {
        npc.sendToTakeMeat?.(target)
        return
      }
    }
    const attackableFamilies = [FAMILY_TYPES.unit, FAMILY_TYPES.building, FAMILY_TYPES.animal]
    if (attackableFamilies.includes(target.family) && npc.getActionCondition?.(target, ACTION_TYPES.attack)) {
      npc.sendToAttack?.(target)
      return
    }
  }
  npc.sendTo?.(cell)
}

export function sendNpcGroupToTarget(npcs: UnitEntity[], cell: RuntimeCell, worldPoint: Point): void {
  if (!npcs.length) return
  const target = resolveClickTarget(npcs[0], worldPoint, cell)
  if (target) {
    for (const npc of npcs) sendNpcToCell(npc, cell, target)
    return
  }
  const map = npcs[0].context?.map
  let minI = Infinity
  let minJ = Infinity
  let maxI = -Infinity
  let maxJ = -Infinity
  for (const npc of npcs) {
    if (npc.i < minI) minI = npc.i
    if (npc.j < minJ) minJ = npc.j
    if (npc.i > maxI) maxI = npc.i
    if (npc.j > maxJ) maxJ = npc.j
  }
  const centerI = minI + Math.round((maxI - minI) / 2)
  const centerJ = minJ + Math.round((maxJ - minJ) / 2)
  for (const npc of npcs) {
    resetNpcDirectives(npc)
    const finalCell = map?.grid[cell.i + (npc.i - centerI)]?.[cell.j + (npc.j - centerJ)]
    npc.sendTo?.(finalCell || cell)
  }
}
