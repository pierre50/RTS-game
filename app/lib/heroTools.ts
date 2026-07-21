import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_TYPES,
  LOADING_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  WORK_FOOD_TYPES,
  WORK_TYPES,
} from '../constants'
import { isArpgHeroActionInRange } from './arpg'
import { getActionCondition, getHitPointsWithDamage } from './combat'
import { getWorkWithLoadingType } from './extra'
import { findInstancesInSight } from './grid/visibility'
import { getClosestInstanceWithPath } from './grid/queries'
import { onSpriteLoopAtFrame, SHOOT_RELEASE_FRAME, SLASH_IMPACT_FRAME } from './graphics'
import { t } from './lang'
import { degreeToDirection, getInstanceDegree, getReliefOffset } from './maths'
import { playAudibleSoundCue } from './sound'
import { showDamageFeedback } from './combatFeedback'
import { getCombatXpBonus, grantUnitXp, XP_CATEGORIES, XP_KILL_BONUS } from './unitExperience'
import { Projectile } from '../classes/Projectile'
import { applyWorkForAction } from '../classes/unit/UnitCommands'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'

export type HeroTool = 'axe' | 'pickaxe' | 'bow' | 'hammer' | 'fishingRod' | 'unarmed'

export const HERO_TOOL_ORDER: HeroTool[] = ['unarmed', 'axe', 'pickaxe', 'hammer', 'bow', 'fishingRod']

const TOOL_ACTION_RANGE = 3
const HUNTER_ARROW_RANGE = 4
const HERO_BOW_CHARGE_MS = 700
const HERO_BOW_MIN_POWER = 0.2
const HERO_BOW_HOLD_FRAME = Math.max(0, SHOOT_RELEASE_FRAME - 1)
const BLIND_SHOT_DISTANCE = 200
const CLICK_TARGET_SEARCH_RANGE = 15
const CLICK_DIRECTION_HALF_ANGLE = 25
// Melee swing hit-zone: a cone in front of the hero rather than a pinpoint check, so a
// mouse aimed roughly at an enemy still connects. Capped range keeps a far-off cursor from
// extending reach indefinitely.
const MELEE_ATTACK_RANGE = 70
const MELEE_CONE_HALF_ANGLE = 22.5
const HERO_ARROW_FORWARD_OFFSET = 16
const HERO_ARROW_HEIGHT_OFFSET = 18
const HERO_ARROW_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
const HERO_ARROW_MAX_DISTANCE = HUNTER_ARROW_RANGE * HERO_ARROW_CELL_DISTANCE

// Tools with no gather/hunt/build effect of their own — clicking/pressing e with nothing
// valid nearby just plays the swing animation and does nothing else.
const WHIFF_TOOLS = new Set<HeroTool>(['axe', 'pickaxe', 'hammer', 'fishingRod', 'unarmed'])

const TOOL_WORK: Record<HeroTool, string> = {
  axe: WORK_TYPES.woodcutter,
  pickaxe: WORK_TYPES.stoneminer,
  bow: WORK_TYPES.hunter,
  hammer: WORK_TYPES.builder,
  fishingRod: WORK_TYPES.fisher,
  unarmed: WORK_TYPES.attacker,
}

type ToolActionResult = 'triggered' | 'blocked' | 'miss'

function resourceKind(target: RuntimeEntity): string | undefined {
  return target.category || target.type
}

export function buildingAcceptsCarriedResource(hero: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  if (target.family !== FAMILY_TYPES.building) return false
  const building = target as BuildingEntity
  if (hero.category === 'Boat') return building.type === BUILDING_TYPES.dock
  return building.type === BUILDING_TYPES.townCenter || Boolean(building.accept?.includes(hero.loadingType ?? ''))
}

type HeroToolConfig = {
  matches: (target: RuntimeEntity) => boolean
  resolve: (hero: UnitEntity, target: RuntimeEntity) => (() => void) | null
}

