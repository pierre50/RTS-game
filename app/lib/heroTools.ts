import { Assets, Graphics } from 'pixi.js'
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
import { isHeroActionInRange } from './heroActionRange'
import { getActionCondition, type CombatEntity } from './combat'
import { applyCombatHit } from './combatHit'
import { showParryFeedback } from './combatFeedback'
import { getWorkWithLoadingType } from './extra'
import { getEquipmentCombatStats, getUnitWorkEquipment, refreshUnitEquipmentStats } from './equipmentStats'
import { findInstancesInSight } from './grid/visibility'
import { getClosestInstanceWithPath } from './grid/queries'
import { onSpriteLoopAtFrame, SHOOT_RELEASE_FRAME, SLASH_IMPACT_FRAME } from './graphics'
import { t } from './lang'
import { degreeToDirection, getInstanceDegree, getReliefOffset } from './maths'
import { playAudibleSoundCue, playSoundCue } from './sound'
import { getCombatXpBonus, XP_CATEGORIES } from './unitExperience'
import {
  drainEnergyAmount,
  ensureUnitEnergy,
  getActionEnergyCost,
  hasEnergyForAction,
  spendEnergyForAction,
} from './unitEnergy'
import { Projectile } from '../classes/Projectile'
import { applyWorkForAction } from '../classes/unit/UnitCommands'
import type { BuildingEntity, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'

export type HeroCivilTool = 'axe' | 'pickaxe' | 'hammer' | 'fishingRod'
export type HeroContextAction = 'chop' | 'mine' | 'build' | 'fish' | 'gather' | 'pickup' | 'interact'
export type HeroEquippedItem = 'interact' | 'sword' | 'halberd' | 'bow'
export type HeroTool = HeroEquippedItem

export const HERO_EQUIPPED_ITEM_ORDER: HeroEquippedItem[] = ['interact', 'sword', 'halberd', 'bow']
export const HERO_TOOL_ORDER = HERO_EQUIPPED_ITEM_ORDER

const TOOL_ACTION_RANGE = 3
const HUNTER_ARROW_RANGE = 4
const HERO_BOW_CHARGE_ENERGY_ACTION = 'heroBowCharge'
const HERO_DEFENSE_ENERGY_ACTION = 'heroDefense'
const HERO_WHIFF_ENERGY_ACTION = 'heroWhiff'
const HERO_PARRY_SOUND_CUES = ['sword-attack', 'sword-attack-2']
const HERO_BOW_CHARGE_MS = 700
const HERO_BOW_MIN_POWER = 0.2
const HERO_BOW_HOLD_FRAME = Math.max(0, SHOOT_RELEASE_FRAME - 1)
const HERO_DEFENSE_HOLD_FRAME = 2
const HERO_DEFENSE_REVERSE_FRAME_MS = 45
const HERO_DEFENSE_RELEASE_FALLBACK_MS = 260
const HERO_DEFENSE_FLASH_MS = 120
const HERO_DEFENSE_SPARK_MS = 180
const HERO_DEFENSE_SPARK_STEP_MS = 30
const BLIND_SHOT_DISTANCE = 200
const CLICK_TARGET_SEARCH_RANGE = 15
const CLICK_DIRECTION_HALF_ANGLE = 25
const MOUNTED_ATTACK_HALF_ANGLE = 45
const HERO_ARROW_FORWARD_OFFSET = 16
const HERO_ARROW_HEIGHT_OFFSET = 18
const HERO_ARROW_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
const HERO_ARROW_MAX_DISTANCE = HUNTER_ARROW_RANGE * HERO_ARROW_CELL_DISTANCE

export const contextualToolByAction: Partial<Record<HeroContextAction, HeroCivilTool>> = {
  chop: 'axe',
  mine: 'pickaxe',
  build: 'hammer',
  fish: 'fishingRod',
}

export const DEFAULT_HERO_TOOL_LEVELS: Record<HeroCivilTool, number> = {
  axe: 1,
  pickaxe: 1,
  hammer: 1,
  fishingRod: 1,
}

const EQUIPPED_ITEM_WORK: Record<HeroEquippedItem, string> = {
  interact: WORK_TYPES.attacker,
  sword: 'heroSword',
  halberd: 'heroSpear',
  bow: WORK_TYPES.hunter,
}

type ToolActionResult = 'triggered' | 'blocked' | 'miss'
type DeliveryAimResult = 'delivered' | 'blocked' | 'none'
type RememberTimedEnergyAt = (now: number) => void
type FlashableLayer = {
  alpha?: number
  blendMode?: unknown
  tint?: number | string
  visible?: boolean
}
type HeroDefenseFlashState = {
  alpha?: number
  blendMode?: unknown
  tint?: number | string
  token: number
}
type ParryEffectHost = UnitEntity & {
  addChild?: (child: Graphics) => Graphics
}
const heroDefenseFlashStates = new WeakMap<FlashableLayer, HeroDefenseFlashState>()

function resourceKind(target: RuntimeEntity): string | undefined {
  return target.category || target.type
}

export function buildingAcceptsCarriedResource(hero: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  if (target.family !== FAMILY_TYPES.building) return false
  const building = target as BuildingEntity
  return building.type === BUILDING_TYPES.townCenter || Boolean(building.accept?.includes(hero.loadingType ?? ''))
}

type HeroContextActionConfig = {
  action: HeroContextAction
  matches: (target: RuntimeEntity) => boolean
  resolve: (hero: UnitEntity, target: RuntimeEntity) => (() => void) | null
}

// The hero is fully player-controlled and must never path or move on its own — every entry
// point below (aimed click, plain "e" press, the building deposit button) only ever calls
// this once the caller has already confirmed the hero is in range
// (isContextActionTargetReachable / canDeliverToBuilding). This fires the action's effect directly instead of going through
// hero.sendTo*/commonSendTo, which is built for AI-pathed units and can silently walk them.
function runHeroAction(hero: UnitEntity, target: RuntimeEntity, action: string): void {
  if (hero.actionLocked) return
  hero.setDest?.(target)
  hero.action = action
  hero.degree = getInstanceDegree(hero, target.x, target.y)
  hero.getAction?.(action)
}

function refreshHeroActionSheet(hero: UnitEntity, work: string, action: string): void {
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  const asset = hero.allAssets?.[work]?.[actionSheet]
  if (!asset) return
  const sheet = Assets.cache.get(asset)
  if (sheet) hero.actionSheet = sheet
}

// Same as runHeroAction, but also runs the work/texture/cargo bookkeeping commonSendTo would
// have applied for a gather-type action (correct animation sheet, dropping mismatched cargo
// when switching gather types) — reused from the shared unit command logic, not duplicated.
function runHeroGatherAction(hero: UnitEntity, target: RuntimeEntity, action: string, work: string): void {
  if (hero.actionLocked) return
  applyWorkForAction(hero, work, action)
  refreshHeroActionSheet(hero, work, action)
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

const HERO_CONTEXT_ACTIONS: HeroContextActionConfig[] = [
  {
    action: 'gather',
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
  {
    action: 'chop',
    matches: target => resourceKind(target) === 'Tree',
    resolve: (hero, target) => resolveHeroGatherAction(hero, target, ACTION_TYPES.chopwood, WORK_TYPES.woodcutter),
  },
  {
    action: 'mine',
    matches: target => resourceKind(target) === 'Stone' || resourceKind(target) === 'Gold',
    resolve: (hero, target) => {
      const isStone = resourceKind(target) === 'Stone'
      const action = isStone ? ACTION_TYPES.minestone : ACTION_TYPES.minegold
      const work = isStone ? WORK_TYPES.stoneminer : WORK_TYPES.goldminer
      return resolveHeroGatherAction(hero, target, action, work)
    },
  },
  {
    action: 'build',
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
  {
    action: 'fish',
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
]

export function getHeroToolLevel(hero: UnitEntity, tool: HeroCivilTool): number {
  return Math.max(0, Math.floor(hero.toolLevels?.[tool] ?? DEFAULT_HERO_TOOL_LEVELS[tool] ?? 0))
}

function spendHeroEnergy(hero: UnitEntity, action: string): boolean {
  if (spendEnergyForAction(hero, action)) return true
  if (hero.owner?.isPlayed) {
    hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  }
  return false
}

function hasEnergyToStartTimedHeroAction(hero: UnitEntity, action: string): boolean {
  ensureUnitEnergy(hero)
  if (getActionEnergyCost(hero, action) <= 0) return true
  if ((hero.energy ?? 0) > 0) return true
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  return false
}

function drainTimedHeroEnergy(
  hero: UnitEntity,
  action: string,
  startAt: number | null | undefined,
  lastAt: number | null | undefined,
  rememberLastAt: RememberTimedEnergyAt,
  durationMs: number,
  now = performance.now()
): boolean {
  if (startAt == null) return true
  const totalCost = getActionEnergyCost(hero, action)
  if (totalCost <= 0) return true
  const previous = lastAt ?? startAt
  const elapsed = Math.max(0, now - previous)
  rememberLastAt(now)
  if (elapsed <= 0) return true
  return drainEnergyAmount(hero, (totalCost * elapsed) / durationMs)
}

function getHeroDefenseFlashLayers(hero: UnitEntity): FlashableLayer[] {
  const layers = (hero as UnitEntity & { appearanceLayerSprites?: Map<number, FlashableLayer> }).appearanceLayerSprites
  return layers ? [...layers.values()].filter(layer => layer.visible !== false) : []
}

function drawParrySpark(graphics: Graphics, x: number, y: number, radius: number): void {
  graphics.moveTo(x - radius, y)
  graphics.lineTo(x + radius, y)
  graphics.moveTo(x, y - radius)
  graphics.lineTo(x, y + radius)
  graphics.moveTo(x - radius * 0.7, y - radius * 0.7)
  graphics.lineTo(x + radius * 0.7, y + radius * 0.7)
  graphics.moveTo(x + radius * 0.7, y - radius * 0.7)
  graphics.lineTo(x - radius * 0.7, y + radius * 0.7)
}

function getHeroDefenseSparkPoint(hero: UnitEntity): Point {
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  return {
    x: Math.cos(rad) * 15,
    y: getReliefOffset(hero) - 18 + Math.sin(rad) * 6,
  }
}

function showHeroDefenseParryEffect(hero: UnitEntity): void {
  const host = hero as ParryEffectHost
  const addChild = host.addChild?.bind(host)
  const scheduler = hero.context?.scheduler
  if (!addChild || !scheduler) return

  const effect = new Graphics()
  const origin = getHeroDefenseSparkPoint(hero)
  effect.zIndex = 100
  effect.alpha = 1
  effect.position.set(origin.x, origin.y)
  addChild(effect)

  let elapsed = 0
  const draw = () => {
    const progress = Math.max(0, Math.min(1, elapsed / HERO_DEFENSE_SPARK_MS))
    const alpha = 1 - progress
    const spread = 4 + progress * 14
    effect.clear()
    drawParrySpark(effect, 0, 0, 7 + progress * 3)
    drawParrySpark(effect, -spread, -spread * 0.35, 3.5)
    drawParrySpark(effect, spread * 0.85, spread * 0.2, 3)
    effect.stroke({ color: 0xfff06a, alpha, width: 2 })
    effect.circle(0, 0, 2.5 + progress * 2)
    effect.fill({ color: 0xffffff, alpha: alpha * 0.9 })
    effect.alpha = alpha
  }

  draw()
  let taskId: number | null = null
  taskId = scheduler.add(
    () => {
      elapsed += HERO_DEFENSE_SPARK_STEP_MS
      if (elapsed >= HERO_DEFENSE_SPARK_MS) {
        if (taskId != null) scheduler.remove(taskId)
        effect.parent?.removeChild(effect)
        effect.destroy()
        return
      }
      draw()
    },
    HERO_DEFENSE_SPARK_STEP_MS,
    'hero.defenseSpark'
  )
}

function checkHeroEnergy(hero: UnitEntity, action: string): boolean {
  if (hasEnergyForAction(hero, action)) return true
  if (hero.owner?.isPlayed) {
    hero.context?.menu?.showMessage(t('heroNotEnoughEnergy'), 'warning')
  }
  return false
}

function runContextAction(
  hero: UnitEntity,
  contextAction: HeroContextAction,
  unitAction: string,
  effect: () => void
): boolean {
  if (!checkHeroEnergy(hero, unitAction)) return false
  hero.contextAction = contextAction
  effect()
  return true
}

export function applyEquippedItemAppearance(hero: UnitEntity, tool: HeroEquippedItem): void {
  const work = EQUIPPED_ITEM_WORK[tool]
  if (hero.work === work) {
    refreshUnitEquipmentStats(hero)
    return
  }
  hero.work = work
  refreshUnitEquipmentStats(hero)
  const workAssets = hero.allAssets?.[work]
  if (workAssets) {
    if (workAssets[SHEET_TYPES.action]) hero.actionSheet = Assets.cache.get(workAssets[SHEET_TYPES.action])
    if (workAssets[SHEET_TYPES.riding]) hero.ridingSheet = Assets.cache.get(workAssets[SHEET_TYPES.riding])
    if (!hero.loading) {
      if (workAssets[SHEET_TYPES.standing]) hero.standingSheet = Assets.cache.get(workAssets[SHEET_TYPES.standing])
      if (workAssets[SHEET_TYPES.walking]) hero.walkingSheet = Assets.cache.get(workAssets[SHEET_TYPES.walking])
    }
  }
  hero.setTextures?.(hero.sprite?.playing ? SHEET_TYPES.walking : SHEET_TYPES.standing)
}

export const applyToolAppearance = applyEquippedItemAppearance

function playHeroToolAnimation(hero: UnitEntity, onImpact?: () => void, impactFrame: number | null = null): void {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return

  hero.actionLocked = true
  sprite.loop = false
  hero.setTextures?.(SHEET_TYPES.action)
  hero.syncMountedHorseSprite?.()
  sprite.gotoAndPlay(0)
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
  hero.contextAction = null
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

function canAimDeliveryAtBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (!((hero.loading ?? 0) > 0)) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  return getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })
}

function angleDelta(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function getAimDelta(hero: UnitEntity, target: RuntimeEntity): number {
  return angleDelta(getInstanceDegree(hero, target.x, target.y), hero.degree ?? 0)
}

// A mounted hero can't snap-turn the horse to face an attack the way an unmounted hero can, so
// any click outside a frontal cone around the horse's current heading is ignored (no turn, no
// swing/shot) until the player physically re-orients the horse via movement.
export function isMountedAttackAimBlocked(hero: UnitEntity, point: Point): boolean {
  if (!hero.mountedOnHorse) return false
  return angleDelta(getInstanceDegree(hero, point.x, point.y), hero.degree ?? 0) > MOUNTED_ATTACK_HALF_ANGLE
}

function getDirectionalTarget<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T | null {
  return getDirectionalTargets(hero, candidates, halfAngle)[0] ?? null
}

function getDirectionalTargets<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T[] {
  return candidates
    .map(target => ({
      target,
      angle: getAimDelta(hero, target),
      dist: Math.hypot(target.x - hero.x, target.y - hero.y),
    }))
    .filter(candidate => candidate.angle <= halfAngle)
    .sort((a, b) => a.angle - b.angle || a.dist - b.dist)
    .map(candidate => candidate.target)
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

function tryDeliverAt(hero: UnitEntity): DeliveryAimResult {
  if (!((hero.loading ?? 0) > 0)) return 'none'
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canAimDeliveryAtBuilding(hero, target),
    CLICK_TARGET_SEARCH_RANGE
  )

  const target = getDirectionalTarget(hero, candidates)
  if (!target) return 'none'
  return deliverToBuilding(hero, target) ? 'delivered' : 'blocked'
}

function getHeroWeaponDamage(tool: HeroEquippedItem): number {
  const stats = getEquipmentCombatStats(getUnitWorkEquipment(EQUIPPED_ITEM_WORK[tool]))
  const damage = Math.max(stats.meleeAttack, stats.pierceAttack)
  return damage || (tool === 'interact' ? 3 : 0)
}

function getHeroWeaponCombatSource(hero: UnitEntity, tool: HeroEquippedItem): CombatEntity {
  return {
    ...hero,
    meleeAttack: getHeroWeaponDamage(tool),
    pierceAttack: 0,
  }
}

function canBeHeroMeleeTarget(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): boolean {
  if (
    target === hero ||
    ![FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal].includes(target.family ?? '') ||
    target.isDead ||
    target.isDestroyed
  ) {
    return false
  }
  return getActionCondition(getHeroWeaponCombatSource(hero, tool), target, ACTION_TYPES.attack)
}

function findHeroMeleeTargetInAim(hero: UnitEntity, tool: HeroEquippedItem): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canBeHeroMeleeTarget(hero, target, tool),
    CLICK_TARGET_SEARCH_RANGE
  )
  return getDirectionalTarget(hero, candidates)
}

function getContextActionForTarget(contextAction: HeroContextAction, target: RuntimeEntity): string | null {
  if (contextAction === 'gather' && resourceKind(target) === 'Berrybush') return ACTION_TYPES.forageberry
  if (contextAction === 'gather' && target.family === FAMILY_TYPES.animal && target.isDead) return ACTION_TYPES.takemeat
  if (contextAction === 'chop' && resourceKind(target) === 'Tree') return ACTION_TYPES.chopwood
  if (contextAction === 'mine' && resourceKind(target) === 'Stone') return ACTION_TYPES.minestone
  if (contextAction === 'mine' && resourceKind(target) === 'Gold') return ACTION_TYPES.minegold
  if (contextAction === 'build' && target.family === FAMILY_TYPES.building) return ACTION_TYPES.build
  if (contextAction === 'fish' && target.category === 'Fish') return ACTION_TYPES.fishing
  return null
}

// The hero is fully player-controlled and must never auto-path to a target — every tool
// interaction (aimed click or plain "e" press) may only fire once the hero is already in
// place. hero contact tools get a small forgiveness band because the player positions the
// hero by hand while resource sprites often extend beyond their grid cell.
function isContextActionTargetReachable(
  hero: UnitEntity,
  contextAction: HeroContextAction,
  target: RuntimeEntity
): boolean {
  const action = getContextActionForTarget(contextAction, target)
  if (!action) return false
  if (isHeroActionInRange(hero, action, target)) return true
  return Boolean(hero.isUnitAtDest?.(action, target))
}

// The hero can't hold or swing a gather/combat tool while riding a horse. A reachable context
// action target is treated the same as a whiffed swing (bare-hand animation + wind sound) rather
// than silently failing, so the player gets clear feedback on why nothing happened.
function blockContextActionWhileMounted(hero: UnitEntity): boolean {
  if (!hero.mountedOnHorse) return false
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroCannotGatherMounted'), 'warning')
  return true
}

function performContextActionAt(hero: UnitEntity): ToolActionResult {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => HERO_CONTEXT_ACTIONS.some(config => config.matches(target)),
    CLICK_TARGET_SEARCH_RANGE
  )

  for (const target of getDirectionalTargets(hero, candidates)) {
    const config = HERO_CONTEXT_ACTIONS.find(candidate => candidate.matches(target))
    if (!config) continue
    if (!isContextActionTargetReachable(hero, config.action, target)) continue
    if (blockContextActionWhileMounted(hero)) return 'miss'
    const unitAction = getContextActionForTarget(config.action, target)
    if (!unitAction) continue
    const action = config.resolve(hero, target)
    if (action) return runContextAction(hero, config.action, unitAction, action) ? 'triggered' : 'blocked'
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
          damage: getHeroWeaponDamage('bow'),
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

function hasEnergyToStartBowCharge(hero: UnitEntity): boolean {
  return hasEnergyToStartTimedHeroAction(hero, HERO_BOW_CHARGE_ENERGY_ACTION)
}

function drainHeroBowChargeEnergy(hero: UnitEntity, now = performance.now()): boolean {
  return drainTimedHeroEnergy(
    hero,
    HERO_BOW_CHARGE_ENERGY_ACTION,
    hero.heroBowChargeStart,
    hero.heroBowChargeLastEnergyAt,
    value => (hero.heroBowChargeLastEnergyAt = value),
    HERO_BOW_CHARGE_MS,
    now
  )
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

export function canHeroDefendWithTool(tool: HeroEquippedItem | null | undefined): boolean {
  return tool === 'sword' || tool === 'halberd'
}

function hasEnergyToStartDefense(hero: UnitEntity): boolean {
  return hasEnergyToStartTimedHeroAction(hero, HERO_DEFENSE_ENERGY_ACTION)
}

function drainHeroDefenseEnergy(hero: UnitEntity, now = performance.now()): boolean {
  if (!hero.heroDefenseActive) return true
  return drainTimedHeroEnergy(
    hero,
    HERO_DEFENSE_ENERGY_ACTION,
    hero.heroDefenseStart,
    hero.heroDefenseLastEnergyAt,
    value => (hero.heroDefenseLastEnergyAt = value),
    HERO_BOW_CHARGE_MS,
    now
  )
}

function stopHeroDefenseReverse(hero: UnitEntity): void {
  const taskId = hero.heroDefenseReverseTaskId
  if (taskId != null) hero.context?.scheduler?.remove(taskId)
  hero.heroDefenseReverseTaskId = null
}

function stopHeroDefenseReleaseFallback(hero: UnitEntity): void {
  const taskId = hero.heroDefenseReleaseFallbackTaskId
  if (taskId != null) hero.context?.scheduler?.remove(taskId)
  hero.heroDefenseReleaseFallbackTaskId = null
}

function freezeHeroDefenseFrame(hero: UnitEntity, frame = HERO_DEFENSE_HOLD_FRAME): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) return
  const lastFrame = Math.max(0, sprite.textures.length - 1)
  hero.heroDefenseVisualLocked = true
  sprite.loop = false
  sprite.gotoAndStop(Math.max(0, Math.min(frame, lastFrame)))
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

function continueHeroDefenseAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) return
  if (hero.heroDefenseVisualLocked) {
    freezeHeroDefenseFrame(hero)
    return
  }
  sprite.loop = false
  sprite.onComplete = undefined
  onSpriteLoopAtFrame(sprite, HERO_DEFENSE_HOLD_FRAME, () => freezeHeroDefenseFrame(hero))
  if (!sprite.playing && sprite.currentFrame < HERO_DEFENSE_HOLD_FRAME) sprite.play()
  if (sprite.currentFrame >= HERO_DEFENSE_HOLD_FRAME) freezeHeroDefenseFrame(hero)
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

function clearHeroDefense(hero: UnitEntity): void {
  hero.heroDefenseStart = null
  hero.heroDefenseLastEnergyAt = undefined
  hero.heroDefenseActive = false
  hero.heroDefenseVisualLocked = false
  hero.showHeroDefenseFlash = undefined
}

function finishHeroDefenseRelease(hero: UnitEntity): void {
  stopHeroDefenseReverse(hero)
  stopHeroDefenseReleaseFallback(hero)
  clearHeroDefense(hero)
  finishHeroToolAnimation(hero)
}

function scheduleHeroDefenseReleaseFallback(hero: UnitEntity): void {
  stopHeroDefenseReleaseFallback(hero)
  const scheduler = hero.context?.scheduler
  if (!scheduler) return
  hero.heroDefenseReleaseFallbackTaskId = scheduler.addOneShot(
    () => {
      hero.heroDefenseReleaseFallbackTaskId = null
      finishHeroDefenseRelease(hero)
    },
    HERO_DEFENSE_RELEASE_FALLBACK_MS,
    'hero.defenseReleaseFallback'
  )
}

function reverseHeroDefenseAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) {
    finishHeroDefenseRelease(hero)
    return
  }
  sprite.onComplete = undefined
  sprite.onFrameChange = undefined
  sprite.loop = false
  sprite.stop()
  const step = () => {
    const nextFrame = Math.max(0, Math.floor(sprite.currentFrame) - 1)
    sprite.gotoAndStop(nextFrame)
    hero.syncAppearanceLayers?.(SHEET_TYPES.action)
    hero.syncShadow?.()
    if (nextFrame <= 0) finishHeroDefenseRelease(hero)
  }
  if (sprite.currentFrame <= 0 || !hero.context?.scheduler) {
    sprite.gotoAndStop(0)
    finishHeroDefenseRelease(hero)
    return
  }
  stopHeroDefenseReverse(hero)
  hero.heroDefenseReverseTaskId = hero.context.scheduler.add(step, HERO_DEFENSE_REVERSE_FRAME_MS, 'hero.defenseReverse')
}

