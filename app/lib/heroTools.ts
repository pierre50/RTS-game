import { Assets, Graphics } from 'pixi.js'
import {
  ACTION_TYPES,
  CELL_HEIGHT,
  CELL_WIDTH,
  FAMILY_TYPES,
  LOADING_TYPES,
  MINING_RESOURCE_CONFIG,
  SHEET_TYPES,
  SOUND_CUES,
  WORK_TYPES,
} from '../constants'
import { getHeroInteractionTargetPoint, isHeroActionInRange, isHeroInteractionTargetReachable } from './heroActionRange'
import { getActionCondition, isWheatMature, type CombatEntity } from './combat'
import { applyCombatHit } from './combatHit'
import { showParryFeedback } from './combatFeedback'
import { applyDiplomaticAggression, canTriggerDiplomaticAggression } from './diplomaticAggression'
import {
  getEquipmentCombatStats,
  getUnitCombatRange,
  getUnitWorkEquipment,
  refreshUnitEquipmentStats,
  UNARMED_UNIT_WEAPON_POWER,
} from './equipmentStats'
import { applyUnitWorkAssets } from './unitWorkAppearance'
import { consumeHeroEquippedItem } from './equipmentLoot'
import { findInstancesInSight } from './grid/visibility'
import { getClosestInstanceWithPath } from './grid/queries'
import { BOW_SHOOT_RELEASE_FRAME, LASSO_SHOOT_RELEASE_FRAME, onSpriteLoopAtFrame, SLASH_IMPACT_FRAME } from './graphics'
import { t } from './lang'
import { angleDelta, degreeToDirection, getReliefOffset, instancesDistance } from './maths'
import { playAudibleSoundCue, playSoundCue } from './sound'
import { getCombatXpBonus, XP_CATEGORIES } from './unitExperience'
import { logHeroSlashFrame, playReverseSlashRecovery } from './slashRecoveryAnimation'
import { buildingAcceptsCarriedResources, getCarriedResourceSpace, getTotalCarriedResources } from './resourceCarry'
import { applyBakedLpcUnitAssets } from './lpc/baked'
import {
  drainEnergyAmount,
  ensureUnitEnergy,
  getActionEnergyCost,
  hasEnergyForAction,
  spendEnergyForAction,
} from './unitEnergy'
import { Projectile } from '../classes/Projectile'
import { HeroLassoThrow } from '../classes/HeroLassoThrow'
import { applyWorkForAction } from '../classes/unit/UnitCommands'
import type { BuildingEntity, CommandSound, RuntimeEntity, UnitEntity } from '../types/entities'
import type { RuntimeCell } from '../types/map'
import type { Point } from '../types/grid'
import type { DynamicEquipmentKey } from './lpc/equipment'
import { getBuildingContactDistance } from './grid/cells'

export type HeroCivilTool = 'axe' | 'pickaxe' | 'hammer'
export type HeroContextAction = 'chop' | 'mine' | 'build' | 'gather' | 'pickup' | 'interact'
export type HeroEquippedItem = 'interact' | 'sword' | 'bow' | 'lasso'
type HeroPowerChargeTool = 'bow' | 'lasso' | 'sword'
export const HERO_EQUIPPED_ITEM_ORDER: HeroEquippedItem[] = ['interact', 'sword', 'bow', 'lasso']
export const HERO_TOOL_ORDER = HERO_EQUIPPED_ITEM_ORDER

function isEquipmentKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0
}

const TOOL_ACTION_RANGE = 3
const HERO_POWER_CHARGE_ENERGY_ACTION = 'heroPowerCharge'
const HERO_DEFENSE_ENERGY_ACTION = 'heroDefense'
const HERO_WHIFF_ENERGY_ACTION = 'heroWhiff'
const HERO_PARRY_SOUND_CUES = SOUND_CUES.unit.swordAttack
const HERO_POWER_CHARGE_MS = 700
const HERO_BOW_MIN_POWER = 0.2
const HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS = 0.5
const HERO_SWORD_CHARGE_HOLD_FRAME = 0
const HERO_SWORD_POWER_FLASH_MS = 180
const HERO_DEFENSE_HOLD_FRAME = 2
const HERO_DEFENSE_REVERSE_FRAME_MS = 45
const HERO_DEFENSE_RELEASE_FALLBACK_MS = 260
const HERO_DEFENSE_FLASH_MS = 120
const HERO_DEFENSE_SPARK_MS = 180
const HERO_DEFENSE_SPARK_STEP_MS = 30
const BLIND_SHOT_DISTANCE = 200
const CLICK_TARGET_SEARCH_RANGE = 15
const CLICK_DIRECTION_HALF_ANGLE = 25
const LARGE_FOOTPRINT_DIRECTION_HALF_ANGLE = 45
const HERO_MELEE_STRIKE_HALF_ANGLE = 45
const HERO_MELEE_DISTANCE_TOLERANCE = 0.9
const DIRECTIONAL_TARGET_MAX_ANGLE_PENALTY = CELL_WIDTH
const MOUNTED_ATTACK_HALF_ANGLE = 45
const HERO_ARROW_FORWARD_OFFSET = 16
const HERO_ARROW_HEIGHT_OFFSET = 18
const HERO_ARROW_DIRECTION_OFFSETS: Record<string, Partial<Point>> = {
  east: { y: -8 },
  south: { x: 4 },
  west: { y: 8 },
  north: { x: -4 },
  northwest: { y: 4 },
  southwest: { y: 4 },
}
const HERO_ARROW_CELL_DISTANCE = Math.hypot(CELL_WIDTH, CELL_HEIGHT)
const HERO_AIM_Y_SCALE = CELL_HEIGHT / CELL_WIDTH

function getHeroBowRange(hero: UnitEntity): number {
  return getUnitCombatRange(hero) ?? 0
}