// The hero is fully player-controlled and must never path or move on its own — every entry
// point below (aimed click, plain "e" press, the building deposit button) only ever calls
// this once the caller has already confirmed the hero is in range (isToolTargetReachable /
// canDeliverToBuilding). This fires the action's effect directly instead of going through
// hero.sendTo*/commonSendTo, which is built for AI-pathed units and can silently walk them.
function runHeroAction(hero: UnitEntity, target: RuntimeEntity, action: string): void {
  if (hero.actionLocked) return
  hero.setDest?.(target)
  hero.action = action
  hero.degree = getInstanceDegree(hero, target.x, target.y)
  hero.getAction?.(action)
}

// Same as runHeroAction, but also runs the work/texture/cargo bookkeeping commonSendTo would
// have applied for a gather-type action (correct animation sheet, dropping mismatched cargo
// when switching gather types) — reused from the shared unit command logic, not duplicated.
function runHeroGatherAction(hero: UnitEntity, target: RuntimeEntity, action: string, work: string): void {
  if (hero.actionLocked) return
  applyWorkForAction(hero, work, action)
  runHeroAction(hero, target, action)
}

function getLoadingTypeForAction(action: string): string | null {
  switch (action) {
    case ACTION_TYPES.chopwood:
      return LOADING_TYPES.wood
    case ACTION_TYPES.forageberry:
      return LOADING_TYPES.berry
    case ACTION_TYPES.minegold:
      return LOADING_TYPES.gold
    case ACTION_TYPES.minestone:
      return LOADING_TYPES.stone
    case ACTION_TYPES.takemeat:
      return LOADING_TYPES.meat
    case ACTION_TYPES.fishing:
      return LOADING_TYPES.fish
    default:
      return null
  }
}

function heroHasGatherSpace(hero: UnitEntity, action: string, work: string): boolean {
  const loadingType = getLoadingTypeForAction(action)
  if (!loadingType) return true
  const maxLoad = hero.loadingMax?.[loadingType] ?? Infinity
  const currentWork = getWorkWithLoadingType(hero.loadingType ?? '')
  const keepsCurrentLoad =
    work === currentWork || (WORK_FOOD_TYPES.includes(work) && WORK_FOOD_TYPES.includes(currentWork))
  const effectiveLoad = keepsCurrentLoad ? (hero.loading ?? 0) : 0
  return effectiveLoad < maxLoad
}

function resolveHeroGatherAction(
  hero: UnitEntity,
  target: RuntimeEntity,
  action: string,
  work: string
): (() => void) | null {
  if (!getActionCondition(hero, target, action)) return null
  if (!heroHasGatherSpace(hero, action, work)) {
    hero.context?.menu?.showMessage(t('heroInventoryFull'), 'warning')
    return null
  }
  return () => runHeroGatherAction(hero, target, action, work)
}