export function showHeroDefenseFlash(hero: UnitEntity): void {
  const targets = getHeroDefenseFlashLayers(hero)
  if (!targets.length) return
  playAudibleSoundCue(hero, HERO_PARRY_SOUND_CUES)
  showHeroDefenseParryEffect(hero)
  showParryFeedback(hero, t('heroDefenseMissed'))
  const states = targets.map(target => {
    const previous = heroDefenseFlashStates.get(target)
    const state = {
      target,
      alpha: previous?.alpha ?? target.alpha,
      blendMode: previous?.blendMode ?? target.blendMode,
      tint: previous?.tint ?? target.tint,
      token: (previous?.token ?? 0) + 1,
    }
    heroDefenseFlashStates.set(target, state)
    return state
  })
  for (const target of targets) {
    target.tint = 0xfff06a
    target.alpha = 1
    target.blendMode = 'add'
  }
  hero.context?.scheduler?.addOneShot(
    () => {
      for (const state of states) {
        if (heroDefenseFlashStates.get(state.target)?.token !== state.token) continue
        state.target.tint = state.tint
        state.target.alpha = state.alpha
        state.target.blendMode = state.blendMode
        heroDefenseFlashStates.delete(state.target)
      }
    },
    HERO_DEFENSE_FLASH_MS,
    'hero.defenseFlash'
  )
}