function getHeroMaxArrowDistance(hero: UnitEntity, power = 1): number {
  const rangePower = Math.max(HERO_BOW_MIN_POWER, Math.min(1, power))
  const baseRange = getHeroBowRange(hero)
  const maxDistance = baseRange * HERO_ARROW_CELL_DISTANCE * rangePower
  console.debug('[hero-bow-range]', {
    unitLabel: hero.label,
    work: hero.work,
    ownerAge: hero.owner?.age ?? 0,
    baseRange,
    rangePower: Number(rangePower.toFixed(2)),
    maxDistance: Number(maxDistance.toFixed(2)),
  })
  return maxDistance
}

function getHeroShootReleaseFrame(tool: 'bow' | 'lasso' | null | undefined): number {
  return tool === 'lasso' ? LASSO_SHOOT_RELEASE_FRAME : BOW_SHOOT_RELEASE_FRAME
}

function getHeroShootHoldFrame(tool: 'bow' | 'lasso' | null | undefined): number {
  return tool === 'lasso' ? Math.max(0, LASSO_SHOOT_RELEASE_FRAME - 1) : BOW_SHOOT_RELEASE_FRAME
}

function getHeroPowerChargeHoldFrame(tool: HeroPowerChargeTool | null | undefined): number {
  return tool === 'sword' ? HERO_SWORD_CHARGE_HOLD_FRAME : getHeroShootHoldFrame(tool)
}

function getHeroSwordChargeDamageMultiplier(power: number): number {
  const clampedPower = Math.max(0, Math.min(1, power))
  return 1 + clampedPower * HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS
}

function hideReleasedBowArrowLayer(hero: UnitEntity, sprite: UnitEntity['sprite']): void {
  if (!sprite || sprite.currentFrame < BOW_SHOOT_RELEASE_FRAME) return
  const nextFrame = Math.min(Math.floor(sprite.currentFrame) + 1, Math.max(0, sprite.textures.length - 1))
  sprite.gotoAndStop?.(nextFrame)
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function getHeroAimDegree(hero: Point, destination: Point): number {
  const dx = destination.x - hero.x
  const dy = (destination.y - hero.y) * HERO_AIM_Y_SCALE
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 180)
}

const EQUIPPED_ITEM_WORK: Record<HeroEquippedItem, string> = {
  interact: WORK_TYPES.attacker,
  sword: 'heroSword',
  bow: WORK_TYPES.hunter,
  lasso: WORK_TYPES.attacker,
}

// Mirrors the base equipment attached to each work above (see VILLAGER_WORK_EQUIPMENT
// in lpc/equipment.ts: heroSword→age-scaled sword, hunter→bow) — used to render
// an icon for the inventory tool slots. No entry for 'interact': bare hands.
export const EQUIPPED_ITEM_WEAPON: Partial<Record<HeroEquippedItem, DynamicEquipmentKey>> = {
  sword: 'sword_ceramic',
  bow: 'bow',
}

export function getEquippedItemWeapon(
  tool: HeroEquippedItem,
  age = 0,
  hero?: UnitEntity | null
): string | undefined {
  void age
  if (tool === 'sword') return hero?.inventory?.activeWeapons?.melee
  if (tool === 'bow') return hero?.inventory?.activeWeapons?.ranged
  if (tool === 'lasso') return hero?.inventory?.activeWeapons?.lasso
  return EQUIPPED_ITEM_WEAPON[tool]
}

export function isHeroToolAvailable(hero: UnitEntity | null | undefined, tool: HeroEquippedItem | null | undefined): boolean {
  if (!tool || tool === 'interact') return true
  return Boolean(getEquippedItemWeapon(tool, hero?.owner?.age ?? 0, hero))
}

