import {
  ACTION_TYPES,
  CELL_WIDTH,
  COLOR_WHITE,
  FAMILY_TYPES,
  LABEL_TYPES,
  PLAYER_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../constants'
import { findInstancesInSight } from './grid/visibility'
import {
  createIsoSelectionMarker,
  getSelectionMarkerOffset,
} from './graphics/selection'
import { getCellsInCellRadius } from './grid/cells'
import { angleDelta, getInstanceDegree } from './maths'
import { playSelectionSound, playSoundCue } from './sound'
import { sendNpcGroupToTarget as sendNpcGroupToTargetDispatch } from './npcGoToDispatch'
export { updateNpcFollow } from './npcFollow'
export {
  canKeepNpcHere,
  clearNpcCommunicationFocus,
  keepNpcHere,
  resolveHoverTarget,
  sendNpcToStockpile,
  startFollowingHero,
} from './npcGoToDispatch'
import type { RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'

// Hold-to-charge "communication zone" (left click): starts at 0 and grows the longer the
// button is held, up to the max range. While still inside the precision zone (base range),
// a release resolves to whichever ally the hero is actually facing rather than an area sweep —
// a quick tap talks precisely to the unit standing face-to-face with the hero.
const COMM_BASE_RANGE = 0
const COMM_MAX_RANGE = 7
const COMM_CHARGE_MS = 2200
export const COMM_INDICATOR_DELAY_MS = 250
const COMM_CHARGE_EXPONENT: number = 2.2
const COMM_PRECISION_RANGE = Math.SQRT2 + 0.01
const COMM_PRECISION_WORLD_RANGE = CELL_WIDTH + 0.01
const COMM_FACING_HALF_ANGLE = 60

function worldDistance(a: Partial<Point>, b: Partial<Point>): number {
  return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0))
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

function isForeignTalkableNpc(hero: UnitEntity, target: UnitEntity): boolean {
  const heroOwner = hero.owner
  const targetOwner = target.owner
  if (!heroOwner || !targetOwner || targetOwner === heroOwner) return false
  if (targetOwner.type !== PLAYER_TYPES.ai) return false
  if (heroOwner.isEnemy?.(targetOwner)) return false
  if (targetOwner.isEnemy?.(heroOwner)) return false
  return true
}

// Any living unit on the hero's own side, regardless of what it's currently doing (fighting,
// working...) or a non-hostile foreign AI unit. The bar for a flavor chatter line is much
// lower than for a giveable order.
export function isTalkableNpc(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.family !== FAMILY_TYPES.unit) return false
  const unit = target as UnitEntity
  if (unit.isDead || unit.isDestroyed) return false
  return unit.owner === hero.owner || isForeignTalkableNpc(hero, unit)
}

// Marks a frozen comm target with the same selection lozenge as a regular unit selection, kept
// on its own label so it never collides with (or gets cleared by) the player's actual drag-select
// state — a comm target that also happens to be selected must stay selected once released.
function setCommSelected(target: UnitEntity, selected: boolean): void {
  if (!selected) {
    const marker = target.getChildByLabel?.(LABEL_TYPES.commSelection)
    if (marker) target.removeChild(marker)
    return
  }
  if (target.getChildByLabel?.(LABEL_TYPES.commSelection)) return
  const factor = target.selectionFactor ?? target.size ?? 1
  const markerOffset = getSelectionMarkerOffset(target)
  const marker = createIsoSelectionMarker({
    color: COLOR_WHITE,
    factor,
    label: LABEL_TYPES.commSelection,
    zIndex: -1,
  })
  marker.position.x = markerOffset.x
  marker.position.y = markerOffset.y + (target.reliefLift ?? 0)
  const shadowIndex = target.getChildByLabel?.(LABEL_TYPES.shadow) ? 1 : 0
  target.addChildAt(marker, shadowIndex)
}

function noticeNpc(target: UnitEntity, hero: UnitEntity, shouldPlayVoice = true): void {
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
  setCommSelected(target, true)
  if (shouldPlayVoice) playSelectionSound(target)
}

// A cue shared by the whole group plays once,
// otherwise fall back to the villager/military default — never one bark per unit in the group.
export function playNpcOrderSound(npcs: UnitEntity[]): void {
  if (!npcs.length) return
  const commandSound = npcs[0].sounds?.command
  const sameCommandSound =
    commandSound != null && npcs.every(npc => JSON.stringify(npc.sounds?.command) === JSON.stringify(commandSound))
  if (sameCommandSound) {
    playSoundCue(commandSound)
    return
  }
  if (npcs.some(npc => npc.type !== UNIT_TYPES.villager)) {
    playSoundCue(SOUND_CUES.unit.militaryCommand)
    return
  }
  playSoundCue(npcs.find(npc => npc.type === UNIT_TYPES.villager)?.sounds?.command ?? SOUND_CUES.villager.command)
}