export function beginHeroDefense(hero: UnitEntity, tool: HeroEquippedItem | null | undefined): boolean {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked || !canHeroDefendWithTool(tool)) return false
  if (!hasEnergyToStartDefense(hero)) return false
  stopHeroDefenseReverse(hero)
  stopHeroDefenseReleaseFallback(hero)
  hero.actionLocked = true
  const now = performance.now()
  hero.heroDefenseStart = now
  hero.heroDefenseLastEnergyAt = now
  hero.heroDefenseActive = true
  hero.heroDefenseVisualLocked = false
  hero.showHeroDefenseFlash = () => showHeroDefenseFlash(hero)
  hero.setTextures?.(SHEET_TYPES.action)
  sprite.loop = false
  sprite.onComplete = undefined
  sprite.gotoAndPlay(0)
  hero.syncShadow?.()
  onSpriteLoopAtFrame(sprite, HERO_DEFENSE_HOLD_FRAME, () => freezeHeroDefenseFrame(hero))
  return true
}

export function updateHeroDefense(hero: UnitEntity, now = performance.now()): void {
  if (!hero.heroDefenseActive) return
  if (!drainHeroDefenseEnergy(hero, now)) {
    releaseHeroDefense(hero)
    return
  }
  continueHeroDefenseAnimation(hero)
}