function getHeroToolEquipment(hero: UnitEntity, tool: HeroEquippedItem): string[] {
  const fallback = getUnitWorkEquipment(EQUIPPED_ITEM_WORK[tool], hero.owner?.age)
  const activeWeapons = hero.inventory?.activeWeapons ?? {}
  if (tool === 'sword') {
    return [
      activeWeapons.melee,
      hero.inventory?.equipped?.offhand,
      activeWeapons.offhand,
    ].filter(isEquipmentKey)
  }
  if (tool === 'bow') {
    return [activeWeapons.ranged, activeWeapons.quiver, hero.inventory?.equipped?.arrow].filter(isEquipmentKey)
  }
  if (tool === 'lasso') return [activeWeapons.lasso].filter(isEquipmentKey)
  return fallback
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
type HeroLayerFlashState = {
  alpha?: number
  blendMode?: unknown
  tint?: number | string
  token: number
}
type ParryEffectHost = UnitEntity & {
  addChild?: (child: Graphics) => Graphics
}
const heroLayerFlashStates = new WeakMap<FlashableLayer, HeroLayerFlashState>()

function flashHeroLayers(
  hero: UnitEntity,
  targets: FlashableLayer[],
  {
    alpha,
    blendMode,
    durationMs,
    taskLabel,
    tint,
  }: { alpha: number; blendMode: unknown; durationMs: number; taskLabel: string; tint: number }
): void {
  if (!targets.length) return
  const states = targets.map(target => {
    const previous = heroLayerFlashStates.get(target)
    const state = {
      target,
      alpha: previous?.alpha ?? target.alpha,
      blendMode: previous?.blendMode ?? target.blendMode,
      tint: previous?.tint ?? target.tint,
      token: (previous?.token ?? 0) + 1,
    }
    heroLayerFlashStates.set(target, state)
    return state
  })
  for (const target of targets) {
    target.tint = tint
    target.alpha = alpha
    target.blendMode = blendMode
  }
  hero.context?.scheduler?.addOneShot(
    () => {
      for (const state of states) {
        if (heroLayerFlashStates.get(state.target)?.token !== state.token) continue
        state.target.tint = state.tint
        state.target.alpha = state.alpha
        state.target.blendMode = state.blendMode
        heroLayerFlashStates.delete(state.target)
      }
    },
    durationMs,
    taskLabel
  )
}

function resourceKind(target: RuntimeEntity): string | undefined {
  return target.category || target.type
}

export function buildingAcceptsCarriedResource(hero: UnitEntity, target: RuntimeEntity): target is BuildingEntity {
  return buildingAcceptsCarriedResources(hero, target)
}

type HeroContextActionConfig = {
  action: HeroContextAction
  matches: (target: RuntimeEntity) => boolean
  resolve: (hero: UnitEntity, target: RuntimeEntity) => (() => void) | null
}
type MiningHeroConfig = {
  action: string
  loadingType: string
  work: string
}

function getMiningResourceConfigMap(): Record<string, MiningHeroConfig> {
  const configured = MINING_RESOURCE_CONFIG ?? {}
  if (Object.keys(configured).length) return configured
  return {
    Stone: { action: ACTION_TYPES.minestone, loadingType: LOADING_TYPES.stone, work: WORK_TYPES.stoneminer },
    Gold: { action: ACTION_TYPES.minegold, loadingType: LOADING_TYPES.gold, work: WORK_TYPES.goldminer },
  }
}

function getMiningResourceConfig(target: RuntimeEntity): MiningHeroConfig | undefined {
  return getMiningResourceConfigMap()[resourceKind(target) ?? '']
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
  hero.degree = getHeroAimDegree(hero, target)
  hero.getAction?.(action)
}

function refreshHeroActionSheet(hero: UnitEntity, work: string, action: string): void {
  const actionSheet = action === ACTION_TYPES.takemeat ? SHEET_TYPES.harvest : SHEET_TYPES.action
  const asset = hero.allAssets?.[work]?.[actionSheet]
  if (!asset) return
  const sheet = Assets.cache.get(asset)
  if (sheet) hero.actionSheet = sheet
}

// Same as runHeroAction, but also runs the work/texture bookkeeping commonSendTo would
// have applied for a gather-type action. The hero keeps carried resources by type, so
// switching from one gather work to another never discards cargo.
function runHeroGatherAction(hero: UnitEntity, target: RuntimeEntity, action: string, work: string): void {
  if (hero.actionLocked) return
  applyWorkForAction(hero, work, action)
  refreshHeroActionSheet(hero, work, action)
  runHeroAction(hero, target, action)
}

function getLoadingTypeForAction(action: string): string | null {
  const miningConfig = Object.values(getMiningResourceConfigMap()).find(config => config.action === action)
  if (miningConfig) return miningConfig.loadingType
  switch (action) {
    case ACTION_TYPES.chopwood:
      return LOADING_TYPES.wood
    case ACTION_TYPES.forageberry:
      return LOADING_TYPES.berry
    case ACTION_TYPES.takemeat:
      return LOADING_TYPES.meat
    case ACTION_TYPES.farm:
      return LOADING_TYPES.wheat
    default:
      return null
  }
}

function heroHasGatherSpace(hero: UnitEntity, action: string): boolean {
  const loadingType = getLoadingTypeForAction(action)
  if (!loadingType) return true
  return getCarriedResourceSpace(hero, loadingType) > 0
}

function canShowTargetAlert(hero: UnitEntity, target: RuntimeEntity): boolean {
  return Boolean(hero.owner?.isPlayed && (hero.context?.controls?.instanceInCamera?.(target) ?? true))
}

function resolveHeroGatherAction(
  hero: UnitEntity,
  target: RuntimeEntity,
  action: string,
  work: string
): (() => void) | null {
  if (!getActionCondition(hero, target, action)) {
    if (
      action === ACTION_TYPES.farm &&
      resourceKind(target) === 'Wheat' &&
      !isWheatMature(target) &&
      canShowTargetAlert(hero, target)
    ) {
      hero.context?.menu?.showMessage(t('wheatNotReady'), 'warning')
    }
    return null
  }
  if (!heroHasGatherSpace(hero, action)) {
    hero.context?.menu?.showMessage(t('heroInventoryFull'), 'warning')
    return null
  }
  return () => runHeroGatherAction(hero, target, action, work)
}

const HERO_CONTEXT_ACTIONS: HeroContextActionConfig[] = [
  {
    action: 'gather',
    matches: target =>
      resourceKind(target) === 'Berrybush' ||
      resourceKind(target) === 'Wheat' ||
      (target.family === FAMILY_TYPES.animal && Boolean(target.isDead)),
    resolve: (hero, target) => {
      if (resourceKind(target) === 'Wheat') {
        return resolveHeroGatherAction(hero, target, ACTION_TYPES.farm, WORK_TYPES.farmer)
      }
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
    matches: target => Boolean(getMiningResourceConfig(target)),
    resolve: (hero, target) => {
      const config = getMiningResourceConfig(target)
      return config ? resolveHeroGatherAction(hero, target, config.action, config.work) : null
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
]

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
    applyBakedLpcUnitAssets(hero)
    refreshUnitEquipmentStats(hero)
    hero.syncAppearanceLayers?.(hero.currentSheet ?? SHEET_TYPES.standing)
    return
  }
  hero.work = work
  applyBakedLpcUnitAssets(hero)
  applyUnitWorkAssets(hero, work, { loading: getTotalCarriedResources(hero) > 0, refreshEquipmentStats: true })
  hero.setTextures?.(hero.sprite?.playing ? SHEET_TYPES.walking : SHEET_TYPES.standing)
}

export const applyToolAppearance = applyEquippedItemAppearance

type HeroToolAnimationOptions = {
  recoveryAnimation?: 'reverseSlash'
  swordChargePower?: number
}

type HeroMeleeAttackOptions = {
  damageMultiplier?: number
  impactFrame?: number
  swordChargePower?: number
}

type SwordPowerFlashHost = UnitEntity & {
  appearance?: { layers?: Array<{ equipmentKey?: string }> }
  appearanceLayerSprites?: Map<number, FlashableLayer>
}

function getHeroSwordPowerFlashLayers(hero: UnitEntity): FlashableLayer[] {
  const host = hero as SwordPowerFlashHost
  const sprites = host.appearanceLayerSprites
  if (!sprites) return []
  return (host.appearance?.layers ?? [])
    .map((layer, index) => (layer.equipmentKey?.startsWith('sword_') ? sprites.get(index) : null))
    .filter((layer): layer is FlashableLayer => Boolean(layer && layer.visible !== false))
}

function showHeroSwordPowerFlash(hero: UnitEntity, power: number | undefined): void {
  const clampedPower = Math.max(0, Math.min(1, power ?? 0))
  if (clampedPower <= 0) return
  const targets = getHeroSwordPowerFlashLayers(hero)
  const tint = clampedPower >= 0.66 ? 0xfff06a : 0xffc857
  flashHeroLayers(hero, targets, {
    alpha: Math.min(1, 0.72 + clampedPower * 0.28),
    blendMode: 'add',
    durationMs: HERO_SWORD_POWER_FLASH_MS,
    taskLabel: 'hero.swordPowerFlash',
    tint,
  })
}

function playHeroToolAnimation(
  hero: UnitEntity,
  onImpact?: () => void,
  impactFrame: number | null = null,
  options: HeroToolAnimationOptions = {}
): void {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return

  hero.actionLocked = true
  sprite.loop = false
  const finishAnimation = () => finishHeroToolAnimation(hero)
  hero.setTextures?.(SHEET_TYPES.action)
  hero.syncMountedHorseSprite?.()
  showHeroSwordPowerFlash(hero, options.swordChargePower)
  logHeroSlashFrame(hero, 'tool:start', { impactFrame, recoveryAnimation: options.recoveryAnimation ?? null })
  sprite.gotoAndPlay(0)
  logHeroSlashFrame(hero, 'tool:gotoAndPlay:0')
  hero.syncShadow?.()

  sprite.onComplete = finishAnimation

  if (!onImpact) return
  if (impactFrame == null) {
    onImpact()
    return
  }
  onSpriteLoopAtFrame(sprite, impactFrame, () => {
    logHeroSlashFrame(hero, 'tool:impact', { impactFrame })
    onImpact()
    if (options.recoveryAnimation !== 'reverseSlash') return
    const handled = playReverseSlashRecovery(hero, {
      onComplete: finishAnimation,
      releaseFrame: impactFrame,
      stopFrame: impactFrame - 1,
    })
    if (!handled) return
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
  })
}

function finishHeroToolAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  logHeroSlashFrame(hero, 'tool:finish:start')
  if (hero.attackRecoveryAnimationTaskId != null) {
    hero.context?.scheduler?.remove?.(hero.attackRecoveryAnimationTaskId)
    hero.attackRecoveryAnimationTaskId = null
  }
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  hero.actionLocked = false
  hero.contextAction = null
  const hadPendingOrder = hero.flushPendingOrder?.()
  if (!hadPendingOrder && !hero.isDead) hero.setTextures?.(SHEET_TYPES.standing)
  logHeroSlashFrame(hero, 'tool:finish:end', { hadPendingOrder: Boolean(hadPendingOrder) })
  hero.syncShadow?.()
}

export function canDeliverToBuilding(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (getTotalCarriedResources(hero) <= 0) return false
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
  if (getTotalCarriedResources(hero) <= 0) return false
  if (!buildingAcceptsCarriedResource(hero, target)) return false
  return getActionCondition(hero, target, ACTION_TYPES.delivery, { buildingTypes: [target.type] })
}

function getAimDelta(hero: UnitEntity, target: Point): number {
  return angleDelta(getHeroAimDegree(hero, target), hero.degree ?? 0)
}

// A mounted hero can't snap-turn the horse to face an attack the way an unmounted hero can, so
// any click outside a frontal cone around the horse's current heading is ignored (no turn, no
// swing/shot) until the player physically re-orients the horse via movement.
export function isMountedAttackAimBlocked(hero: UnitEntity, point: Point): boolean {
  if (!hero.mountedOnHorse) return false
  return angleDelta(getHeroAimDegree(hero, point), hero.degree ?? 0) > MOUNTED_ATTACK_HALF_ANGLE
}

function getDirectionalTarget<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T | null {
  return getDirectionalTargets(hero, candidates, halfAngle)[0] ?? null
}

// Whatever the hero is currently facing, within the same aim cone every other hands-on hero
// action (gather/chop/mine/build/melee) already resolves against — used to make key-triggered
// interactions (e.g. hero entity inspection) direction-based instead of mouse-position-based.
export function findFacingEntity(
  hero: UnitEntity,
  matches: (target: RuntimeEntity) => boolean,
  range = CLICK_TARGET_SEARCH_RANGE
): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(hero, matches, range)
  const seen = new Set<RuntimeEntity>(candidates)
  const grid = hero.context?.map?.grid
  if (grid) {
    const centerI = hero.i ?? 0
    const centerJ = hero.j ?? 0
    const scanRadius = Math.ceil(range)
    const rangeSq = range * range
    for (let i = centerI - scanRadius; i <= centerI + scanRadius; i++) {
      const row = grid[i]
      if (!row) continue
      for (let j = centerJ - scanRadius; j <= centerJ + scanRadius; j++) {
        const cell = row[j]
        if (!cell) continue
        const di = i - centerI
        const dj = j - centerJ
        if (di * di + dj * dj > rangeSq) continue
        for (const corpse of cell.corpses ?? []) {
          if (!seen.has(corpse) && matches(corpse)) {
            candidates.push(corpse)
            seen.add(corpse)
          }
        }
      }
    }
  }
  return getDirectionalTarget(hero, candidates)
}

