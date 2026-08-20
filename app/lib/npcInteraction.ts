import {
  ACTION_TYPES,
  CELL_WIDTH,
  COMM_SELECTION_COLOR,
  FAMILY_TYPES,
  LABEL_TYPES,
  PLAYER_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  UNIT_TYPES,
} from '../constants'
import { findInstancesInSight } from './grid/visibility'
import { applyDiplomaticAggression } from './diplomaticAggression'
import {
  createIsoSelectionMarker,
  drawInstanceBlinkingSelection,
  getSelectionMarkerOffset,
} from './graphics/selection'
import type { SelectableInstance } from './graphics/selection'
import { angleDelta, getInstanceDegree, isometricToCartesian } from './maths'
import { playSelectionSound, playSoundCue } from './sound'
import { getTrainingTargetForUnit } from './buildingTraining'
import { showUnitCannotEnterBuildingMessage } from './buildingFeedback'
import type { AnimalEntity, BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell, RuntimeMap } from '../types/map'
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

// Hold-to-charge "communication zone" (left click): starts at 0 and grows the longer the
// button is held, up to the max range. While still inside the precision zone (base range),
// a release resolves to whichever ally the hero is actually facing rather than an area sweep —
// a quick tap talks precisely to the unit standing face-to-face with the hero.
export const COMM_BASE_RANGE = 0
export const COMM_MAX_RANGE = 7
export const COMM_CHARGE_MS = 2200
export const COMM_INDICATOR_DELAY_MS = 250
const COMM_CHARGE_EXPONENT: number = 2.2
const COMM_PRECISION_RANGE = Math.SQRT2 + 0.01
const COMM_PRECISION_WORLD_RANGE = CELL_WIDTH + 0.01
const COMM_FACING_HALF_ANGLE = 60

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
  Wheat: (npc, target) => npc.sendToFarm?.(target),
}

