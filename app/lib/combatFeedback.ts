import { ColorMatrixFilter, Text } from 'pixi.js'
import { FAMILY_TYPES } from '../constants'
import { getReliefOffset } from './maths'
import type { RuntimeEntity } from '../types/entities'
import type { SchedulerTaskId } from '../types/context'
import type { AnimatedSprite, Container, Filter, Sprite } from 'pixi.js'

type DamageSprite = Sprite | AnimatedSprite
type FlashState = {
  filters: readonly Filter[] | null
  token: number
}
type FloatingTextOptions = {
  text: string
  fill: number
  stroke: number
  taskLabel: string
  fontSize?: number
  yOffset?: number
}

const FLASH_MS = 90
const FLOAT_STEP_MS = 35
const FLOAT_STEPS = 14
const FLOAT_RISE = 18
const FATIGUE_FEEDBACK_COOLDOWN_MS = 1200
const ALERT_FEEDBACK_COOLDOWN_MS = 1200
const EMOTE_FEEDBACK_COOLDOWN_MS = 1200
const flashStates = new WeakMap<DamageSprite, FlashState>()
const fatigueFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const alertFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const aggressionFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const healingFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const confusionFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const blockedFeedbackTimes = new WeakMap<RuntimeEntity, number>()

function canShowCombatFeedback(target: RuntimeEntity): boolean {
  return (
    target.family === FAMILY_TYPES.unit ||
    target.family === FAMILY_TYPES.animal ||
    target.family === FAMILY_TYPES.building ||
    target.family === FAMILY_TYPES.resource
  )
}

function canFlashDamage(target: RuntimeEntity): boolean {
  return target.family === FAMILY_TYPES.unit || target.family === FAMILY_TYPES.animal
}

function flashWhite(target: RuntimeEntity): void {
  const sprite = target.sprite
  const scheduler = target.context?.scheduler
  if (!sprite || !scheduler) return

  const previous = flashStates.get(sprite)
  const token = (previous?.token ?? 0) + 1
  const originalFilters = previous?.filters ?? sprite.filters ?? null
  const flash = new ColorMatrixFilter()
  flash.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]

  flashStates.set(sprite, { filters: originalFilters, token })
  sprite.filters = [...(originalFilters ?? []), flash]
  scheduler.addOneShot(
    () => {
      if (sprite.destroyed) return
      if (flashStates.get(sprite)?.token !== token) return
      sprite.filters = originalFilters ? [...originalFilters] : null
      flashStates.delete(sprite)
    },
    FLASH_MS,
    'combat.flash'
  )
}

export function clearDamageFeedback(target: RuntimeEntity): void {
  const sprite = target.sprite
  if (!sprite) return

  const state = flashStates.get(sprite)
  if (state) {
    sprite.filters = state.filters ? [...state.filters] : null
    flashStates.delete(sprite)
    return
  }

  sprite.filters = null
}

function showFloatingText(target: RuntimeEntity, options: FloatingTextOptions): void {
  const scheduler = target.context?.scheduler
  if (!scheduler || target.isDestroyed) return

  const spriteTop = (target.sprite ? -(target.sprite.height * target.sprite.anchor.y) : -40) + getReliefOffset(target)
  const text = new Text({
    text: options.text,
    style: {
      fill: options.fill,
      fontFamily: 'Arial, sans-serif',
      fontSize: options.fontSize ?? 13,
      fontWeight: '700',
      stroke: { color: options.stroke, width: 3 },
    },
  })
  text.anchor.set(0.5, 0.5)
  text.x = 0
  text.y = spriteTop - (options.yOffset ?? 12)
  text.alpha = 1
  text.zIndex = 100
  ;(target as unknown as Container).addChild(text)

  let step = 0
  let taskId: SchedulerTaskId | null = null
  const stopFloatingText = () => {
    if (taskId != null) {
      scheduler.remove(taskId)
      taskId = null
    }
    if (!text.destroyed) text.destroy()
  }
  taskId = scheduler.add(
    () => {
      if (target.isDestroyed || text.destroyed) {
        stopFloatingText()
        return
      }
      step += 1
      text.y = spriteTop - (options.yOffset ?? 12) - (FLOAT_RISE * step) / FLOAT_STEPS
      text.alpha = Math.max(0, 1 - step / FLOAT_STEPS)
      if (step < FLOAT_STEPS || taskId == null) return
      stopFloatingText()
    },
    FLOAT_STEP_MS,
    options.taskLabel
  )
}

