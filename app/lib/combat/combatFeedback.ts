import { ColorMatrixFilter, Graphics, Text } from 'pixi.js'
import { FAMILY_TYPES } from '../constants'
import { getReliefOffset } from '../maths'
import {
  clearAllSpriteFilterEffects,
  clearSpriteFilterEffect,
  hasSpriteFilterEffect,
  setSpriteFiltersPreservingTransientEffect,
  startSpriteFilterEffect,
} from '../entities/spriteTransientEffects'
import { getEntityHudTopY } from '../entities/entityHudPosition'
import { createStatusBubble } from '../entities/statusBubble'
import type { RuntimeEntity } from '../../types/entities'
import type { SchedulerTaskId } from '../../types/context'
import type { AnimatedSprite, Container, Filter, Sprite } from 'pixi.js'

type DamageSprite = Sprite | AnimatedSprite
type FloatingTextOptions = {
  text: string
  fill?: number
  stroke?: number
  taskLabel: string
  fontSize?: number
  yOffset?: number
  statusBubble?: boolean
  steps?: number
  rise?: number
}
type AlertAggressionCallback = () => void
type FloatingTextRecord = {
  text: Container
  scheduler: NonNullable<RuntimeEntity['context']>['scheduler']
  taskId: SchedulerTaskId | null
}

const FLASH_MS = 90
const FLOAT_STEP_MS = 35
const FLOAT_STEPS = 14
const FLOAT_RISE = 18
const STATUS_BUBBLE_STEPS = 46
const STATUS_BUBBLE_RISE = 0
const STATUS_BUBBLE_Y_OFFSET = 8
const FATIGUE_FEEDBACK_COOLDOWN_MS = 1200
const ALERT_FEEDBACK_COOLDOWN_MS = 1200
const STATUS_FEEDBACK_COOLDOWN_MS = 1200
const ALERT_TO_AGGRESSION_DELAY_MS = 350
const CONVERSION_FLASH_DURATION_MS = 170
const CONVERSION_FLASH_STEP_MS = 16
const CONVERSION_FLASH_MAX_ALPHA = 0.45
type ConversionFlashState = {
  overlay: Graphics
  scheduler: NonNullable<RuntimeEntity['context']>['scheduler']
  token: number
  taskId: SchedulerTaskId
}
const conversionFlashStates = new WeakMap<DamageSprite, ConversionFlashState>()
const conversionFlashSprites = new Set<DamageSprite>()
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
  orange: '#e37840',
  green: '#4b6b2b',
  teal: '#008279',
  violet: '#3d5083',
  grey: '#8f8f8f',
  cyan: '#008279',
}

function formatDamageFeedback(damage: number): string | null {
  if (!Number.isFinite(damage)) return null
  const rounded = Math.round(damage)
  if (rounded <= 0) return null
  return `-${rounded}`
}

function formatHitPointGainFeedback(amount: number): string | null {
  if (!Number.isFinite(amount)) return null
  const rounded = Math.round(amount)
  if (rounded <= 0) return null
  return `+${rounded}`
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
  setSpriteFiltersPreservingTransientEffect(sprite, filters)
}

function parseFlashColor(color: string | null | undefined): [number, number, number] {
  const normalized = color?.startsWith('#') ? color : PLAYER_FLASH_COLORS[color ?? ''] ?? '#ffffff'
  const match = /^#?([0-9a-f]{6})$/i.exec(normalized)
  if (!match) return [1, 1, 1]
  const value = Number.parseInt(match[1], 16)
  return [((value >> 16) & 0xff) / 255, ((value >> 8) & 0xff) / 255, (value & 0xff) / 255]
}

function colorToInt(color: string | null | undefined): number {
  const [r, g, b] = parseFlashColor(color)
  const toByte = (value: number): number => Math.round(Math.max(0, Math.min(255, value * 255)))
  return (toByte(r) << 16) + (toByte(g) << 8) + toByte(b)
}

function stopConversionFlash(sprite: DamageSprite, token?: number): void {
  const state = conversionFlashStates.get(sprite)
  if (!state || (token != null && state.token !== token)) return
  state.scheduler.remove(state.taskId)
  state.overlay.parent?.removeChild(state.overlay)
  state.overlay.destroy()
  conversionFlashStates.delete(sprite)
  conversionFlashSprites.delete(sprite)
}