function cellDistance(a: Pick<RuntimeEntity, 'i' | 'j'>, b: Pick<RuntimeEntity, 'i' | 'j'>): number {
  return Math.hypot((a.i ?? 0) - (b.i ?? 0), (a.j ?? 0) - (b.j ?? 0))
}

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
    color: COMM_SELECTION_COLOR,
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
export function findCommGroup(hero: UnitEntity, radius: number): UnitEntity[] {
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
  const centerI = hero.i ?? 0
  const centerJ = hero.j ?? 0
  const scanRadius = Math.ceil(Math.max(0, radius))
  const radiusSq = radius * radius
  const cells: RuntimeCell[] = []

  for (let i = centerI - scanRadius; i <= centerI + scanRadius; i++) {
    const row = grid[i]
    if (!row) continue
    for (let j = centerJ - scanRadius; j <= centerJ + scanRadius; j++) {
      const cell = row[j]
      if (!cell) continue
      const di = i - centerI
      const dj = j - centerJ
      if (di * di + dj * dj <= radiusSq) cells.push(cell)
    }
  }

  return cells
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

function resetNpcDirectives(target: UnitEntity): void {
  target.lookingAtHero = false
  target.followingHero = false
  setCommSelected(target, false)
}

export function clearNpcCommunicationFocus(target: UnitEntity): void {
  resetNpcDirectives(target)
}

export function canKeepNpcHere(target: UnitEntity): boolean {
  return Boolean(
    target.followingHero ||
      target.autonomousJob ||
      target.pendingOrder ||
      target.previousDest ||
      target.dest ||
      target.realDest ||
      (target.path?.length ?? 0) > 0 ||
      target.hasPath?.() ||
      (target.action && target.action !== ACTION_TYPES.attack) ||
      !target.inactif
  )
}

export function sendNpcToStockpile(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.sendToDelivery?.()
}

export function keepNpcHere(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.stop?.()
}

export function startFollowingHero(target: UnitEntity): void {
  resetNpcDirectives(target)
  target.previousDest = null
  target.autonomousJob = null
  target.followingHero = true
  target.stop?.()
}

function hasCombatOrder(target: RuntimeEntity): target is (UnitEntity | AnimalEntity) & {
  action?: string | null
  dest?: RuntimeCell | RuntimeEntity | null
} {
  return (
    (target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal) &&
    'action' in target &&
    'dest' in target
  )
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

// Pixel distance between adjacent formation rows/columns — roughly one grid cell apart.
const FORMATION_SLOT_SPACING = 40

// Rows fill left-to-right, each one step further back than the last, in a block sized to the
// group so it stays roughly as wide as it is deep instead of a long thin line (2 followers →
// one row of 2; 10 → a 4-wide block, 4/4/2) — width recomputed from the live count each call,
// not a fixed constant. Each row centers on its OWN count rather than the block's full width,
// so a partial trailing row stays balanced instead of hugging one side.
function getFormationSlotOffset(slotIndex: number, totalCount: number): { back: number; side: number } {
  const width = Math.max(1, Math.ceil(Math.sqrt(totalCount)))
  const row = Math.floor(slotIndex / width)
  const col = slotIndex % width
  const rowCount = Math.min(width, totalCount - row * width)
  return { back: row + 1, side: col - (rowCount - 1) / 2 }
}

function getFormationSlotCell(
  hero: UnitEntity,
  slotIndex: number,
  totalCount: number,
  map: RuntimeMap
): RuntimeCell | null {
  const { back, side } = getFormationSlotOffset(slotIndex, totalCount)
  // hero.degree follows getPointsDegree's `atan2(...) + 180` convention, so the forward unit
  // vector is that angle rotated back by 180°.
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  const forwardX = Math.cos(rad)
  const forwardY = Math.sin(rad)
  const rightX = -forwardY
  const rightY = forwardX
  const targetX = hero.x - forwardX * back * FORMATION_SLOT_SPACING + rightX * side * FORMATION_SLOT_SPACING
  const targetY = hero.y - forwardY * back * FORMATION_SLOT_SPACING + rightY * side * FORMATION_SLOT_SPACING
  const [ti, tj] = isometricToCartesian(targetX, targetY)
  return map.grid[ti]?.[tj] ?? null
}

// Escort update for every unit following the hero: engage threats near the hero, break off a
// fight that drags past the leash radius, otherwise hold a wedge formation behind the hero
// (move orders throttled by distance so it doesn't spam pathfinding every tick).
export function updateNpcFollow(hero: UnitEntity): void {
  const units = hero.owner?.units
  const map = hero.context?.map
  if (!units || !map) return
  const heroCell = map.grid[hero.i]?.[hero.j]
  if (!heroCell) return
  let threats: RuntimeEntity[] | null = null
  const formationUnits: UnitEntity[] = []
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
    formationUnits.push(unit)
  }
  if (!formationUnits.length) return

  // Sorted by label rather than left in owner.units order: a stable key keeps each follower on
  // the same slot frame to frame, so only the following SET changing (join/leave/peel off to
  // fight) reshuffles slots — not incidental reordering of the owner's unit list.
  formationUnits.sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))

  formationUnits.forEach((unit, index) => {
    const slotCell = getFormationSlotCell(hero, index, formationUnits.length, map) ?? heroCell
    if (cellDistance(unit, slotCell) <= FOLLOW_SLACK) return
    if (unit.dest === slotCell) return
    unit.sendTo?.(slotCell)
  })
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
export function resolveHoverTarget(
  hero: UnitEntity,
  worldPoint: Point,
  cell: RuntimeCell | null
): RuntimeEntity | null {
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

// "Aller vers": primary player command path for communicated NPCs. Dispatches a single NPC
// to gather resources, help build, train/enter compatible buildings, attack valid targets,
// or move to empty ground.
function sendNpcToCell(npc: UnitEntity, cell: RuntimeCell, target: RuntimeEntity | null): boolean {
  resetNpcDirectives(npc)
  if (target) {
    const kind = target.category || target.type
    const resourceSend = kind ? RESOURCE_SEND_TO[kind] : undefined
    if (resourceSend) {
      resourceSend(npc, target)
      return true
    }
    if (target.family === FAMILY_TYPES.building && npc.getActionCondition?.(target, ACTION_TYPES.build)) {
      npc.sendToBuilding?.(target as BuildingEntity)
      return true
    }
    if (target.family === FAMILY_TYPES.building) {
      const building = target as BuildingEntity
      if (building.owner === npc.owner && building.isBuilt) {
        const trainingType = getTrainingTargetForUnit(building, npc)
        if (trainingType) {
          return Boolean(building.requestUnitTraining?.(trainingType, undefined, npc))
        }
        if (npc.type !== UNIT_TYPES.villager) {
          npc.sendTo?.(cell)
          return false
        }
        showUnitCannotEnterBuildingMessage(npc, building)
        return false
      }
    }
    if (target.family === FAMILY_TYPES.animal) {
      if (target.type === 'Horse' && npc.type === UNIT_TYPES.villager) {
        const captureAttemptResult = npc.sendToCaptureHorse?.(target)
        const captureAttemptStarted = captureAttemptResult !== false
        if (captureAttemptStarted) return true
        return false
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.hunt)) {
        npc.sendToHunt?.(target)
        return true
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.takemeat)) {
        npc.sendToTakeMeat?.(target)
        return true
      }
    }
    if (npc.type === UNIT_TYPES.priest) {
      if (npc.getActionCondition?.(target, ACTION_TYPES.heal)) {
        npc.sendTo?.(target, ACTION_TYPES.heal)
        return true
      }
      if (npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return true
      }
      if (applyDiplomaticAggression(npc, target).changed && npc.getActionCondition?.(target, ACTION_TYPES.convert)) {
        npc.sendToConvert?.(target)
        return true
      }
    }
    const attackableFamilies = [FAMILY_TYPES.unit, FAMILY_TYPES.building, FAMILY_TYPES.animal]
    if (attackableFamilies.includes(target.family) && npc.getActionCondition?.(target, ACTION_TYPES.attack)) {
      npc.sendToAttack?.(target)
      return true
    }
  }
  npc.sendTo?.(cell)
  return false
}

export function sendNpcGroupToTarget(npcs: UnitEntity[], cell: RuntimeCell, worldPoint: Point): void {
  if (!npcs.length) return
  playNpcOrderSound(npcs)
  const target = resolveClickTarget(npcs[0], worldPoint, cell)
  if (target) {
    let hasTargetAction = false
    for (const npc of npcs) {
      if (sendNpcToCell(npc, cell, target)) hasTargetAction = true
    }
    if (hasTargetAction) drawInstanceBlinkingSelection(target as SelectableInstance)
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
