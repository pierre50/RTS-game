import type { AnimatedSprite, Sprite } from 'pixi.js'
import { Graphics } from 'pixi.js'
import type { SchedulerTaskId } from '../../types/context'
import type { RuntimeEntity } from '../../types/entities'
type DamageSprite = Sprite | AnimatedSprite
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
  black: '#2d3136',
  cyan: '#008279',
}

function parseFlashColor(color: string | null | undefined): [number, number, number] {
  const normalized = color?.startsWith('#') ? color : (PLAYER_FLASH_COLORS[color ?? ''] ?? '#ffffff')
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

export function stopConversionFlash(sprite: DamageSprite, token?: number): void {
  const state = conversionFlashStates.get(sprite)
  if (!state || (token != null && state.token !== token)) return
  state.scheduler.remove(state.taskId)
  state.overlay.parent?.removeChild(state.overlay)
  state.overlay.destroy()
  conversionFlashStates.delete(sprite)
  conversionFlashSprites.delete(sprite)
}

export function startConversionWave(target: RuntimeEntity, color?: string | null): void {
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
        conversionFlashStates.get(sprite)?.token !== token
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

export function clearAllConversionFlashes(): void {
  for (const sprite of [...conversionFlashSprites]) stopConversionFlash(sprite)
}