function startConversionWave(target: RuntimeEntity, color?: string | null): void {
  const sprite = target.sprite
  const scheduler = target.context?.scheduler
  const parent = sprite?.parent
  if (!sprite || !parent || !scheduler) return

  const token = (conversionFlashStates.get(sprite)?.token ?? 0) + 1
  stopConversionFlash(sprite)

  const overlay = new Graphics()
  overlay.eventMode = 'none'
  overlay.zIndex = 30
  overlay.label = 'combat.conversionWave'
  overlay.mask = sprite
  parent.addChild(overlay)
  conversionFlashSprites.add(sprite)

  const waveColor = colorToInt(color)
  let elapsed = 0
  const state: ConversionFlashState = {
    overlay,
    scheduler,
    token,
    taskId: -1,
  }

  state.taskId = scheduler.add(
    () => {
      if (
        sprite.destroyed ||
        target.isDestroyed ||
        target.context?.defeat ||
        (conversionFlashStates.get(sprite)?.token !== token)
      ) {
        stopConversionFlash(sprite, token)
        return
      }

      const width = Math.max(1, sprite.width)
      const height = Math.max(1, sprite.height)
      const progress = Math.min(1, elapsed / CONVERSION_FLASH_DURATION_MS)
      const easedProgress = 1 - (1 - progress) * (1 - progress)
      const fillHeight = height * easedProgress
      const x = sprite.x - width * sprite.anchor.x
      const y = sprite.y - height * sprite.anchor.y + (height - fillHeight)
      const alpha = CONVERSION_FLASH_MAX_ALPHA * (1 - progress)

      overlay.clear()
      overlay.rect(x, y, width, fillHeight)
      overlay.fill({ color: waveColor, alpha })
      elapsed += CONVERSION_FLASH_STEP_MS

      if (progress >= 1) {
        stopConversionFlash(sprite, token)
      }
    },
    CONVERSION_FLASH_STEP_MS,
    'combat.conversionWave'
  )
  conversionFlashStates.set(sprite, state)
}

function flashColor(target: RuntimeEntity, color?: string | null): void {
  const sprite = target.sprite
  const scheduler = target.context?.scheduler
  if (!sprite || !scheduler) return

  const [r, g, b] = parseFlashColor(color)
  const flash = new ColorMatrixFilter()
  flash.matrix = [0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, 0, 0, 0, 1, 0]

  startSpriteFilterEffect(sprite, {
    durationMs: FLASH_MS,
    filter: flash,
    scheduler,
    taskName: 'combat.flash',
  })
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
      if (!record.text.destroyed) record.text.destroy({ children: true })
    }
    records.clear()
    floatingTexts.delete(target)
    floatingTextTargets.delete(target)
  }

  if (!sprite) return

  const conversionState = conversionFlashStates.get(sprite)
  const hadFlashState = hasSpriteFilterEffect(sprite)
  if (hadFlashState) clearSpriteFilterEffect(sprite)
  if (conversionState) {
    stopConversionFlash(sprite, conversionState.token)
  }
}

export function clearAllCombatFeedback(): void {
  for (const target of [...floatingTextTargets]) {
    clearDamageFeedback(target)
  }

  clearAllSpriteFilterEffects()

  for (const sprite of [...conversionFlashSprites]) {
    stopConversionFlash(sprite)
  }
}

function showFloatingText(target: RuntimeEntity, options: FloatingTextOptions): void {
  const scheduler = target.context?.scheduler
  if (!scheduler || target.context?.defeat || target.isDestroyed || target.isDead) return

  const yOffset = options.yOffset ?? 12
  const spriteTop = options.statusBubble
    ? getEntityHudTopY(target, yOffset) + getReliefOffset(target)
    : (target.sprite ? -(target.sprite.height * target.sprite.anchor.y) : -40) + getReliefOffset(target) - yOffset
  const detached = target.family === FAMILY_TYPES.resource
  const text = createFloatingTextDisplay(options)
  const baseY = (detached ? (target.y ?? 0) : 0) + spriteTop
  text.x = detached ? (target.x ?? 0) : 0
  text.y = baseY
  text.alpha = 1
  text.zIndex = 100
  const targetContainer = target as unknown as Container
  const textParent = detached ? targetContainer.parent : targetContainer
  if (!textParent || textParent.destroyed) return
  textParent.addChild(text)

  let step = 0
  const totalSteps = options.steps ?? FLOAT_STEPS
  const rise = options.rise ?? FLOAT_RISE
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
    if (!text.destroyed) text.destroy({ children: true })
  }
  record.taskId = scheduler.add(
    () => {
      if ((!detached && target.isDestroyed) || text.destroyed) {
        stopFloatingText()
        return
      }
      step += 1
      text.y = baseY - (rise * step) / totalSteps
      text.alpha = Math.max(0, 1 - step / totalSteps)
      if (step < totalSteps || record.taskId == null) return
      stopFloatingText()
    },
    FLOAT_STEP_MS,
    options.taskLabel
  )
}

