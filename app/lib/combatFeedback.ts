import { ColorMatrixFilter, Text } from 'pixi.js'
import { FAMILY_TYPES } from '../constants'
import { getReliefOffset } from './maths'
import type { RuntimeEntity } from '../types/entities'
import type { SchedulerTaskId } from '../types/context'
import type { AnimatedSprite, Container, Filter, Sprite } from 'pixi.js'

type DamageSprite = Sprite | AnimatedSprite
type FlashState = {
  baseFilters: readonly Filter[] | null
  flash: Filter
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
type AlertAggressionCallback = () => void
type FloatingTextRecord = {
  text: Text
  scheduler: NonNullable<RuntimeEntity['context']>['scheduler']
  taskId: SchedulerTaskId | null
}

const FLASH_MS = 90
const FLOAT_STEP_MS = 35
const FLOAT_STEPS = 14
const FLOAT_RISE = 18
const FATIGUE_FEEDBACK_COOLDOWN_MS = 1200
const ALERT_FEEDBACK_COOLDOWN_MS = 1200
const EMOTE_FEEDBACK_COOLDOWN_MS = 1200
const ALERT_TO_AGGRESSION_DELAY_MS = 350
const flashStates = new WeakMap<DamageSprite, FlashState>()
const flashSprites = new Set<DamageSprite>()
const fatigueFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const alertFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const aggressionFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const sequencedAggressionTaskIds = new WeakMap<RuntimeEntity, SchedulerTaskId>()
const healingFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const confusionFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const blockedFeedbackTimes = new WeakMap<RuntimeEntity, number>()
const floatingTexts = new WeakMap<RuntimeEntity, Set<FloatingTextRecord>>()
const floatingTextTargets = new Set<RuntimeEntity>()
const PLAYER_FLASH_COLORS: Record<string, string> = {
  blue: '#466ac9',
  red: '#e30b00',
  yellow: '#c3a31b',
  brown: '#8b5b37',
  orange: '#ef6307',
  green: '#4b6b2b',
  grey: '#8f8f8f',
  cyan: '#00837b',
}

function formatDamageFeedback(damage: number): string | null {
  if (!Number.isFinite(damage)) return null
  const rounded = Math.round(damage)
  if (rounded <= 0) return null
  return `-${rounded}`
}

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

export function setSpriteFiltersPreservingDamageFeedback(
  sprite: DamageSprite,
  filters: readonly Filter[] | null
): void {
  const state = flashStates.get(sprite)
  if (!state) {
    sprite.filters = filters ? [...filters] : null
    return
  }

  state.baseFilters = filters ? [...filters] : null
  sprite.filters = [...(state.baseFilters ?? []), state.flash]
}

function parseFlashColor(color: string | null | undefined): [number, number, number] {
  const normalized = color?.startsWith('#') ? color : PLAYER_FLASH_COLORS[color ?? ''] ?? '#ffffff'
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized)
  if (!match) return [1, 1, 1]
  const value = Number.parseInt(match[1], 16)
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
}

function flashColor(target: RuntimeEntity, color?: string | null): void {
  const sprite = target.sprite
  const scheduler = target.context?.scheduler
  if (!sprite || !scheduler) return

  const previous = flashStates.get(sprite)
  const token = (previous?.token ?? 0) + 1
  const baseFilters = previous?.baseFilters ?? sprite.filters ?? null
  const [r, g, b] = parseFlashColor(color)
  const flash = new ColorMatrixFilter()
  flash.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0]

  flashStates.set(sprite, { baseFilters, flash, token })
  flashSprites.add(sprite)
  sprite.filters = [...(baseFilters ?? []), flash]
  scheduler.addOneShot(
    () => {
      if (sprite.destroyed) return
      const state = flashStates.get(sprite)
      if (state?.token !== token) return
      sprite.filters = state.baseFilters ? [...state.baseFilters] : null
      flashStates.delete(sprite)
      flashSprites.delete(sprite)
    },
    FLASH_MS,
    'combat.flash'
  )
}

function flashWhite(target: RuntimeEntity): void {
  flashColor(target, '#ffffff')
}

export function clearDamageFeedback(target: RuntimeEntity): void {
  const sprite = target.sprite
  const records = floatingTexts.get(target)
  if (records) {
    for (const record of records) {
      if (record.taskId != null) record.scheduler.remove(record.taskId)
      if (!record.text.destroyed) record.text.destroy()
    }
    records.clear()
    floatingTexts.delete(target)
    floatingTextTargets.delete(target)
  }

  if (!sprite) return

  const state = flashStates.get(sprite)
  if (state) {
    sprite.filters = state.baseFilters ? [...state.baseFilters] : null
    flashStates.delete(sprite)
    flashSprites.delete(sprite)
    return
  }

  sprite.filters = null
}

export function clearAllCombatFeedback(): void {
  for (const target of [...floatingTextTargets]) {
    clearDamageFeedback(target)
  }

  for (const sprite of [...flashSprites]) {
    if (sprite.destroyed) {
      flashStates.delete(sprite)
      flashSprites.delete(sprite)
      continue
    }
    const state = flashStates.get(sprite)
    sprite.filters = state?.baseFilters ? [...state.baseFilters] : null
    flashStates.delete(sprite)
    flashSprites.delete(sprite)
  }
}

