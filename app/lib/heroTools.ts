import { Assets } from 'pixi.js'
import {
  ACTION_TYPES,
  BUILDING_TYPES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_TYPES,
  SHEET_TYPES,
  SOUND_CUES,
  WORK_TYPES,
} from '../constants'
import { getActionCondition, getHitPointsWithDamage } from './combat'
import { findInstancesInSight } from './grid/visibility'
import { getClosestInstanceWithPath } from './grid/queries'
import { onSpriteLoopAtFrame, SHOOT_RELEASE_FRAME, SLASH_IMPACT_FRAME } from './graphics'
import { getInstanceDegree } from './maths'
import { playAudibleSoundCue } from './sound'
import { showDamageFeedback } from './combatFeedback'
import { Projectile } from '../classes/Projectile'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'

export type HeroTool = 'axe' | 'pickaxe' | 'bow' | 'hammer' | 'unarmed'

export const HERO_TOOL_ORDER: HeroTool[] = ['unarmed', 'axe', 'pickaxe', 'hammer', 'bow']

const TOOL_ACTION_RANGE = 3
const HUNTER_ARROW_RANGE = 4
const HERO_ARROW_MAX_DISTANCE = HUNTER_ARROW_RANGE * Math.hypot(CELL_WIDTH, CELL_HEIGHT)
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

// Tools with no gather/hunt/build effect of their own — clicking/pressing e with nothing
// valid nearby just plays the swing animation and does nothing else.
const WHIFF_TOOLS = new Set<HeroTool>(['axe', 'pickaxe', 'hammer', 'unarmed'])

const TOOL_WORK: Record<HeroTool, string> = {
  axe: WORK_TYPES.woodcutter,
  pickaxe: WORK_TYPES.stoneminer,
  bow: WORK_TYPES.hunter,
  hammer: WORK_TYPES.builder,
  unarmed: WORK_TYPES.attacker,
}

function resourceKind(target: RuntimeEntity): string | undefined {
  return target.category || target.type
}

function buildingAcceptsCarriedResource(hero: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  if (target.family !== FAMILY_TYPES.building) return false
  const building = target as BuildingEntity
  if (hero.category === 'Boat') return building.type === BUILDING_TYPES.dock
  return building.type === BUILDING_TYPES.townCenter || Boolean(building.accept?.includes(hero.loadingType ?? ''))
}

type HeroToolConfig = {
  matches: (target: RuntimeEntity) => boolean
  resolve: (hero: UnitEntity, target: RuntimeEntity) => (() => void) | null
}

const HERO_TOOL_ACTIONS: Partial<Record<HeroTool, HeroToolConfig>> = {
  unarmed: {
    matches: target => resourceKind(target) === 'Berrybush' || (target.family === FAMILY_TYPES.animal && Boolean(target.isDead)),
    resolve: (hero, target) => {
      if (resourceKind(target) === 'Berrybush') {
        return getActionCondition(hero, target, ACTION_TYPES.forageberry) ? () => hero.sendToBerrybush?.(target) : null
      }
      // Bare hands can only collect meat off an already-dead carcass, not hunt — killing the
      // animal still requires the bow (see the `bow` config below for the hunt+takemeat combo).
      return getActionCondition(hero, target, ACTION_TYPES.takemeat) ? () => hero.sendToTakeMeat(target, true) : null
    },
  },
  axe: {
    matches: target => resourceKind(target) === 'Tree',
    resolve: (hero, target) =>
      getActionCondition(hero, target, ACTION_TYPES.chopwood) ? () => hero.sendToTree?.(target) : null,
  },
  pickaxe: {
    matches: target => resourceKind(target) === 'Stone' || resourceKind(target) === 'Gold',
    resolve: (hero, target) => {
      const action = resourceKind(target) === 'Stone' ? ACTION_TYPES.minestone : ACTION_TYPES.minegold
      if (!getActionCondition(hero, target, action)) return null
      return () => (resourceKind(target) === 'Stone' ? hero.sendToStone?.(target) : hero.sendToGold?.(target))
    },
  },
  bow: {
    matches: target => target.family === FAMILY_TYPES.animal,
    resolve: (hero, target) => {
      // A hunted-down animal is still `family === 'animal'` (a carcass), not a new entity —
      // prefer collecting its meat over re-issuing a hunt order, mirroring the dispatch already
      // used elsewhere for resuming an interrupted animal task (app/classes/unit/UnitActions.ts).
      if (getActionCondition(hero, target, ACTION_TYPES.takemeat)) return () => hero.sendToTakeMeat(target, true)
      if (getActionCondition(hero, target, ACTION_TYPES.hunt)) return () => hero.sendToHunt(target)
      return null
    },
  },
  hammer: {
    matches: target => {
      if (target.family !== FAMILY_TYPES.building) return false
      const building = target as BuildingEntity
      return !building.isBuilt || (building.hitPoints ?? 0) < (building.totalHitPoints ?? 0)
    },
    resolve: (hero, target) =>
      getActionCondition(hero, target, ACTION_TYPES.build)
        ? () => hero.sendToBuilding?.(target as BuildingEntity)
        : null,
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

  sprite.onComplete = () => {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
    hero.actionLocked = false
    const hadPendingOrder = hero.flushPendingOrder?.()
    if (!hadPendingOrder && !hero.isDead) hero.setTextures?.(SHEET_TYPES.standing)
    hero.syncShadow?.()
  }

  if (!onImpact) return
  if (impactFrame == null) {
    onImpact()
    return
  }
  onSpriteLoopAtFrame(sprite, impactFrame, onImpact)
}

function canDeliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!((hero.loading ?? 0) > 0)) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  if (!getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })) return false
  if (!hero.isUnitAtDest?.(ACTION_TYPES.delivery, target)) return false
  return true
}

function deliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!canDeliverToBuilding(hero, target)) return false
  hero.previousDest = null
  hero.sendToEvt?.(target, ACTION_TYPES.delivery)
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
  hero.previousDest = null
  hero.sendToEvt?.(closest.instance, ACTION_TYPES.delivery)
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
  if (tool === 'hammer' && target.family === FAMILY_TYPES.building) return ACTION_TYPES.build
  return null
}

function triggerToolActionAt(hero: UnitEntity, tool: HeroTool): boolean {
  const config = HERO_TOOL_ACTIONS[tool]
  if (!config) return false

  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => config.matches(target) && config.resolve(hero, target) !== null,
    CLICK_TARGET_SEARCH_RANGE
  ).filter(target => {
    const action = getToolActionForTarget(tool, target)
    return Boolean(action && hero.isUnitAtDest?.(action, target))
  })

  const target = getDirectionalTarget(hero, candidates)
  if (target) {
    config.resolve(hero, target)?.()
    return true
  }

  return false
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
    y: hero.y - HERO_ARROW_HEIGHT_OFFSET,
  }
}

function fireArrowAt(hero: UnitEntity, destination: Point, target?: RuntimeEntity | null): void {
  const map = hero.context?.map
  if (!map) return
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
          maxDistance: HERO_ARROW_MAX_DISTANCE,
        },
        hero.context!
      )
      map.addChild(projectile)
    },
    SHOOT_RELEASE_FRAME
  )
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
      const beforeHitPoints = target.hitPoints ?? 0
      target.hitPoints = getHitPointsWithDamage(hero, target)
      showDamageFeedback(target, beforeHitPoints - (target.hitPoints ?? 0))
      if (target.selected || target.shouldKeepHealthBarVisible?.()) target.drawHealthBar?.()
      target.isAttacked?.(hero)
      if ((target.hitPoints ?? 0) <= 0) target.die?.()
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
    fireArrowAt(hero, target ? { x: target.x, y: target.y } : destination, target)
    return true
  }
  if (triggerToolActionAt(hero, tool)) return true
  if (WHIFF_TOOLS.has(tool)) {
    swingToolInPlace(hero)
    return true
  }
  return false
}

export function triggerToolAction(hero: UnitEntity, tool: HeroTool | null): boolean {
  const config = tool ? HERO_TOOL_ACTIONS[tool] : undefined
  if (config) {
    const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, config.matches, TOOL_ACTION_RANGE).filter(
      target => config.resolve(hero, target) !== null
    )
    const closest = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(hero, candidates)
    if (closest) {
      config.resolve(hero, closest.instance)?.()
      return true
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