function getDirectionalTargets<T extends RuntimeEntity>(
  hero: UnitEntity,
  candidates: T[],
  halfAngle = CLICK_DIRECTION_HALF_ANGLE
): T[] {
  return candidates
    .map(target => {
      const aimPoint = getHeroInteractionTargetPoint(hero, target)
      const targetHalfAngle = [FAMILY_TYPES.building, FAMILY_TYPES.resource].includes(target.family ?? '')
        ? LARGE_FOOTPRINT_DIRECTION_HALF_ANGLE
        : halfAngle
      return {
        target,
        angle: getAimDelta(hero, aimPoint),
        dist: Math.hypot(aimPoint.x - hero.x, aimPoint.y - hero.y),
        halfAngle: targetHalfAngle,
      }
    })
    .filter(candidate => candidate.angle <= candidate.halfAngle)
    .map(candidate => ({
      ...candidate,
      score:
        candidate.dist + (candidate.angle / Math.max(candidate.halfAngle, 1)) * DIRECTIONAL_TARGET_MAX_ANGLE_PENALTY,
    }))
    .sort((a, b) => a.score - b.score || a.dist - b.dist || a.angle - b.angle)
    .map(candidate => candidate.target)
}

function isHeroMeleeTargetInRange(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (isHeroActionInRange(hero, ACTION_TYPES.attack, target)) return true
  const targetSize = Math.max(1, target.size ?? target.selectionFactor ?? 1)
  const range = getBuildingContactDistance(targetSize) + HERO_MELEE_DISTANCE_TOLERANCE
  return instancesDistance(hero, target) <= range
}