const HERO_TOOL_ACTIONS: Partial<Record<HeroTool, HeroToolConfig>> = {
  unarmed: {
    matches: target =>
      resourceKind(target) === 'Berrybush' || (target.family === FAMILY_TYPES.animal && Boolean(target.isDead)),
    resolve: (hero, target) => {
      if (resourceKind(target) === 'Berrybush') {
        return getActionCondition(hero, target, ACTION_TYPES.forageberry)
          ? resolveHeroGatherAction(hero, target, ACTION_TYPES.forageberry, WORK_TYPES.forager)
          : null
      }
      // Bare hands can only collect meat off an already-dead carcass, not hunt — killing the
      // animal requires the bow. The bow itself never auto-collects meat (see below), so
      // switching to unarmed is the only way to pick up a carcass.
      return resolveHeroGatherAction(hero, target, ACTION_TYPES.takemeat, WORK_TYPES.hunter)
    },
  },
  axe: {
    matches: target => resourceKind(target) === 'Tree',
    resolve: (hero, target) => resolveHeroGatherAction(hero, target, ACTION_TYPES.chopwood, WORK_TYPES.woodcutter),
  },
  pickaxe: {
    matches: target => resourceKind(target) === 'Stone' || resourceKind(target) === 'Gold',
    resolve: (hero, target) => {
      const isStone = resourceKind(target) === 'Stone'
      const action = isStone ? ACTION_TYPES.minestone : ACTION_TYPES.minegold
      const work = isStone ? WORK_TYPES.stoneminer : WORK_TYPES.goldminer
      return resolveHeroGatherAction(hero, target, action, work)
    },
  },
  bow: {
    // Bow never auto-collects meat, only hunts live game — otherwise hunting near a fresh
    // carcass would keep switching the hero to takemeat instead of shooting the next animal.
    // Switch to the unarmed tool to pick up carcasses.
    matches: target => target.family === FAMILY_TYPES.animal && !target.isDead,
    resolve: (hero, target) =>
      getActionCondition(hero, target, ACTION_TYPES.hunt)
        ? () => runHeroGatherAction(hero, target, ACTION_TYPES.hunt, WORK_TYPES.hunter)
        : null,
  },
  hammer: {
    matches: target => {
      if (target.family !== FAMILY_TYPES.building) return false
      const building = target as BuildingEntity
      return !building.isBuilt || (building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)
    },
    resolve: (hero, target) =>
      getActionCondition(hero, target, ACTION_TYPES.build)
        ? () => runHeroGatherAction(hero, target, ACTION_TYPES.build, WORK_TYPES.builder)
        : null,
  },
  fishingRod: {
    matches: target => target.category === 'Fish',
    resolve: (hero, target) => {
      const action = resolveHeroGatherAction(hero, target, ACTION_TYPES.fishing, WORK_TYPES.fisher)
      if (!action) return null
      return () => {
        playAudibleSoundCue(
          hero,
          (target as { sounds?: { command?: string | number | (string | number)[] | null } }).sounds?.command
        )
        action()
      }
    },
  },
}

export function applyToolAppearance(hero: UnitEntity, tool: HeroTool): void {
  const work = TOOL_WORK[tool]
  if (hero.work === work) return
  hero.work = work
  const workAssets = hero.allAssets?.[work]
  if (workAssets) {
    if (workAssets[SHEET_TYPES.action]) hero.actionSheet = Assets.cache.get(workAssets[SHEET_TYPES.action])
    if (!hero.loading) {
      if (workAssets[SHEET_TYPES.standing]) hero.standingSheet = Assets.cache.get(workAssets[SHEET_TYPES.standing])
      if (workAssets[SHEET_TYPES.walking]) hero.walkingSheet = Assets.cache.get(workAssets[SHEET_TYPES.walking])
    }
  }
  hero.setTextures?.(hero.sprite?.playing ? SHEET_TYPES.walking : SHEET_TYPES.standing)
}

function playHeroToolAnimation(hero: UnitEntity, onImpact?: () => void, impactFrame: number | null = null): void {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return

  hero.actionLocked = true
  sprite.loop = false
  hero.setTextures?.(SHEET_TYPES.action)
  hero.syncShadow?.()

  sprite.onComplete = () => finishHeroToolAnimation(hero)

  if (!onImpact) return
  if (impactFrame == null) {
    onImpact()
    return
  }
  onSpriteLoopAtFrame(sprite, impactFrame, onImpact)
}

function finishHeroToolAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  hero.actionLocked = false
  const hadPendingOrder = hero.flushPendingOrder?.()
  if (!hadPendingOrder && !hero.isDead) hero.setTextures?.(SHEET_TYPES.standing)
  hero.syncShadow?.()
}

export function canDeliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!((hero.loading ?? 0) > 0)) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  if (!getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })) return false
  if (!hero.isUnitAtDest?.(ACTION_TYPES.delivery, target)) return false
  return true
}