function showFloatingText(target: RuntimeEntity, options: FloatingTextOptions): void {
  const scheduler = target.context?.scheduler
  if (!scheduler || target.context?.victory || target.context?.defeat || target.isDestroyed || target.isDead) return

  const spriteTop = (target.sprite ? -(target.sprite.height * target.sprite.anchor.y) : -40) + getReliefOffset(target)
  const detached = target.family === FAMILY_TYPES.resource
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
  const baseY = (detached ? (target.y ?? 0) : 0) + spriteTop - (options.yOffset ?? 12)
  text.x = detached ? (target.x ?? 0) : 0
  text.y = baseY
  text.alpha = 1
  text.zIndex = 100
  const targetContainer = target as unknown as Container
  const textParent = detached ? targetContainer.parent : targetContainer
  if (!textParent || textParent.destroyed) return
  textParent.addChild(text)

  let step = 0
  const records = floatingTexts.get(target) ?? new Set<FloatingTextRecord>()
  const record: FloatingTextRecord = { text, scheduler, taskId: null }
  records.add(record)
  floatingTexts.set(target, records)
  floatingTextTargets.add(target)
  const stopFloatingText = () => {
    if (record.taskId != null) {
      scheduler.remove(record.taskId)
      record.taskId = null
    }
    records.delete(record)
    if (!records.size) {
      floatingTexts.delete(target)
      floatingTextTargets.delete(target)
    }
    if (!text.destroyed) text.destroy()
  }
  record.taskId = scheduler.add(
    () => {
      if ((!detached && target.isDestroyed) || text.destroyed) {
        stopFloatingText()
        return
      }
      step += 1
      text.y = baseY - (FLOAT_RISE * step) / FLOAT_STEPS
      text.alpha = Math.max(0, 1 - step / FLOAT_STEPS)
      if (step < FLOAT_STEPS || record.taskId == null) return
      stopFloatingText()
    },
    FLOAT_STEP_MS,
    options.taskLabel
  )
}

export function showDamageFeedback(target: RuntimeEntity, damage: number): void {
  const text = formatDamageFeedback(damage)
  if (
    !text ||
    !canShowCombatFeedback(target) ||
    target.context?.victory ||
    target.context?.defeat ||
    target.isDestroyed ||
    target.isDead
  ) {
    return
  }
  if (canFlashDamage(target)) flashWhite(target)
  showFloatingText(target, {
    text,
    fill: 0xffffff,
    stroke: 0x6b0f0f,
    taskLabel: 'combat.damageText',
  })
}

export function showConversionFeedback(target: RuntimeEntity, color?: string | null): void {
  if (!canShowCombatFeedback(target) || target.context?.victory || target.context?.defeat || target.isDestroyed) return
  if (canFlashDamage(target)) flashColor(target, color)
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

export function showParryFeedback(target: RuntimeEntity, text: string): void {
  if (!canShowCombatFeedback(target)) return
  showFloatingText(target, {
    text,
    fill: 0xfff06a,
    stroke: 0x5f3c00,
    taskLabel: 'combat.parryText',
    fontSize: 12,
    yOffset: 20,
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

function showAlertFeedbackNow(target: RuntimeEntity): boolean {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = alertFeedbackTimes.get(target) ?? -Infinity
  if (now - previous < ALERT_FEEDBACK_COOLDOWN_MS) return false
  alertFeedbackTimes.set(target, now)
  showFloatingText(target, {
    text: '!',
    fill: 0xfff3a0,
    stroke: 0x6b2500,
    fontSize: 20,
    yOffset: 20,
    taskLabel: 'unit.alertText',
  })
  return true
}

export function showAlertFeedback(target: RuntimeEntity): void {
  showAlertFeedbackNow(target)
}

export function showAggressionFeedback(target: RuntimeEntity): void {
  const pendingTaskId = sequencedAggressionTaskIds.get(target)
  if (pendingTaskId != null) {
    target.context?.scheduler?.remove(pendingTaskId)
    sequencedAggressionTaskIds.delete(target)
  }
  showCooldownEmoteFeedback(target, aggressionFeedbackTimes, {
    text: '💢',
    fill: 0xff8a66,
    stroke: 0x651800,
    fontSize: 18,
    yOffset: 20,
    taskLabel: 'unit.aggressionText',
  })
}

export function showAlertThenAggressionFeedback(target: RuntimeEntity, onAggression?: AlertAggressionCallback): void {
  const scheduler = target.context?.scheduler
  const alertShown = showAlertFeedbackNow(target)
  if (!alertShown || sequencedAggressionTaskIds.has(target)) return
  if (!scheduler) {
    showAggressionFeedback(target)
    onAggression?.()
    return
  }

  const taskId = scheduler.addOneShot(
    () => {
      sequencedAggressionTaskIds.delete(target)
      if (target.isDestroyed || target.isDead) return
      showAggressionFeedback(target)
      onAggression?.()
    },
    ALERT_TO_AGGRESSION_DELAY_MS,
    'unit.alertAggressionText'
  )
  sequencedAggressionTaskIds.set(target, taskId)
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