function releaseNpc(target: UnitEntity): void {
  if (!target.lookingAtHero) return
  target.lookingAtHero = false
  setCommSelected(target, false)
  const dest = target.previousDest
  if (target.autonomousJob) {
    target.previousDest = null
    target.action = null
    target.affectNewDest?.()
    return
  }
  if (target.trainingTargetType && dest && isRuntimeEntityDest(dest)) {
    target.previousDest = null
    target.sendTo?.(dest, ACTION_TYPES.train)
    return
  }
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
// Releases any of these npcs still frozen from an interaction the player didn't follow through
// on (e.g. closed the panel without picking an order) so they resume whatever they were doing.
export function releaseIfStillLooking(npcs: UnitEntity[]): void {
  for (const npc of npcs) releaseNpc(npc)
}

// Whether the hero is still close enough to any of these npcs to keep their orders panel open.
// All villagers eligible for the hold-to-charge "communication zone", within the given radius.
function findCommGroup(hero: UnitEntity, radius: number): UnitEntity[] {
  const candidates = findInstancesInSight<UnitEntity, UnitEntity>(hero, target => isCommEligible(hero, target), radius)
  const radiusSq = radius * radius
  return candidates.filter(target => {
    const di = (target.i ?? 0) - (hero.i ?? 0)
    const dj = (target.j ?? 0) - (hero.j ?? 0)
    return di * di + dj * dj <= radiusSq
  })
}

export function getCommCellsInRadius(hero: UnitEntity, radius: number): RuntimeCell[] {
  const grid = hero.context?.map?.grid
  if (!grid) return []
  return getCellsInCellRadius(hero.i ?? 0, hero.j ?? 0, grid, radius)
}

export function getCommRadiusForHold(elapsedMs: number): number {
  const ratio = Math.max(0, Math.min(1, elapsedMs / COMM_CHARGE_MS))
  const easedRatio =
    COMM_CHARGE_EXPONENT === 0
      ? ratio
      : (Math.exp(COMM_CHARGE_EXPONENT * ratio) - 1) / (Math.exp(COMM_CHARGE_EXPONENT) - 1)
  return COMM_BASE_RANGE + easedRatio * (COMM_MAX_RANGE - COMM_BASE_RANGE)
}

// The ally the hero is most directly facing, within a fixed nearby range — independent of how
// little the hold has charged so far, so a same-tick tap still finds whoever is standing in front.
function findFacingNpc(hero: UnitEntity, range: number): UnitEntity | null {
  const candidates = findCommGroup(hero, range)
  let best: UnitEntity | null = null
  let bestAngle = COMM_FACING_HALF_ANGLE
  for (const candidate of candidates) {
    if (worldDistance(hero, candidate) > COMM_PRECISION_WORLD_RANGE) continue
    const angle = angleDelta(getInstanceDegree(hero, candidate.x, candidate.y), hero.degree ?? 0)
    if (angle > bestAngle) continue
    best = candidate
    bestAngle = angle
  }
  return best
}

// Finalizes a hold-to-charge release: pauses+faces any newly-caught worker(s), returns the group.
// Before the visible radius appears, or still inside the precision zone, resolve to the single
// ally facing the hero face-to-face rather than an area sweep. Past that, the charged radius nets
// everyone in range.
export function resolveCommGroup(
  hero: UnitEntity,
  radius: number,
  options: { precisionOnly?: boolean } = {}
): UnitEntity[] {
  if (options.precisionOnly || radius <= COMM_PRECISION_RANGE) {
    const npc = findFacingNpc(hero, COMM_PRECISION_RANGE)
    if (npc) {
      noticeNpc(npc, hero)
      return [npc]
    }
    if (options.precisionOnly) return []
  }
  const group = findCommGroup(hero, radius)
  let playedVoice = false
  for (const npc of group) {
    noticeNpc(npc, hero, !playedVoice)
    if (!playedVoice) playedVoice = true
  }
  return group
}

export function sendNpcGroupToTarget(npcs: UnitEntity[], cell: RuntimeCell, worldPoint: Point): void {
  sendNpcGroupToTargetDispatch(npcs, cell, worldPoint, playNpcOrderSound)
}