export function aimHeroDefenseAt(hero: UnitEntity, destination: Point): boolean {
  if (!hero.heroDefenseActive) return false
  const previousDirection = degreeToDirection(hero.degree ?? 0)
  hero.degree = getInstanceDegree(hero, destination.x, destination.y)
  if (hero.currentSheet === SHEET_TYPES.action && degreeToDirection(hero.degree ?? 0) !== previousDirection) {
    hero.setTextures?.(SHEET_TYPES.action)
    continueHeroDefenseAnimation(hero)
  }
  return true
}

export function releaseHeroDefense(hero: UnitEntity): boolean {
  if (
    !hero.heroDefenseActive &&
    hero.heroDefenseReverseTaskId == null &&
    hero.heroDefenseReleaseFallbackTaskId == null
  ) {
    return false
  }
  clearHeroDefense(hero)
  scheduleHeroDefenseReleaseFallback(hero)
  hero.heroDefenseActive = false
  hero.heroDefenseVisualLocked = false
  hero.showHeroDefenseFlash = undefined
  reverseHeroDefenseAnimation(hero)
  return true
}

export function cancelHeroDefense(hero: UnitEntity): void {
  if (
    !hero.heroDefenseActive &&
    hero.heroDefenseReverseTaskId == null &&
    hero.heroDefenseReleaseFallbackTaskId == null
  ) {
    return
  }
  stopHeroDefenseReverse(hero)
  stopHeroDefenseReleaseFallback(hero)
  clearHeroDefense(hero)
  const sprite = hero.sprite
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  finishHeroToolAnimation(hero)
}