function isHeroMeleeTargetInAttackZone(hero: UnitEntity, target: RuntimeEntity): boolean {
  const aimPoint = getHeroInteractionTargetPoint(hero, target)
  if (getAimDelta(hero, aimPoint) > HERO_MELEE_STRIKE_HALF_ANGLE) return false
  return isHeroMeleeTargetInRange(hero, target)
}

function tryDeliver(hero: UnitEntity): boolean {
  if (getTotalCarriedResources(hero) <= 0) return false
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
  if (getTotalCarriedResources(hero) <= 0) return 'none'
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canAimDeliveryAtBuilding(hero, target),
    CLICK_TARGET_SEARCH_RANGE
  )

  const target = getDirectionalTarget(hero, candidates)
  if (!target) return 'none'
  return deliverToBuilding(hero, target) ? 'delivered' : 'blocked'
}

function getHeroWeaponDamage(hero: UnitEntity, tool: HeroEquippedItem): number {
  const stats = getEquipmentCombatStats(getHeroToolEquipment(hero, tool))
  return stats.weaponPower || (tool === 'interact' ? UNARMED_UNIT_WEAPON_POWER : 0)
}

function getHeroWeaponCombatSource(hero: UnitEntity, tool: HeroEquippedItem): CombatEntity {
  return {
    ...hero,
    equipment: getHeroToolEquipment(hero, tool),
  }
}

function canBeHeroMeleeTarget(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): boolean {
  if (
    target === hero ||
    ![FAMILY_TYPES.building, FAMILY_TYPES.unit, FAMILY_TYPES.animal, FAMILY_TYPES.resource].includes(
      target.family ?? ''
    ) ||
    target.isDead ||
    target.isDestroyed
  ) {
    return false
  }
  const combatSource = getHeroWeaponCombatSource(hero, tool)
  return getActionCondition(combatSource, target, ACTION_TYPES.attack) || canTriggerDiplomaticAggression(hero, target)
}

function findHeroMeleeTargetInAim(hero: UnitEntity, tool: HeroEquippedItem): RuntimeEntity | null {
  const candidates = findInstancesInSight<UnitEntity, RuntimeEntity>(
    hero,
    target => canBeHeroMeleeTarget(hero, target, tool),
    CLICK_TARGET_SEARCH_RANGE
  )
  return getDirectionalTarget(hero, candidates, HERO_MELEE_STRIKE_HALF_ANGLE)
}

function getContextActionForTarget(contextAction: HeroContextAction, target: RuntimeEntity): string | null {
  if (contextAction === 'gather' && resourceKind(target) === 'Wheat') return ACTION_TYPES.farm
  if (contextAction === 'gather' && resourceKind(target) === 'Berrybush') return ACTION_TYPES.forageberry
  if (contextAction === 'gather' && target.family === FAMILY_TYPES.animal && target.isDead) return ACTION_TYPES.takemeat
  if (contextAction === 'chop' && resourceKind(target) === 'Tree') return ACTION_TYPES.chopwood
  if (contextAction === 'mine') {
    return getMiningResourceConfig(target)?.action ?? null
  }
  if (contextAction === 'build' && target.family === FAMILY_TYPES.building) return ACTION_TYPES.build
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
  return isHeroInteractionTargetReachable(hero, action, target) || Boolean(hero.isUnitAtDest?.(action, target))
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

function hasHeroEquippedArrow(hero: UnitEntity): boolean {
  return Boolean(hero.inventory?.equipped?.arrow)
}

function warnHeroNoArrowEquipped(hero: UnitEntity): void {
  if (hero.owner?.isPlayed) hero.context?.menu?.showMessage(t('heroNoArrowsEquipped'), 'warning')
}

function consumeHeroArrow(hero: UnitEntity): void {
  consumeHeroEquippedItem(hero, 'arrow')
  hero.context?.menu?.refreshInventory?.()
}

function getHeroArrowVisualY(hero: UnitEntity): number {
  const mountedRiderY = hero.getMountedRiderY?.()
  return typeof mountedRiderY === 'number' && Number.isFinite(mountedRiderY) ? mountedRiderY : getReliefOffset(hero)
}

function getHeroArrowSpawnPoint(hero: UnitEntity): Point {
  const rad = ((hero.degree ?? 0) - 180) * (Math.PI / 180)
  const direction = degreeToDirection(hero.degree ?? 0)
  const directionOffset = direction ? (HERO_ARROW_DIRECTION_OFFSETS[direction] ?? {}) : {}
  return {
    x: hero.x + Math.cos(rad) * HERO_ARROW_FORWARD_OFFSET + (directionOffset.x ?? 0),
    y: hero.y + getHeroArrowVisualY(hero) - HERO_ARROW_HEIGHT_OFFSET + (directionOffset.y ?? 0),
  }
}

function fireArrowAt(hero: UnitEntity, destination: Point, target?: RuntimeEntity | null, power = 1): void {
  const map = hero.context?.map
  if (!map) return
  playHeroToolAnimation(
    hero,
    () => {
      if (!hasHeroEquippedArrow(hero)) {
        warnHeroNoArrowEquipped(hero)
        return
      }
      const projectile = new Projectile(
        {
          owner: hero,
          type: 'Arrow',
          target: target ?? undefined,
          destination,
          spawnPoint: getHeroArrowSpawnPoint(hero),
          weaponPower: getHeroWeaponDamage(hero, 'bow'),
          maxDistance: getHeroMaxArrowDistance(hero, power),
        },
        hero.context!
      )
      map.addChild(projectile)
      consumeHeroArrow(hero)
    },
    BOW_SHOOT_RELEASE_FRAME
  )
}

function throwLassoAt(hero: UnitEntity, destination: Point, power = 1): void {
  const map = hero.context?.map
  if (!map || !hero.context) return
  const rangePower = Math.max(HERO_BOW_MIN_POWER, Math.min(1, power))
  const origin = getHeroArrowSpawnPoint(hero)
  const maxDestination = {
    x: origin.x + (destination.x - origin.x) * rangePower,
    y: origin.y + (destination.y - origin.y) * rangePower,
  }
  playSoundCue(SOUND_CUES.projectile.arrowLaunch)
  const lasso = new HeroLassoThrow(hero, maxDestination, hero.context)
  map.addChild(lasso)
}

function getHeroPowerChargeRatio(hero: UnitEntity, now = performance.now()): number {
  if (hero.heroPowerChargeStart == null) return 0
  return Math.max(0, Math.min(1, (now - hero.heroPowerChargeStart) / HERO_POWER_CHARGE_MS))
}

function hasEnergyToStartPowerCharge(hero: UnitEntity): boolean {
  return hasEnergyToStartTimedHeroAction(hero, HERO_POWER_CHARGE_ENERGY_ACTION)
}

function drainHeroPowerChargeEnergy(hero: UnitEntity, now = performance.now()): boolean {
  return drainTimedHeroEnergy(
    hero,
    HERO_POWER_CHARGE_ENERGY_ACTION,
    hero.heroPowerChargeStart,
    hero.heroPowerChargeLastEnergyAt,
    value => (hero.heroPowerChargeLastEnergyAt = value),
    HERO_POWER_CHARGE_MS,
    now
  )
}

function freezeHeroPowerChargeFrame(hero: UnitEntity, frame?: number): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action) return
  const lastFrame = Math.max(0, sprite.textures.length - 1)
  const holdFrame = getHeroPowerChargeHoldFrame(hero.heroPowerChargeTool)
  hero.heroPowerChargeVisualLocked = true
  sprite.loop = false
  sprite.gotoAndStop(Math.max(0, Math.min(frame ?? holdFrame, lastFrame)))
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