function createFloatingTextLabel(options: FloatingTextOptions): Text {
  const text = new Text({
    text: options.text,
    style: {
      fill: options.fill ?? 0xffffff,
      fontFamily: 'Arial, sans-serif',
      fontSize: options.fontSize ?? 13,
      fontWeight: '700',
      stroke: { color: options.stroke ?? 0x000000, width: 3 },
    },
  })
  text.anchor.set(0.5, 0.5)
  return text
}

function createFloatingTextDisplay(options: FloatingTextOptions): Container {
  return options.statusBubble
    ? createStatusBubble({ text: options.text, fontSize: options.fontSize })
    : createFloatingTextLabel(options)
}

function statusBubbleFeedback(options: FloatingTextOptions): FloatingTextOptions {
  return {
    ...options,
    fill: 0x16120d,
    stroke: 0x4a2a16,
    statusBubble: true,
    steps: STATUS_BUBBLE_STEPS,
    rise: STATUS_BUBBLE_RISE,
    yOffset: options.yOffset ?? STATUS_BUBBLE_Y_OFFSET,
  }
}

export function showDamageFeedback(target: RuntimeEntity, damage: number): void {
  const text = formatDamageFeedback(damage)
  if (
    !text ||
    !canShowCombatFeedback(target) ||
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
  if (!canShowCombatFeedback(target) || target.context?.defeat || target.isDestroyed) return
  if (canFlashDamage(target)) startConversionWave(target, color)
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

export function showHitPointGainFeedback(target: RuntimeEntity, amount: number): void {
  const text = formatHitPointGainFeedback(amount)
  if (!text || !canShowCombatFeedback(target) || target.context?.defeat || target.isDestroyed || target.isDead) return
  showFloatingText(target, {
    text,
    fill: 0xb8ff7a,
    stroke: 0x22591f,
    taskLabel: 'combat.hitPointGainText',
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

function showCooldownStatusFeedback(
  target: RuntimeEntity,
  times: WeakMap<RuntimeEntity, number>,
  options: FloatingTextOptions
): void {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = times.get(target) ?? -Infinity
  if (now - previous < STATUS_FEEDBACK_COOLDOWN_MS) return
  times.set(target, now)
  showFloatingText(target, options)
}

export function showFatigueFeedback(target: RuntimeEntity): void {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = fatigueFeedbackTimes.get(target) ?? -Infinity
  if (now - previous < FATIGUE_FEEDBACK_COOLDOWN_MS) return
  fatigueFeedbackTimes.set(target, now)
  showFloatingText(target, statusBubbleFeedback({
    text: '...',
    fontSize: 13,
    yOffset: STATUS_BUBBLE_Y_OFFSET,
    taskLabel: 'unit.fatigueText',
  }))
}

function showAlertFeedbackNow(target: RuntimeEntity): boolean {
  const scheduler = target.context?.scheduler
  const now = scheduler?.elapsedMs ?? performance.now()
  const previous = alertFeedbackTimes.get(target) ?? -Infinity
  if (now - previous < ALERT_FEEDBACK_COOLDOWN_MS) return false
  alertFeedbackTimes.set(target, now)
  showFloatingText(target, statusBubbleFeedback({
    text: '!',
    fontSize: 14,
    yOffset: STATUS_BUBBLE_Y_OFFSET,
    taskLabel: 'unit.alertText',
  }))
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
  showCooldownStatusFeedback(target, aggressionFeedbackTimes, statusBubbleFeedback({
    text: '!!',
    fontSize: 14,
    yOffset: STATUS_BUBBLE_Y_OFFSET,
    taskLabel: 'unit.aggressionText',
  }))
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
  showCooldownStatusFeedback(target, healingFeedbackTimes, statusBubbleFeedback({
    text: '♥',
    fontSize: 12,
    yOffset: 16,
    taskLabel: 'unit.healingText',
  }))
}

export function showConfusionFeedback(target: RuntimeEntity): void {
  showCooldownStatusFeedback(target, confusionFeedbackTimes, statusBubbleFeedback({
    text: '?',
    fontSize: 13,
    yOffset: 20,
    taskLabel: 'unit.confusionText',
  }))
}

export function showBlockedFeedback(target: RuntimeEntity): void {
  showCooldownStatusFeedback(target, blockedFeedbackTimes, statusBubbleFeedback({
    text: 'X',
    fontSize: 12,
    yOffset: 20,
    taskLabel: 'unit.blockedText',
  }))
}