export function aimHeroBowChargeAt(hero: UnitEntity, destination: Point): boolean {
  if (hero.heroBowChargeStart == null || hero.heroBowReleaseQueued) return false
  const previousDirection = degreeToDirection(hero.degree ?? 0)
  hero.degree = getInstanceDegree(hero, destination.x, destination.y)
  hero.heroBowChargeDestination = destination
  hero.heroBowChargeTarget = null
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
  if (!drainHeroBowChargeEnergy(hero, now)) {
    releaseHeroBowCharge(hero)
    return
  }
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
  hero.heroBowChargeLastEnergyAt = undefined
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
        damage: getHeroWeaponDamage('bow'),
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
  if (!hasEnergyToStartBowCharge(hero)) return false
  hero.actionLocked = true
  const now = performance.now()
  hero.heroBowChargeStart = now
  hero.heroBowChargeRatio = 0
  hero.heroBowChargeLastEnergyAt = now
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

export function releaseHeroBowCharge(hero: UnitEntity, now = performance.now()): boolean {
  if (hero.heroBowChargeStart == null || hero.heroBowReleaseQueued) return false
  drainHeroBowChargeEnergy(hero, now)
  hero.heroBowReleasePower = getHeroBowChargeRatio(hero, now)
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

function playEmptyHandWhiff(hero: UnitEntity): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(hero, () => playSoundCue(SOUND_CUES.hero.meleeWhiff))
  return true
}

function playMeleeWeaponWhiff(hero: UnitEntity): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(hero, () => playSoundCue(SOUND_CUES.hero.meleeWhiff), SLASH_IMPACT_FRAME)
  return true
}