export function deliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!canDeliverToBuilding(hero, target)) return false
  runHeroAction(hero, target, ACTION_TYPES.delivery)
  return true
}

function angleDelta(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function getAimDelta(hero: UnitEntity, target: RuntimeEntity): number {
  return angleDelta(getInstanceDegree(hero, target.x, target.y), hero.degree ?? 0)
}

function getDirectionalTarget<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T | null {
  return (
    candidates
      .map(target => ({
        target,
        angle: getAimDelta(hero, target),
        dist: Math.hypot(target.x - hero.x, target.y - hero.y),
      }))
      .filter(candidate => candidate.angle <= halfAngle)
      .sort((a, b) => a.angle - b.angle || a.dist - b.dist)[0]?.target ?? null
  )
}

function tryDeliver(hero: UnitEntity): boolean {
  if (!((hero.loading ?? 0) > 0)) return false
  const nearBuilding = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => buildingAcceptsCarriedResource(hero, target),
    TOOL_ACTION_RANGE
  )
  const closest = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(hero, nearBuilding)
  if (!closest || !hero.isUnitAtDest?.(ACTION_TYPES.delivery, closest.instance)) return false
  runHeroAction(hero, closest.instance, ACTION_TYPES.delivery)
  return true
}

function tryDeliverAt(hero: UnitEntity): boolean {
  if (!((hero.loading ?? 0) > 0)) return false
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canDeliverToBuilding(hero, target),
    CLICK_TARGET_SEARCH_RANGE
  )

  const target = getDirectionalTarget(hero, candidates)
  return target ? deliverToBuilding(hero, target) : false
}

function canBeArrowTarget(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (target === hero || target.isDead || target.isDestroyed || (target.hitPoints ?? 0) <= 0) return false
  return target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal
}

function findArrowTargetInAim(hero: UnitEntity): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canBeArrowTarget(hero, target),
    CLICK_TARGET_SEARCH_RANGE
  )
  return getDirectionalTarget(hero, candidates)
}

function getToolActionForTarget(tool: HeroTool, target: RuntimeEntity): string | null {
  if (tool === 'unarmed' && resourceKind(target) === 'Berrybush') return ACTION_TYPES.forageberry
  if (tool === 'unarmed' && target.family === FAMILY_TYPES.animal && target.isDead) return ACTION_TYPES.takemeat
  if (tool === 'axe' && resourceKind(target) === 'Tree') return ACTION_TYPES.chopwood
  if (tool === 'pickaxe' && resourceKind(target) === 'Stone') return ACTION_TYPES.minestone
  if (tool === 'pickaxe' && resourceKind(target) === 'Gold') return ACTION_TYPES.minegold
  if (tool === 'bow' && target.family === FAMILY_TYPES.animal && !target.isDead) return ACTION_TYPES.hunt
  if (tool === 'hammer' && target.family === FAMILY_TYPES.building) return ACTION_TYPES.build
  if (tool === 'fishingRod' && target.category === 'Fish') return ACTION_TYPES.fishing
  return null
}

// The hero is fully player-controlled and must never auto-path to a target — every tool
// interaction (aimed click or plain "e" press) may only fire once the hero is already in
// place. ARPG contact tools get a small forgiveness band because the player positions the
// hero by hand while resource sprites often extend beyond their grid cell.
function isToolTargetReachable(hero: UnitEntity, tool: HeroTool, target: RuntimeEntity): boolean {
  const action = getToolActionForTarget(tool, target)
  if (!action) return false
  if (isArpgHeroActionInRange(hero, action, target)) return true
  return Boolean(hero.isUnitAtDest?.(action, target))
}

