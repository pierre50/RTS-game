import { Graphics } from 'pixi.js'
import { SHEET_TYPES, SOUND_CUES } from '../constants'
import { showParryFeedback } from '../combat/combatFeedback'
import { onSpriteLoopAtFrame } from '../graphics'
import { t } from '../lang'
import { degreeToDirection, getReliefOffset } from '../maths'
import { playAudibleSoundCue } from '../audio/sound'
import { drainTimedHeroEnergy } from './heroEnergy'
import { finishHeroToolAnimation, flashHeroLayers, type FlashableLayer } from './heroToolAnimation'
import { getHeroAimDegree } from './heroTargeting'
import { hasEnergyForAction } from '../units/unitEnergy'
import type { UnitEntity } from '../../types/entities'
import type { Point } from '../../types/grid'
import type { HeroEquippedItem } from './heroToolEquipment'

const HERO_DEFENSE_ENERGY_ACTION = 'heroDefense'
const HERO_PARRY_SOUND_CUES = SOUND_CUES.unit.swordAttack
const HERO_POWER_CHARGE_MS = 700
const HERO_DEFENSE_HOLD_FRAME = 2
const HERO_DEFENSE_REVERSE_FRAME_MS = 45
const HERO_DEFENSE_RELEASE_FALLBACK_MS = 260
const HERO_DEFENSE_FLASH_MS = 120
const HERO_DEFENSE_SPARK_MS = 180
const HERO_DEFENSE_SPARK_STEP_MS = 30

type ParryEffectHost = UnitEntity & {
  addChild?: (child: Graphics) => Graphics
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

export function canHeroDefendWithTool(tool: HeroEquippedItem | null | undefined): boolean {
  return tool === 'sword'
}

function hasEnergyToStartDefense(hero: UnitEntity): boolean {
  return hasEnergyForAction(hero, HERO_DEFENSE_ENERGY_ACTION)
}

function drainHeroDefenseEnergy(hero: UnitEntity, now = performance.now()): boolean {
  if (!hero.heroDefenseActive) return true
  const hadEnergyForElapsedTime = drainTimedHeroEnergy(
    hero,
    HERO_DEFENSE_ENERGY_ACTION,
    hero.heroDefenseStart,
    hero.heroDefenseLastEnergyAt,
    value => (hero.heroDefenseLastEnergyAt = value),
    HERO_POWER_CHARGE_MS,
    now
  )
  return hadEnergyForElapsedTime && (hero.energy ?? 0) > 0
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
  playAudibleSoundCue(hero, HERO_PARRY_SOUND_CUES, { profile: 'combat' })
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
  if (hero.heroDefenseEnergyExhausted) return false
  if (!hasEnergyToStartDefense(hero)) {
    hero.heroDefenseEnergyExhausted = true
    return false
  }
  stopHeroDefenseReverse(hero)
  stopHeroDefenseReleaseFallback(hero)
  hero.actionLocked = true
  const now = performance.now()
  hero.heroDefenseStart = now
  hero.heroDefenseLastEnergyAt = now
  hero.heroDefenseActive = true
  hero.heroDefenseVisualLocked = false
  hero.heroDefenseEnergyExhausted = false
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
    cancelHeroDefense(hero, { energyExhausted: true, restoreStanding: false })
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

export function cancelHeroDefense(
  hero: UnitEntity,
  { energyExhausted = false, restoreStanding = true }: { energyExhausted?: boolean; restoreStanding?: boolean } = {}
): void {
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
  hero.heroDefenseEnergyExhausted = energyExhausted
  const sprite = hero.sprite
  if (sprite) {
    sprite.onComplete = undefined
    sprite.onFrameChange = undefined
    sprite.loop = true
  }
  finishHeroToolAnimation(hero, { restoreStanding })
}