function strikeHeroMeleeTarget(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): boolean {
  if (!isHeroActionInRange(hero, ACTION_TYPES.attack, target) && !hero.isUnitAtDest?.(ACTION_TYPES.attack, target)) {
    return false
  }
  if (!spendHeroEnergy(hero, ACTION_TYPES.attack)) return false
  hero.action = ACTION_TYPES.attack
  hero.setDest?.(target)
  playHeroToolAnimation(
    hero,
    () => {
      const combatSource = getHeroWeaponCombatSource(hero, tool)
      if (!getActionCondition(combatSource, target, ACTION_TYPES.attack)) {
        if ((target.hitPoints ?? 0) <= 0) target.die?.()
        return
      }
      const { damageDealt } = applyCombatHit(combatSource, target, {
        attacker: hero,
        bonusDamage: getCombatXpBonus(hero, XP_CATEGORIES.melee),
        defaultDamage: getHeroWeaponDamage(tool),
        menu: hero.context?.menu,
        player: hero.context?.player,
        xpCategory: XP_CATEGORIES.melee,
        xpUnit: hero,
      })
      if (damageDealt > 0) {
        playAudibleSoundCue(hero, hero.sounds?.hit)
      }
    },
    SLASH_IMPACT_FRAME
  )
  return true
}