function triggerToolActionAt(hero: UnitEntity, tool: HeroTool): ToolActionResult {
  const config = HERO_TOOL_ACTIONS[tool]
  if (!config) return 'miss'

  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => config.matches(target),
    CLICK_TARGET_SEARCH_RANGE
  )

  const target = getDirectionalTarget(hero, candidates)
  if (target) {
    const action = config.resolve(hero, target)
    if (action && isToolTargetReachable(hero, tool, target)) {
      action()
      return 'triggered'
    }
    return 'blocked'
  }

  return 'miss'
}

function fireBlindArrow(hero: UnitEntity): void {
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  fireArrowAt(hero, {
    x: hero.x + Math.cos(rad) * BLIND_SHOT_DISTANCE,
    y: hero.y + Math.sin(rad) * BLIND_SHOT_DISTANCE,
  })
}

function getHeroArrowSpawnPoint(hero: UnitEntity): Point {
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  return {
    x: hero.x + Math.cos(rad) * HERO_ARROW_FORWARD_OFFSET,
    y: hero.y + getReliefOffset(hero) - HERO_ARROW_HEIGHT_OFFSET,
  }
}

function fireArrowAt(hero: UnitEntity, destination: Point, target?: RuntimeEntity | null, power = 1): void {
  const map = hero.context?.map
  if (!map) return
  const rangePower = Math.max(HERO_BOW_MIN_POWER, Math.min(1, power))
  playHeroToolAnimation(
    hero,
    () => {
      const projectile = new Projectile(
        {
          owner: hero,
          type: 'Arrow',
          target: target ?? undefined,
          destination,
          spawnPoint: getHeroArrowSpawnPoint(hero),
          damage: 4,
          maxDistance: HERO_ARROW_MAX_DISTANCE * rangePower,
        },
        hero.context!
      )
      map.addChild(projectile)
    },
    SHOOT_RELEASE_FRAME
  )
}

function getHeroBowChargeRatio(hero: UnitEntity, now = performance.now()): number {
  if (hero.heroBowChargeStart == null) return 0
  return Math.max(0, Math.min(1, (now - hero.heroBowChargeStart) / HERO_BOW_CHARGE_MS))
}

function freezeHeroBowChargeFrame(hero: UnitEntity, frame?: number): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) return
  const lastFrame = Math.max(0, sprite.textures.length - 1)
  hero.heroBowChargeVisualLocked = true
  sprite.loop = false
  sprite.gotoAndStop(Math.max(0, Math.min(frame ?? HERO_BOW_HOLD_FRAME, lastFrame)))
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

function continueHeroBowChargeAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action || hero.heroBowReleaseQueued) return
  if (hero.heroBowChargeVisualLocked) {
    freezeHeroBowChargeFrame(hero)
    return
  }
  sprite.loop = false
  sprite.onComplete = undefined
  onSpriteLoopAtFrame(sprite, HERO_BOW_HOLD_FRAME, () => freezeHeroBowChargeFrame(hero))
  if (!sprite.playing && sprite.currentFrame < HERO_BOW_HOLD_FRAME) sprite.play()
  if (sprite.currentFrame >= HERO_BOW_HOLD_FRAME) freezeHeroBowChargeFrame(hero)
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function aimHeroBowChargeAt(hero: UnitEntity, destination: Point): boolean {
  if (hero.heroBowChargeStart == null || hero.heroBowReleaseQueued) return false
  const previousDirection = degreeToDirection(hero.degree ?? 0)
  hero.degree = getInstanceDegree(hero, destination.x, destination.y)
  const target = findArrowTargetInAim(hero)
  hero.heroBowChargeDestination = target ? { x: target.x, y: target.y } : destination
  hero.heroBowChargeTarget = target
  if (hero.currentSheet === SHEET_TYPES.action && degreeToDirection(hero.degree ?? 0) !== previousDirection) {
    hero.setTextures?.(SHEET_TYPES.action)
    if (hero.heroBowChargeVisualLocked) freezeHeroBowChargeFrame(hero)
    updateHeroBowCharge(hero)
  }
  return true
}

