import type { AnimatedSprite, Filter, Sprite } from 'pixi.js'
import type { SchedulerLike, SchedulerTaskId } from '../../types/context'

export type TransientEffectSprite = Sprite | AnimatedSprite

type FilterEffectState = {
  baseFilters: readonly Filter[] | null
  effect: Filter
  scheduler: Pick<SchedulerLike, 'remove'>
  taskId: SchedulerTaskId | null
  token: number
}

type TintFrameEffectState = {
  originalTint: number
  previousOnFrameChange: AnimatedSprite['onFrameChange']
  onFrameChange: NonNullable<AnimatedSprite['onFrameChange']>
}

type StartFilterEffectOptions = {
  durationMs: number
  filter: Filter
  scheduler: Pick<SchedulerLike, 'addOneShot' | 'remove'>
  taskName?: string
}

const filterEffectStates = new WeakMap<TransientEffectSprite, FilterEffectState>()
const filterEffectSprites = new Set<TransientEffectSprite>()
const tintFrameEffectStates = new WeakMap<AnimatedSprite, TintFrameEffectState>()

export function setSpriteFiltersPreservingTransientEffect(
  sprite: TransientEffectSprite,
  filters: readonly Filter[] | null
): void {
  const state = filterEffectStates.get(sprite)
  if (!state) {
    sprite.filters = filters ? [...filters] : null
    return
  }

  state.baseFilters = filters ? [...filters] : null
  sprite.filters = [...(state.baseFilters ?? []), state.effect]
}

export function startSpriteFilterEffect(
  sprite: TransientEffectSprite,
  { durationMs, filter, scheduler, taskName = 'sprite.filterEffect' }: StartFilterEffectOptions
): void {
  const previous = filterEffectStates.get(sprite)
  const token = (previous?.token ?? 0) + 1
  const baseFilters = previous ? previous.baseFilters : (sprite.filters ?? null)
  if (previous?.taskId != null) previous.scheduler.remove(previous.taskId)

  const state: FilterEffectState = { baseFilters, effect: filter, scheduler, taskId: null, token }
  filterEffectStates.set(sprite, state)
  filterEffectSprites.add(sprite)
  sprite.filters = [...(baseFilters ?? []), filter]
  state.taskId = scheduler.addOneShot(
    () => {
      clearSpriteFilterEffect(sprite, token)
    },
    durationMs,
    taskName
  )
}

export function clearSpriteFilterEffect(sprite: TransientEffectSprite | null | undefined, token?: number): void {
  if (!sprite) return
  const state = filterEffectStates.get(sprite)
  if (!state || (token != null && state.token !== token)) return
  if (state.taskId != null) state.scheduler.remove(state.taskId)
  if (!sprite.destroyed) {
    sprite.filters = state.baseFilters ? [...state.baseFilters] : null
  }
  filterEffectStates.delete(sprite)
  filterEffectSprites.delete(sprite)
}

export function hasSpriteFilterEffect(sprite: TransientEffectSprite | null | undefined): boolean {
  return Boolean(sprite && filterEffectStates.has(sprite))
}

export function clearAllSpriteFilterEffects(): void {
  for (const sprite of [...filterEffectSprites]) {
    if (sprite.destroyed) {
      filterEffectStates.delete(sprite)
      filterEffectSprites.delete(sprite)
      continue
    }
    clearSpriteFilterEffect(sprite)
  }
}

export function clearSpriteTintFrameEffect(sprite: AnimatedSprite | null | undefined): void {
  if (!sprite) return
  const state = tintFrameEffectStates.get(sprite)
  if (!state) return
  if (sprite.onFrameChange === state.onFrameChange) {
    sprite.onFrameChange = state.previousOnFrameChange
  }
  if (!sprite.destroyed) sprite.tint = state.originalTint
  tintFrameEffectStates.delete(sprite)
}