export function triggerEquippedItemActionAt(
  hero: UnitEntity,
  tool: HeroEquippedItem | null,
  destination: Point
): boolean {
  if (!tool || hero.actionLocked) return false
  hero.degree = getInstanceDegree(hero, destination.x, destination.y)
  const deliveryResult = tryDeliverAt(hero)
  if (deliveryResult === 'delivered') return true
  if (tool === 'bow') {
    return beginHeroBowChargeAt(hero, destination)
  }
  if (tool === 'sword' || tool === 'halberd') {
    const meleeTarget = findHeroMeleeTargetInAim(hero, tool)
    if (meleeTarget && strikeHeroMeleeTarget(hero, meleeTarget, tool)) return true
    return playMeleeWeaponWhiff(hero)
  }
  if (tool !== 'interact') return false
  if (deliveryResult === 'blocked') return false
  const actionResult = performContextActionAt(hero)
  if (actionResult === 'triggered') return true
  const meleeTarget = findHeroMeleeTargetInAim(hero, 'interact')
  if (meleeTarget && strikeHeroMeleeTarget(hero, meleeTarget, 'interact')) return true
  if (actionResult === 'miss') {
    return playEmptyHandWhiff(hero)
  }
  return false
}

function performNearestContextAction(hero: UnitEntity): ToolActionResult {
  for (const config of HERO_CONTEXT_ACTIONS) {
    const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, config.matches, TOOL_ACTION_RANGE)
    const closest = getClosestInstanceWithPath<RuntimeEntity, RuntimeCell>(hero, candidates)
    if (closest) {
      const action = config.resolve(hero, closest.instance)
      if (action && isContextActionTargetReachable(hero, config.action, closest.instance)) {
        const unitAction = getContextActionForTarget(config.action, closest.instance)
        if (!unitAction) return 'blocked'
        return runContextAction(hero, config.action, unitAction, action) ? 'triggered' : 'blocked'
      }
      return 'blocked'
    }
  }
  if (tryDeliver(hero)) return 'triggered'
  return 'miss'
}

export function performContextAction(hero: UnitEntity): boolean {
  return performNearestContextAction(hero) === 'triggered'
}

export function triggerEquippedItemAction(hero: UnitEntity, tool: HeroEquippedItem | null): boolean {
  if (tool === 'sword' || tool === 'halberd') {
    const meleeTarget = findHeroMeleeTargetInAim(hero, tool)
    if (meleeTarget && strikeHeroMeleeTarget(hero, meleeTarget, tool)) return true
    return playMeleeWeaponWhiff(hero)
  }
  if (tool === 'interact') {
    const actionResult = performNearestContextAction(hero)
    if (actionResult === 'triggered') return true
    if (actionResult === 'miss') {
      return playEmptyHandWhiff(hero)
    }
    return false
  }
  if (tool === 'bow') {
    fireBlindArrow(hero)
    return true
  }
  return false
}

export const triggerToolAttackAt = triggerEquippedItemActionAt
export const triggerToolAction = triggerEquippedItemAction