export function updateHeroBowCharge(hero: UnitEntity, now = performance.now()): void {
  if (hero.heroBowChargeStart == null) return
  if (hero.heroBowReleaseQueued) return
  const ratio = getHeroBowChargeRatio(hero, now)
  hero.heroBowChargeRatio = ratio
  hero.drawHeroPowerBar?.(ratio)
  const sprite = hero.sprite
  if (hero.heroBowChargeVisualLocked) {
    freezeHeroBowChargeFrame(hero)
    return
  }
  if (sprite && hero.currentSheet === SHEET_TYPES.action) {
    continueHeroBowChargeAnimation(hero)
  }
}

function clearHeroBowCharge(hero: UnitEntity): void {
  hero.heroBowChargeStart = null
  hero.heroBowChargeRatio = undefined
  hero.heroBowChargeDestination = null
  hero.heroBowChargeTarget = null
  hero.heroBowReleaseQueued = false
  hero.heroBowReleasePower = undefined
  hero.heroBowChargeVisualLocked = false
  hero.removeHeroPowerBar?.()
}

export function cancelHeroBowCharge(hero: UnitEntity): void {
  if (hero.heroBowChargeStart == null) return
  const sprite = hero.sprite
  clearHeroBowCharge(hero)
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  finishHeroToolAnimation(hero)
}

function finishHeroBowChargeShot(hero: UnitEntity): void {
  const destination = hero.heroBowChargeDestination
  if (!destination) {
    cancelHeroBowCharge(hero)
    return
  }
  const power = hero.heroBowReleasePower ?? getHeroBowChargeRatio(hero)
  const target = hero.heroBowChargeTarget ?? undefined
  clearHeroBowCharge(hero)
  const map = hero.context?.map
  const sprite = hero.sprite
  if (map) {
    const projectile = new Projectile(
      {
        owner: hero,
        type: 'Arrow',
        target,
        destination,
        spawnPoint: getHeroArrowSpawnPoint(hero),
        damage: 4,
        maxDistance: HERO_ARROW_MAX_DISTANCE * Math.max(HERO_BOW_MIN_POWER, Math.min(1, power)),
      },
      hero.context!
    )
    map.addChild(projectile)
  }
  if (!sprite) {
    finishHeroToolAnimation(hero)
    return
  }
  sprite.onFrameChange = undefined
  sprite.onComplete = () => finishHeroToolAnimation(hero)
  sprite.loop = false
  if (sprite.currentFrame >= sprite.textures.length - 1) finishHeroToolAnimation(hero)
  else sprite.play()
}

function beginHeroBowChargeAt(hero: UnitEntity, destination: Point, target?: RuntimeEntity | null): boolean {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return false
  hero.actionLocked = true
  hero.heroBowChargeStart = performance.now()
  hero.heroBowChargeRatio = 0
  hero.heroBowChargeDestination = destination
  hero.heroBowChargeTarget = target ?? null
  hero.heroBowReleaseQueued = false
  hero.heroBowReleasePower = undefined
  hero.heroBowChargeVisualLocked = false
  hero.setTextures?.(SHEET_TYPES.action)
  sprite.loop = false
  sprite.onComplete = undefined
  hero.syncShadow?.()
  hero.drawHeroPowerBar?.(0)
  onSpriteLoopAtFrame(sprite, HERO_BOW_HOLD_FRAME, () => freezeHeroBowChargeFrame(hero))
  return true
}

export function releaseHeroBowCharge(hero: UnitEntity): boolean {
  if (hero.heroBowChargeStart == null || hero.heroBowReleaseQueued) return false
  hero.heroBowReleasePower = getHeroBowChargeRatio(hero)
  hero.heroBowChargeRatio = hero.heroBowReleasePower
  hero.drawHeroPowerBar?.(hero.heroBowReleasePower)
  const sprite = hero.sprite
  hero.heroBowReleaseQueued = true
  if (sprite && hero.currentSheet === SHEET_TYPES.action && sprite.currentFrame < SHOOT_RELEASE_FRAME) {
    sprite.loop = false
    sprite.onComplete = undefined
    onSpriteLoopAtFrame(sprite, SHOOT_RELEASE_FRAME, () => finishHeroBowChargeShot(hero))
    if (!sprite.playing) sprite.play()
    return true
  }
  finishHeroBowChargeShot(hero)
  return true
}