function continueHeroPowerChargeAnimation(hero: UnitEntity): void {
  const sprite = hero.sprite
  if (!sprite || hero.currentSheet !== SHEET_TYPES.action || hero.heroPowerReleaseQueued) return
  if (hero.heroPowerChargeVisualLocked) {
    freezeHeroPowerChargeFrame(hero)
    return
  }
  const holdFrame = getHeroPowerChargeHoldFrame(hero.heroPowerChargeTool)
  sprite.loop = false
  sprite.onComplete = undefined
  onSpriteLoopAtFrame(sprite, holdFrame, () => freezeHeroPowerChargeFrame(hero))
  if (!sprite.playing && sprite.currentFrame < holdFrame) sprite.play()
  if (sprite.currentFrame >= holdFrame) freezeHeroPowerChargeFrame(hero)
  hero.syncShadow?.()
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
}

export function canHeroDefendWithTool(tool: HeroEquippedItem | null | undefined): boolean {
  return tool === 'sword'
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
    HERO_POWER_CHARGE_MS,
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
  flashHeroLayers(hero, targets, {
    alpha: 1,
    blendMode: 'add',
    durationMs: HERO_DEFENSE_FLASH_MS,
    taskLabel: 'hero.defenseFlash',
    tint: 0xfff06a,
  })
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
  hero.degree = getHeroAimDegree(hero, destination)
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

export function aimHeroPowerChargeAt(hero: UnitEntity, destination: Point): boolean {
  if (hero.heroPowerChargeStart == null || hero.heroPowerReleaseQueued) return false
  const aimDegree = getHeroAimDegree(hero, destination)
  if (
    hero.mountedOnHorse &&
    hero.heroPowerChargeFacingDegree != null &&
    angleDelta(aimDegree, hero.heroPowerChargeFacingDegree) > MOUNTED_ATTACK_HALF_ANGLE
  ) {
    return true
  }
  const previousDirection = degreeToDirection(hero.degree ?? 0)
  hero.degree = aimDegree
  hero.heroPowerChargeDestination = destination
  hero.heroPowerChargeTarget = null
  if (hero.currentSheet === SHEET_TYPES.action && degreeToDirection(hero.degree ?? 0) !== previousDirection) {
    hero.setTextures?.(SHEET_TYPES.action)
    if (hero.heroPowerChargeVisualLocked) freezeHeroPowerChargeFrame(hero)
    updateHeroPowerCharge(hero)
  }
  return true
}

export function isHeroPowerChargeActiveForTool(hero: UnitEntity, tool: HeroEquippedItem | null | undefined): boolean {
  return hero.heroPowerChargeStart != null && hero.heroPowerChargeTool === tool && !hero.heroPowerReleaseQueued
}

export function updateHeroPowerCharge(hero: UnitEntity, now = performance.now()): void {
  if (hero.heroPowerChargeStart == null) return
  if (hero.heroPowerReleaseQueued) return
  if (!drainHeroPowerChargeEnergy(hero, now)) {
    releaseHeroPowerCharge(hero)
    return
  }
  const ratio = getHeroPowerChargeRatio(hero, now)
  hero.heroPowerChargeRatio = ratio
  hero.drawHeroPowerBar?.(ratio)
  const sprite = hero.sprite
  if (hero.heroPowerChargeVisualLocked) {
    freezeHeroPowerChargeFrame(hero)
    return
  }
  if (sprite && hero.currentSheet === SHEET_TYPES.action) {
    continueHeroPowerChargeAnimation(hero)
  }
}

function clearHeroPowerCharge(hero: UnitEntity): void {
  hero.heroPowerChargeStart = null
  hero.heroPowerChargeRatio = undefined
  hero.heroPowerChargeDestination = null
  hero.heroPowerChargeTarget = null
  hero.heroPowerReleaseQueued = false
  hero.heroPowerReleasePower = undefined
  hero.heroPowerChargeFacingDegree = null
  hero.heroPowerChargeVisualLocked = false
  hero.heroPowerChargeLastEnergyAt = undefined
  hero.heroPowerChargeTool = undefined
  hero.removeHeroPowerBar?.()
}

export function cancelHeroPowerCharge(hero: UnitEntity): void {
  if (hero.heroPowerChargeStart == null) return
  const sprite = hero.sprite
  clearHeroPowerCharge(hero)
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  finishHeroToolAnimation(hero)
}

export function cancelHeroLasso(hero: UnitEntity): void {
  hero.heroLasso?.clearLasso({ releaseHorse: true })
}

function finishHeroSwordChargeAttack(hero: UnitEntity, destination: Point, power: number): boolean {
  const sprite = hero.sprite
  clearHeroPowerCharge(hero)
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  hero.actionLocked = false
  const triggered = triggerSwordAttackAt(hero, destination, {
    damageMultiplier: getHeroSwordChargeDamageMultiplier(power),
    impactFrame: SLASH_IMPACT_FRAME,
    swordChargePower: power,
  })
  if (!triggered) finishHeroToolAnimation(hero)
  return triggered
}

function finishHeroPowerChargeShot(hero: UnitEntity): void {
  const destination = hero.heroPowerChargeDestination
  if (!destination) {
    cancelHeroPowerCharge(hero)
    return
  }
  const power = hero.heroPowerReleasePower ?? getHeroPowerChargeRatio(hero)
  const target = hero.heroPowerChargeTarget ?? undefined
  const tool = hero.heroPowerChargeTool ?? 'bow'
  clearHeroPowerCharge(hero)
  const map = hero.context?.map
  const sprite = hero.sprite
  if (tool === 'lasso') {
    throwLassoAt(hero, destination, power)
  } else if (map) {
    if (!hasHeroEquippedArrow(hero)) {
      warnHeroNoArrowEquipped(hero)
    } else {
      const projectile = new Projectile(
        {
          owner: hero,
          type: 'Arrow',
          target,
          destination,
          spawnPoint: getHeroArrowSpawnPoint(hero),
          weaponPower: getHeroWeaponDamage(hero, 'bow'),
          maxDistance: getHeroMaxArrowDistance(hero, power),
        },
        hero.context!
      )
      map.addChild(projectile)
      consumeHeroArrow(hero)
    }
  }
  if (!sprite) {
    finishHeroToolAnimation(hero)
    return
  }
  if (tool === 'bow') {
    hideReleasedBowArrowLayer(hero, sprite)
  } else {
    hero.syncAppearanceLayers?.(SHEET_TYPES.action)
  }
  sprite.onFrameChange = undefined
  sprite.onComplete = () => finishHeroToolAnimation(hero)
  sprite.loop = false
  if (sprite.currentFrame >= sprite.textures.length - 1) finishHeroToolAnimation(hero)
  else sprite.play()
}

function beginHeroPowerChargeAt(
  hero: UnitEntity,
  destination: Point,
  target?: RuntimeEntity | null,
  tool: HeroPowerChargeTool = 'bow'
): boolean {
  const sprite = hero.sprite
  if (!sprite || hero.actionLocked) return false
  if (!hasEnergyToStartPowerCharge(hero)) return false
  hero.actionLocked = true
  const now = performance.now()
  hero.heroPowerChargeStart = now
  hero.heroPowerChargeRatio = 0
  hero.heroPowerChargeLastEnergyAt = now
  hero.heroPowerChargeDestination = destination
  hero.heroPowerChargeTarget = target ?? null
  hero.heroPowerChargeTool = tool
  hero.heroPowerReleaseQueued = false
  hero.heroPowerReleasePower = undefined
  hero.heroPowerChargeFacingDegree = hero.mountedOnHorse ? (hero.degree ?? null) : null
  hero.heroPowerChargeVisualLocked = false
  hero.setTextures?.(SHEET_TYPES.action)
  sprite.loop = false
  hero.syncAppearanceLayers?.(SHEET_TYPES.action)
  sprite.onComplete = undefined
  hero.syncShadow?.()
  hero.drawHeroPowerBar?.(0)
  if (tool === 'sword') {
    freezeHeroPowerChargeFrame(hero, HERO_SWORD_CHARGE_HOLD_FRAME)
  } else {
    onSpriteLoopAtFrame(sprite, getHeroShootHoldFrame(tool), () => freezeHeroPowerChargeFrame(hero))
  }
  return true
}

export function releaseHeroPowerCharge(hero: UnitEntity, now = performance.now()): boolean {
  if (hero.heroPowerChargeStart == null || hero.heroPowerReleaseQueued) return false
  drainHeroPowerChargeEnergy(hero, now)
  hero.heroPowerReleasePower = getHeroPowerChargeRatio(hero, now)
  hero.heroPowerChargeRatio = hero.heroPowerReleasePower
  hero.drawHeroPowerBar?.(hero.heroPowerReleasePower)
  if (hero.heroPowerChargeTool === 'sword') {
    const destination = hero.heroPowerChargeDestination
    if (!destination) {
      cancelHeroPowerCharge(hero)
      return false
    }
    return finishHeroSwordChargeAttack(hero, destination, hero.heroPowerReleasePower)
  }
  const sprite = hero.sprite
  const releaseFrame = getHeroShootReleaseFrame(hero.heroPowerChargeTool)
  hero.heroPowerReleaseQueued = true
  if (sprite && hero.currentSheet === SHEET_TYPES.action && sprite.currentFrame < releaseFrame) {
    sprite.loop = false
    sprite.onComplete = undefined
    onSpriteLoopAtFrame(sprite, releaseFrame, () => finishHeroPowerChargeShot(hero))
    if (!sprite.playing) sprite.play()
    return true
  }
  finishHeroPowerChargeShot(hero)
  return true
}

function playEmptyHandWhiff(hero: UnitEntity): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(hero, () => playSoundCue(SOUND_CUES.hero.meleeWhiff), SLASH_IMPACT_FRAME, {
    recoveryAnimation: 'reverseSlash',
  })
  return true
}

