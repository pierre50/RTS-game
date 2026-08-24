import { Graphics } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, SHEET_TYPES, SOUND_CUES } from '../constants'
import { getHeroInteractionTargetPoint, isHeroActionInRange } from './heroActionRange'
import { getActionCondition, type CombatEntity } from './combat'
import { applyCombatHit } from './combatHit'
import { showParryFeedback } from './combatFeedback'
import { applyDiplomaticAggression, canTriggerDiplomaticAggression } from './diplomaticAggression'
import {
  getEquipmentCombatStats,
  getUnitWorkEquipment,
  UNARMED_UNIT_WEAPON_POWER,
} from './equipmentStats'
import { findInstancesInSight } from './grid/visibility'
import { onSpriteLoopAtFrame, SLASH_IMPACT_FRAME } from './graphics'
import { t } from './lang'
import { angleDelta, degreeToDirection, getReliefOffset, instancesDistance } from './maths'
import { playAudibleSoundCue, playSoundCue } from './sound'
import { getCombatXpBonus, XP_CATEGORIES } from './unitExperience'
import { logHeroSlashFrame, playReverseSlashRecovery } from './slashRecoveryAnimation'
import {
  drainEnergyAmount,
  ensureUnitEnergy,
  getActionEnergyCost,
  spendEnergyForAction,
} from './unitEnergy'
import { Projectile } from '../classes/Projectile'
import type { CommandSound, RuntimeEntity, UnitEntity } from '../types/entities'
import type { Point } from '../types/grid'
import { getBuildingContactDistance } from './grid/cells'
import { getHeroToolEquipment, isHeroToolAvailable, type HeroEquippedItem } from './heroToolEquipment'
import {
  CLICK_TARGET_SEARCH_RANGE,
  MOUNTED_ATTACK_HALF_ANGLE,
  getDirectionalTarget,
  getHeroAimDegree,
  getHeroAimDelta,
} from './heroTargeting'
import { performContextActionAt, tryDeliverAt } from './HeroContextActions'
import {
  consumeHeroArrow,
  getHeroArrowSpawnPoint,
  getHeroMaxArrowDistance,
  getHeroPowerChargeHoldFrame,
  getHeroShootReleaseFrame,
  hasHeroEquippedArrow,
  hideReleasedBowArrowLayer,
  throwLassoAt,
  warnHeroNoArrowEquipped,
} from './HeroProjectileTools'

export {
  applyToolAppearance,
  EQUIPPED_ITEM_WEAPON,
  getEquippedItemWeapon,
  isHeroToolAvailable,
  type HeroCivilTool,
  type HeroContextAction,
  type HeroEquippedItem,
  HERO_TOOL_ORDER,
} from './heroToolEquipment'
export { findFacingEntity, getHeroAimDegree, isMountedAttackAimBlocked } from './heroTargeting'

type HeroPowerChargeTool = 'bow' | 'lasso' | 'sword'

const HERO_POWER_CHARGE_ENERGY_ACTION = 'heroPowerCharge'
const HERO_DEFENSE_ENERGY_ACTION = 'heroDefense'
const HERO_WHIFF_ENERGY_ACTION = 'heroWhiff'
const HERO_PARRY_SOUND_CUES = SOUND_CUES.unit.swordAttack
const HERO_POWER_CHARGE_MS = 700
const HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS = 0.5
const HERO_SWORD_POWER_FLASH_MS = 180
const HERO_DEFENSE_HOLD_FRAME = 2
const HERO_DEFENSE_REVERSE_FRAME_MS = 45
const HERO_DEFENSE_RELEASE_FALLBACK_MS = 260
const HERO_DEFENSE_FLASH_MS = 120
const HERO_DEFENSE_SPARK_MS = 180
const HERO_DEFENSE_SPARK_STEP_MS = 30
const HERO_MELEE_STRIKE_HALF_ANGLE = 45
const HERO_MELEE_DISTANCE_TOLERANCE = 0.9
function getHeroSwordChargeDamageMultiplier(power: number): number {
  const clampedPower = Math.max(0, Math.min(1, power))
  return 1 + clampedPower * HERO_SWORD_FULL_CHARGE_DAMAGE_BONUS
}

type ToolActionResult = 'triggered' | 'blocked' | 'miss'
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

function isHeroMeleeTargetInRange(hero: UnitEntity, target: RuntimeEntity): boolean {
  if (isHeroActionInRange(hero, ACTION_TYPES.attack, target)) return true
  const targetSize = Math.max(1, target.size ?? target.selectionFactor ?? 1)
  const range = getBuildingContactDistance(targetSize) + HERO_MELEE_DISTANCE_TOLERANCE
  return instancesDistance(hero, target) <= range
}

function isHeroMeleeTargetInAttackZone(hero: UnitEntity, target: RuntimeEntity): boolean {
  const aimPoint = getHeroInteractionTargetPoint(hero, target)
  if (getHeroAimDelta(hero, aimPoint) > HERO_MELEE_STRIKE_HALF_ANGLE) return false
  return isHeroMeleeTargetInRange(hero, target)
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

function canHeroDefendWithTool(tool: HeroEquippedItem | null | undefined): boolean {
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

function showHeroDefenseFlash(hero: UnitEntity): void {
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
  const holdFrame = getHeroPowerChargeHoldFrame(tool)
  if (tool === 'sword') {
    freezeHeroPowerChargeFrame(hero, holdFrame)
  } else {
    onSpriteLoopAtFrame(sprite, holdFrame, () => freezeHeroPowerChargeFrame(hero))
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

export function triggerToolAttackAt(
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