function findMeleeTarget(hero: UnitEntity): RuntimeEntity | null {
  const aimDegree = hero.degree ?? 0
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => getActionCondition(hero, target, ACTION_TYPES.attack),
    TOOL_ACTION_RANGE
  )
  let best: RuntimeEntity | null = null
  let bestDist = MELEE_ATTACK_RANGE
  for (const candidate of candidates) {
    const dist = Math.hypot(candidate.x - hero.x, candidate.y - hero.y)
    if (dist > bestDist) continue
    if (angleDelta(getInstanceDegree(hero, candidate.x, candidate.y), aimDegree) > MELEE_CONE_HALF_ANGLE) continue
    best = candidate
    bestDist = dist
  }
  return best
}

function swingToolInPlace(hero: UnitEntity): void {
  playHeroToolAnimation(
    hero,
    () => {
      const target = findMeleeTarget(hero)
      if (!target) {
        playAudibleSoundCue(hero, SOUND_CUES.hero.meleeWhiff)
        return
      }
      if (hero.sounds?.hit) {
        playAudibleSoundCue(hero, hero.sounds.hit)
      }
      const beforeHitPoints = target.hitPoints ?? 0
      target.hitPoints = getHitPointsWithDamage(hero, target, undefined, getCombatXpBonus(hero, XP_CATEGORIES.melee))
      const damageDealt = beforeHitPoints - (target.hitPoints ?? 0)
      showDamageFeedback(target, damageDealt)
      grantUnitXp(hero, XP_CATEGORIES.melee, damageDealt)
      if (target.selected || target.shouldKeepHealthBarVisible?.()) target.drawHealthBar?.()
      target.isAttacked?.(hero)
      if ((target.hitPoints ?? 0) <= 0) {
        grantUnitXp(hero, XP_CATEGORIES.melee, XP_KILL_BONUS)
        target.die?.()
      }
    },
    SLASH_IMPACT_FRAME
  )
}

export function triggerToolAttackAt(hero: UnitEntity, tool: HeroTool | null, destination: Point): boolean {
  if (!tool || hero.actionLocked) return false
  hero.degree = getInstanceDegree(hero, destination.x, destination.y)
  if (tryDeliverAt(hero)) return true
  if (tool === 'bow') {
    const target = findArrowTargetInAim(hero)
    return beginHeroBowChargeAt(hero, target ? { x: target.x, y: target.y } : destination, target)
  }
  const actionResult = triggerToolActionAt(hero, tool)
  if (actionResult === 'triggered') return true
  if (actionResult === 'blocked') return false
  if (WHIFF_TOOLS.has(tool)) {
    swingToolInPlace(hero)
    return true
  }
  return false
}

export function triggerToolAction(hero: UnitEntity, tool: HeroTool | null): boolean {
  if (tool) {
    const config = HERO_TOOL_ACTIONS[tool]
    if (config) {
      const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, config.matches, TOOL_ACTION_RANGE)
      const closest = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(hero, candidates)
      if (closest) {
        const action = config.resolve(hero, closest.instance)
        if (action && isToolTargetReachable(hero, tool, closest.instance)) {
          action()
          return true
        }
        return false
      }
    }
  }
  if (tryDeliver(hero)) return true
  if (tool === 'bow') {
    fireBlindArrow(hero)
    return true
  }
  if (tool && WHIFF_TOOLS.has(tool)) {
    swingToolInPlace(hero)
    return true
  }
  return false
}