function playMeleeWeaponWhiff(hero: UnitEntity, options: HeroMeleeAttackOptions = {}): boolean {
  if (!spendHeroEnergy(hero, HERO_WHIFF_ENERGY_ACTION)) return false
  playHeroToolAnimation(hero, () => playSoundCue(SOUND_CUES.hero.meleeWhiff), options.impactFrame ?? SLASH_IMPACT_FRAME, {
    recoveryAnimation: 'reverseSlash',
    swordChargePower: options.swordChargePower,
  })
  return true
}

function getHeroMeleeDefaultDamage(hero: UnitEntity, tool: HeroEquippedItem, options: HeroMeleeAttackOptions): number {
  const damage = getHeroWeaponDamage(hero, tool)
  if (options.damageMultiplier == null) return damage
  return Math.max(0, Math.round(damage * options.damageMultiplier))
}

function hasAxeEquipment(equipment: readonly string[]): boolean {
  return equipment.some(item => item === 'axe' || item.startsWith('axe_'))
}

function getHeroMeleeImpactSound(hero: UnitEntity, target: RuntimeEntity, tool: HeroEquippedItem): CommandSound {
  if (tool === 'sword') return SOUND_CUES.unit.swordAttack
  if (target.family === FAMILY_TYPES.unit && hasAxeEquipment(getUnitWorkEquipment(hero.work, hero.owner?.age))) {
    return SOUND_CUES.unit.swordAttack
  }
  return hero.sounds?.hit
}

