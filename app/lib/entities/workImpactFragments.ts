import type { AnimatedSprite, Container, Sprite } from 'pixi.js'
import { ACTION_TYPES, FAMILY_TYPES, RESOURCE_TYPES } from '../../constants'
import type { RuntimeEntity, UnitEntity } from '../../types/entities'
import { spawnSpriteFragmentBurst, type SpriteFragmentBurstOptions } from './spriteFragmentBurst'

type ImpactFragmentPreset = Omit<SpriteFragmentBurstOptions, 'context' | 'host' | 'sprite' | 'layer'>

type SpriteTarget = RuntimeEntity & {
  parent?: Container | null
  sprite?: Sprite | AnimatedSprite
}

const IMPACT_THROTTLE_MS = 120

const targetImpactTimes = new WeakMap<RuntimeEntity, Map<string, number>>()

const WOOD_CHIP_PRESET: ImpactFragmentPreset = {
  fragmentSize: 8,
  maxFragments: 5,
  durationMs: 560,
  gravity: 0.0022,
  minSpeed: 0.012,
  maxSpeed: 0.06,
  upwardVelocity: 0.05,
  settleToBottom: true,
  lockX: true,
  settleSpread: 16,
  settleStrength: 0.00006,
  groundBounce: 0.1,
  zIndexOffset: 0.42,
}

const STONE_CHIP_PRESET: ImpactFragmentPreset = {
  fragmentSize: 7,
  maxFragments: 6,
  durationMs: 620,
  gravity: 0.003,
  minSpeed: 0.01,
  maxSpeed: 0.052,
  upwardVelocity: 0.035,
  settleToBottom: true,
  lockX: true,
  settleSpread: 14,
  settleStrength: 0.00004,
  groundBounce: 0.05,
  zIndexOffset: 0.42,
}

const BUILD_SPARK_PRESET: ImpactFragmentPreset = {
  fragmentSize: 8,
  maxFragments: 5,
  durationMs: 480,
  gravity: 0.0024,
  minSpeed: 0.008,
  maxSpeed: 0.04,
  upwardVelocity: 0.03,
  settleToBottom: true,
  lockX: true,
  settleSpread: 12,
  settleStrength: 0.00005,
  groundBounce: 0.08,
  zIndexOffset: 0.44,
}

const PLANT_CUT_PRESET: ImpactFragmentPreset = {
  fragmentSize: 6,
  maxFragments: 7,
  durationMs: 500,
  gravity: 0.0017,
  minSpeed: 0.008,
  maxSpeed: 0.045,
  upwardVelocity: 0.032,
  settleToBottom: true,
  lockX: true,
  settleSpread: 18,
  settleStrength: 0.00007,
  groundBounce: 0.08,
  zIndexOffset: 0.42,
}

function getWorkImpactPreset(action: string | null | undefined, target: RuntimeEntity): ImpactFragmentPreset | null {
  if (action === ACTION_TYPES.chopwood && target.family === FAMILY_TYPES.resource) {
    if (target.type === RESOURCE_TYPES.tree || target.type === RESOURCE_TYPES.berrybush) return WOOD_CHIP_PRESET
  }

  if (
    (action === ACTION_TYPES.minestone ||
      action === ACTION_TYPES.minegold ||
      action === ACTION_TYPES.minecopper ||
      action === ACTION_TYPES.mineiron) &&
    target.family === FAMILY_TYPES.resource
  ) {
    if (
      target.type === RESOURCE_TYPES.stone ||
      target.type === RESOURCE_TYPES.gold ||
      target.type === RESOURCE_TYPES.copper ||
      target.type === RESOURCE_TYPES.iron
    ) {
      return STONE_CHIP_PRESET
    }
  }

  if (action === ACTION_TYPES.build && target.family === FAMILY_TYPES.building) return BUILD_SPARK_PRESET
  if (
    target.family === FAMILY_TYPES.resource &&
    ((action === ACTION_TYPES.farm && target.type === RESOURCE_TYPES.wheat) ||
      (action === ACTION_TYPES.forageberry && target.type === RESOURCE_TYPES.berrybush))
  ) {
    return PLANT_CUT_PRESET
  }

  return null
}

function canEmitImpact(target: RuntimeEntity, action: string | null | undefined, now: number): boolean {
  const key = action ?? 'impact'
  let times = targetImpactTimes.get(target)
  if (!times) {
    times = new Map()
    targetImpactTimes.set(target, times)
  }
  const previous = times.get(key) ?? -Infinity
  if (now - previous < IMPACT_THROTTLE_MS) return false
  times.set(key, now)
  return true
}

export function spawnWorkImpactFragments(unit: UnitEntity, target: RuntimeEntity | null | undefined): void {
  if (!target?.sprite || target.isDead || target.isDestroyed) return
  const preset = getWorkImpactPreset(unit.action, target)
  if (!preset) return
  const context = target.context ?? unit.context
  if (!context || !canEmitImpact(target, unit.action, performance.now())) return

  const spriteTarget = target as SpriteTarget
  spawnSpriteFragmentBurst({
    ...preset,
    context,
    host: target,
    sprite: target.sprite,
    layer: spriteTarget.parent,
  })
}