export function showDamageFeedback(target: RuntimeEntity, damage: number): void {
  if (!canShowCombatFeedback(target) || damage <= 0) return
  if (canFlashDamage(target)) flashWhite(target)
  showFloatingText(target, {
    text: `-${damage}`,
    fill: 0xffffff,
    stroke: 0x6b0f0f,
    taskLabel: 'combat.damageText',
  })
}

export function showResourceGainFeedback(target: RuntimeEntity, amount: number): void {
  if (amount <= 0) return
  showFloatingText(target, {
    text: `+${amount}`,
    fill: 0xb8ff7a,
    stroke: 0x22591f,
    taskLabel: 'resource.gainText',
  })
}

export function showLevelUpFeedback(target: RuntimeEntity, text: string): void {
  showFloatingText(target, {
    text: `✨ ${text}`,
    fill: 0xffcc33,
    stroke: 0x5c3d00,
    taskLabel: 'experience.levelUpText',
    fontSize: 16,
    yOffset: 18,
  })
}

function showCooldownEmoteFeedback(
  target: RuntimeEntity,
  times: WeakMap<RuntimeEntity, number>,
  options: FloatingTextOptions
): void {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = times.get(target) ?? -Infinity
  if (now - previous < EMOTE_FEEDBACK_COOLDOWN_MS) return
  times.set(target, now)
  showFloatingText(target, options)
}

export function showFatigueFeedback(target: RuntimeEntity): void {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = fatigueFeedbackTimes.get(target) ?? -Infinity
  if (now - previous < FATIGUE_FEEDBACK_COOLDOWN_MS) return
  fatigueFeedbackTimes.set(target, now)
  showFloatingText(target, {
    text: '💤',
    fill: 0x7ec8ff,
    stroke: 0x163d66,
    fontSize: 18,
    yOffset: 18,
    taskLabel: 'unit.fatigueText',
  })
}

export function showAlertFeedback(target: RuntimeEntity): void {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = alertFeedbackTimes.get(target) ?? -Infinity
  if (now - previous < ALERT_FEEDBACK_COOLDOWN_MS) return
  alertFeedbackTimes.set(target, now)
  showFloatingText(target, {
    text: '!',
    fill: 0xfff3a0,
    stroke: 0x6b2500,
    fontSize: 20,
    yOffset: 20,
    taskLabel: 'unit.alertText',
  })
}

export function showAggressionFeedback(target: RuntimeEntity): void {
  showCooldownEmoteFeedback(target, aggressionFeedbackTimes, {
    text: '💢',
    fill: 0xff8a66,
    stroke: 0x651800,
    fontSize: 18,
    yOffset: 20,
    taskLabel: 'unit.aggressionText',
  })
}

export function showHealingFeedback(target: RuntimeEntity): void {
  showCooldownEmoteFeedback(target, healingFeedbackTimes, {
    text: '❤️',
    fill: 0xffb3c5,
    stroke: 0x6b1430,
    fontSize: 17,
    yOffset: 16,
    taskLabel: 'unit.healingText',
  })
}

export function showConfusionFeedback(target: RuntimeEntity): void {
  showCooldownEmoteFeedback(target, confusionFeedbackTimes, {
    text: '?',
    fill: 0xd9ecff,
    stroke: 0x24486b,
    fontSize: 20,
    yOffset: 20,
    taskLabel: 'unit.confusionText',
  })
}

export function showBlockedFeedback(target: RuntimeEntity): void {
  showCooldownEmoteFeedback(target, blockedFeedbackTimes, {
    text: '⛔',
    fill: 0xffd1d1,
    stroke: 0x661616,
    fontSize: 17,
    yOffset: 20,
    taskLabel: 'unit.blockedText',
  })
}