function strikeHeroMeleeTarget(
  hero: UnitEntity,
  target: RuntimeEntity,
  tool: HeroEquippedItem,
  options: HeroMeleeAttackOptions = {}
): ToolActionResult {
  const resolvedTarget = isHeroMeleeTargetInAttackZone(hero, target) ? target : findHeroMeleeTargetInAim(hero, tool)
  if (!resolvedTarget || !isHeroMeleeTargetInAttackZone(hero, resolvedTarget)) {
    return 'miss'
  }
  const openingAggression = applyDiplomaticAggression(hero, resolvedTarget)
  if (openingAggression.changed && !openingAggression.hostileNow) return 'triggered'
  if (!spendHeroEnergy(hero, ACTION_TYPES.attack)) return 'blocked'
  hero.action = ACTION_TYPES.attack
  hero.setDest?.(resolvedTarget)
  playHeroToolAnimation(
    hero,
    () => {
      const combatSource = getHeroWeaponCombatSource(hero, tool)
      if (!getActionCondition(combatSource, resolvedTarget, ACTION_TYPES.attack)) {
        if ((resolvedTarget.hitPoints ?? 0) <= 0) resolvedTarget.die?.()
        return
      }
      const { damageDealt } = applyCombatHit(combatSource, resolvedTarget, {
        attacker: hero,
        bonusDamage: getCombatXpBonus(hero, XP_CATEGORIES.melee),
        defaultDamage: getHeroMeleeDefaultDamage(hero, tool, options),
        isMelee: true,
        menu: hero.context?.menu,
        player: hero.context?.player,
        xpCategory: XP_CATEGORIES.melee,
        xpUnit: hero,
      })
      if (damageDealt > 0) {
        playAudibleSoundCue(hero, getHeroMeleeImpactSound(hero, resolvedTarget, tool))
      }
    },
    options.impactFrame ?? SLASH_IMPACT_FRAME,
    { recoveryAnimation: 'reverseSlash', swordChargePower: options.swordChargePower }
  )
  return 'triggered'
}

function triggerSwordAttackAt(
  hero: UnitEntity,
  destination?: Point | null,
  options: HeroMeleeAttackOptions = {}
): boolean {
  if (destination) hero.degree = getHeroAimDegree(hero, destination)
  const meleeTarget = findHeroMeleeTargetInAim(hero, 'sword')
  if (meleeTarget) {
    const meleeResult = strikeHeroMeleeTarget(hero, meleeTarget, 'sword', options)
    if (meleeResult === 'triggered') return true
    if (meleeResult === 'blocked') return false
  }
  return playMeleeWeaponWhiff(hero, options)
}

export function triggerEquippedItemActionAt(
  hero: UnitEntity,
  tool: HeroEquippedItem | null,
  destination: Point
): boolean {
  if (!tool || hero.actionLocked) return false
  if (!isHeroToolAvailable(hero, tool)) return false
  hero.degree = getHeroAimDegree(hero, destination)
  const deliveryResult = tryDeliverAt(hero)
  if (deliveryResult === 'delivered') return true
  if (tool === 'bow' || tool === 'lasso' || tool === 'sword') {
    return beginHeroPowerChargeAt(hero, destination, null, tool)
  }
  if (tool !== 'interact') return false
  if (deliveryResult === 'blocked') return false
  const actionResult = performContextActionAt(hero)
  if (actionResult === 'triggered') return true
  const meleeTarget = findHeroMeleeTargetInAim(hero, 'interact')
  if (meleeTarget) {
    const meleeResult = strikeHeroMeleeTarget(hero, meleeTarget, 'interact')
    if (meleeResult === 'triggered') return true
    if (meleeResult === 'blocked') return false
  }
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

export function triggerEquippedItemAction(hero: UnitEntity, tool: HeroEquippedItem | null): boolean {
  if (!isHeroToolAvailable(hero, tool)) return false
  if (tool === 'sword') {
    return triggerSwordAttackAt(hero)
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
  if (tool === 'lasso') return false
  return false
}

export const triggerToolAttackAt = triggerEquippedItemActionAt
export const triggerToolAction = triggerEquippedItemAction
