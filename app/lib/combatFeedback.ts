import { ColorMatrixFilter, Text } from 'pixi.js'
import { FAMILY_TYPES } from '../constants'
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
}

const FLASH_MS = 90
const FLOAT_STEP_MS = 35
const FLOAT_STEPS = 14
const FLOAT_RISE = 18
const flashStates = new WeakMap<DamageSprite, FlashState>()

function canShowCombatFeedback(target: RuntimeEntity): boolean {
  return (
    target.family === FAMILY_TYPES.unit ||
    target.family === FAMILY_TYPES.animal ||
    target.family === FAMILY_TYPES.building
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

  const spriteTop = target.sprite ? -(target.sprite.height * target.sprite.anchor.y) : -40
  const text = new Text({
    text: options.text,
    style: {
      fill: options.fill,
      fontFamily: 'Arial, sans-serif',
      fontSize: 13,
      fontWeight: '700',
      stroke: { color: options.stroke, width: 3 },
    },
  })
  text.anchor.set(0.5, 0.5)
  text.x = 0
  text.y = spriteTop - 12
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
      text.y = spriteTop - 12 - (FLOAT_RISE * step) / FLOAT_STEPS
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
